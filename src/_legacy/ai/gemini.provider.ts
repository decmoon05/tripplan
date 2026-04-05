import { Type } from '@google/genai';
import type { TripAdvisories } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';
import type {
  AIProvider,
  AIProviderStreaming,
  AIGenerateResult,
  AIGeneratedItem,
  GenerateInput,
  PlacePreferenceInput,
  VerifiedPlace,
  StreamChunk,
} from './types';
import { buildSystemPrompt, buildUserPrompt, buildSingleDayPrompt, buildMetadataPrompt, buildRepairPrompt } from './prompt';
import { resolveTimeOverlaps, validateDay, augmentMissingMeals } from './itineraryValidation';
import type { DayIssue } from './itineraryValidation';
import { getDayCount } from '@/utils/date';
import { normalizePlaceName, isFuzzyDuplicate } from './utils/placeName';
import { getGeminiClient, rotateGeminiKey, getGeminiKeyCount } from './utils/geminiClient';
import { toTripItems } from './utils/tripItemMapper';

// 키 로테이션은 utils/geminiClient.ts 싱글턴 사용 (v3 adapter, audit과 상태 공유)

// ---------------------------------------------------------------------------
// 모델 선택 — models.ts에서 중앙 관리
// ---------------------------------------------------------------------------
import { getGeminiMainModel, getGeminiLiteModel } from './models';

function getProModel(): string {
  return getGeminiMainModel();
}
function getFlashModel(): string {
  return getGeminiLiteModel();
}

// ---------------------------------------------------------------------------
// Gemini responseSchema — AIGeneratedItem + metadata 구조 강제
// ---------------------------------------------------------------------------
const ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dayNumber: { type: Type.INTEGER },
    orderIndex: { type: Type.INTEGER },
    placeNameSnapshot: { type: Type.STRING },
    category: {
      type: Type.STRING,
      enum: ['attraction', 'restaurant', 'cafe', 'shopping', 'transport', 'hotel'],
    },
    startTime: { type: Type.STRING },
    endTime: { type: Type.STRING },
    estimatedCost: { type: Type.INTEGER },
    currency: { type: Type.STRING },
    priceConfidence: { type: Type.STRING, enum: ['confirmed', 'estimated'] },
    notes: { type: Type.STRING },
    latitude: { type: Type.NUMBER, nullable: true },
    longitude: { type: Type.NUMBER, nullable: true },
    activityLevel: { type: Type.STRING, enum: ['light', 'moderate', 'intense'] },
    reasonTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    address: { type: Type.STRING, nullable: true },
    businessHours: { type: Type.STRING, nullable: true },
    closedDays: { type: Type.STRING, nullable: true },
    transitMode: {
      type: Type.STRING,
      enum: ['walk', 'bus', 'taxi', 'subway', 'train', 'bicycle', 'drive', 'flight', 'ferry'],
      nullable: true,
    },
    transitDurationMin: { type: Type.INTEGER, nullable: true },
    transitSummary: { type: Type.STRING, nullable: true },
    verified: { type: Type.BOOLEAN },
    googlePlaceId: { type: Type.STRING, nullable: true },
  },
  required: [
    'dayNumber', 'orderIndex', 'placeNameSnapshot', 'category',
    'startTime', 'endTime', 'estimatedCost', 'currency', 'notes',
    'activityLevel', 'reasonTags',
  ],
} as const;

const ADVISORIES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    weather: { type: Type.STRING },
    safety: { type: Type.STRING },
    exchangeRate: { type: Type.STRING },
    holidays: { type: Type.STRING },
    atmosphere: { type: Type.STRING },
    disasters: { type: Type.STRING },
    other: { type: Type.STRING },
  },
} as const;

const COMBINED_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tripSummary: { type: Type.STRING },
    advisories: ADVISORIES_SCHEMA,
    items: { type: Type.ARRAY, items: ITEM_SCHEMA },
  },
  required: ['items'],
} as const;

const ITEMS_ONLY_SCHEMA = {
  type: Type.ARRAY,
  items: ITEM_SCHEMA,
} as const;

const METADATA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tripSummary: { type: Type.STRING },
    advisories: ADVISORIES_SCHEMA,
  },
  required: ['tripSummary', 'advisories'],
} as const;

// ---------------------------------------------------------------------------
// 타임아웃 유틸
// ---------------------------------------------------------------------------
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${ms}ms timeout`)), ms),
    ),
  ]);
}

// 장소명 유틸은 utils/placeName.ts에서 import (위 참조)

// ---------------------------------------------------------------------------
// Gemini 호출 — Grounding + Schema 강제
// ---------------------------------------------------------------------------
async function callGemini(
  systemPrompt: string,
  userContent: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseSchema: any,
  options?: { useGrounding?: boolean; model?: string },
  _retryCount = 0,
): Promise<unknown> {
  const ai = getGeminiClient();
  const model = options?.model || getProModel();
  const supportsGrounding = model.includes('3-flash') || model.includes('3.1-flash');

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: 32768,  // 4~7일 일정은 8192 부족 → 32K로
        ...(options?.useGrounding && supportsGrounding
          ? { tools: [{ googleSearch: {} }] }
          : {}),
      },
    });
  } catch (err) {
    // 429 rate limit → 키 로테이션 후 재시도
    const errMsg = err instanceof Error ? err.message : String(err);
    if ((errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) && _retryCount < getGeminiKeyCount()) {
      const rotated = rotateGeminiKey();
      if (rotated) {
        console.warn(`[Gemini] 429 → 키 로테이션 후 재시도 (${_retryCount + 1}/${getGeminiKeyCount()})`);
        await new Promise(r => setTimeout(r, 2000)); // 2초 대기
        return callGemini(systemPrompt, userContent, responseSchema, options, _retryCount + 1);
      }
    }
    throw err;
  }

  const text = response.text;
  if (!text) throw new Error('Gemini returned empty response');
  return JSON.parse(text);
}

/**
 * Gemini 2단계 재시도:
 * 1. 메인 모델 (Grounding은 호환 모델만) — 120초
 * 2. Flash-Lite fallback — 60초
 *
 * Grounding 호환성:
 * - gemini-3-flash-preview: responseMimeType + tools 동시 지원 ✅
 * - gemini-2.5-flash: responseMimeType + tools 동시 미지원 ❌ → Grounding OFF
 * - gemini-2.5-flash-lite: Grounding 미지원 ❌
 */
async function callGeminiWithRetry(
  systemPrompt: string,
  userContent: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseSchema: any,
): Promise<unknown> {
  const mainModel = getProModel();
  // 2.5-flash 계열은 responseMimeType + Grounding 동시 사용 불가 → Grounding OFF
  const supportsGrounding = mainModel.includes('3-flash') || mainModel.includes('3.1-flash');

  // Layer 1: 메인 모델 (Grounding은 지원하는 모델만)
  try {
    const start = Date.now();
    const result = await withTimeout(
      callGemini(systemPrompt, userContent, responseSchema, {
        useGrounding: supportsGrounding,
        model: mainModel,
      }),
      120_000,
    );
    console.log(`[Gemini] ✓ Layer1 ${mainModel}${supportsGrounding ? '+Grounding' : ''} 성공 ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  } catch (err) {
    console.warn(`[Gemini] ✗ Layer1 ${mainModel} 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Layer 2: Flash-Lite fallback (Grounding 없음, 빠름)
  const fallbackModel = getFlashModel();
  if (fallbackModel !== mainModel) {
    try {
      await new Promise(r => setTimeout(r, 1000));
      const start = Date.now();
      const result = await withTimeout(
        callGemini(systemPrompt, userContent, responseSchema, {
          useGrounding: false,
          model: fallbackModel,
        }),
        60_000,
      );
      console.log(`[Gemini] ✓ Layer2 ${fallbackModel} 성공 ${((Date.now() - start) / 1000).toFixed(1)}s`);
      return result;
    } catch (err) {
      console.warn(`[Gemini] ✗ Layer2 ${fallbackModel} 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Gemini provider: 모든 레이어 실패 (${mainModel} → ${fallbackModel})`);
}

// ---------------------------------------------------------------------------
// AIGeneratedItem[] → TripItem[] 변환 (claude.provider.ts와 동일)
// toTripItems는 utils/tripItemMapper.ts에서 import (위 참조)

// ---------------------------------------------------------------------------
// Gemini 스트리밍 호출 — generateContentStream
// ---------------------------------------------------------------------------
async function* callGeminiStream(
  systemPrompt: string,
  userContent: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseSchema: any,
): AsyncGenerator<StreamChunk> {
  const model = getProModel();
  const supportsGrounding = model.includes('3-flash') || model.includes('3.1-flash');

  yield { type: 'progress', message: '🔍 AI가 실시간 정보를 검색하고 있습니다...' };

  // 429 시 키 로테이션 (최대 키 수만큼 재시도)
  let response;
  const maxRetries = getGeminiKeyCount();
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = getGeminiClient();
      response = await ai.models.generateContentStream({
        model,
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema,
          maxOutputTokens: 32768,
          ...(supportsGrounding ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });
      break; // 성공
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if ((errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) && attempt < maxRetries - 1) {
        const rotated = rotateGeminiKey();
        if (rotated) {
          console.warn(`[Gemini Stream] 429 → 키 로테이션 후 재시도 (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
      throw err;
    }
  }
  if (!response) throw new Error('Gemini stream: 모든 키 소진');

  let accumulated = '';
  let chunkCount = 0;

  for await (const chunk of response) {
    chunkCount++;
    accumulated += chunk.text ?? '';

    // Grounding metadata 전달
    const groundingMeta = chunk.candidates?.[0]?.groundingMetadata;
    if (groundingMeta?.groundingChunks) {
      const sources = groundingMeta.groundingChunks
        .filter((gc: { web?: { title?: string; uri?: string } }) => gc.web?.uri)
        .map((gc: { web?: { title?: string; uri?: string } }) => ({
          title: gc.web?.title ?? '',
          url: gc.web?.uri ?? '',
        }));
      if (sources.length > 0) {
        yield { type: 'grounding', sources };
      }
    }

    // 진행률 메시지
    if (chunkCount % 5 === 0) {
      yield {
        type: 'progress',
        message: `✨ 일정을 생성하고 있습니다... (${Math.round(accumulated.length / 100)}% 추정)`,
      };
    }
  }

  if (!accumulated) throw new Error('Gemini streaming returned empty');

  // 최종 파싱
  try {
    const parsed = JSON.parse(accumulated);
    yield { type: 'progress', message: '✅ AI 생성 완료, 검증 중...' };
    yield { type: 'stream_result', data: parsed };
  } catch (e) {
    throw new Error(`Gemini streaming JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ---------------------------------------------------------------------------
// Provider 구현
// ---------------------------------------------------------------------------
export const geminiProvider: AIProviderStreaming = {
  // --- 비스트리밍 (기존 AIProvider 인터페이스) ---
  async generateItinerary(
    profile: FullProfileInput,
    input: GenerateInput,
    placePreferences?: PlacePreferenceInput[],
    verifiedPlaces?: VerifiedPlace[],
  ): Promise<AIGenerateResult> {
    const stamina = profile.lifestyle?.stamina || 'moderate';
    const dayCount = getDayCount(input.startDate, input.endDate);
    const systemPrompt = buildSystemPrompt('gemini');

    // --- v2 파이프라인: 모든 일수에서 날마다 생성 + 즉시 검증 + 부분 재생성 ---
    const allItems: AIGeneratedItem[] = [];
    const previousPlaces: string[] = [];
    let failedDays = 0;

    for (let day = 1; day <= dayCount; day++) {
      if (day > 1) await new Promise(r => setTimeout(r, 1500));

      const dayPrompt = buildSingleDayPrompt(
        profile, input, day, dayCount,
        previousPlaces, placePreferences, verifiedPlaces,
      );

      console.log(`[Gemini] Day ${day}/${dayCount} 생성 요청`);

      try {
        let dayItems = await callGeminiWithRetry(
          systemPrompt, dayPrompt, ITEMS_ONLY_SCHEMA,
        ) as AIGeneratedItem[];

        // ② 즉시 검증
        let issues = validateDay(dayItems, day, {
          stamina: profile.lifestyle?.stamina,
          arrivalTime: profile.arrivalTime,
        }, dayCount);

        // ③ 부분 재생성 (문제 있으면 1회 시도)
        if (issues.length > 0) {
          console.log(`[Gemini] Day ${day} 검증 실패 (${issues.length}건): ${issues.map(i => i.type).join(', ')} → repair 시도`);
          try {
            const repairPrompt = buildRepairPrompt(
              dayItems.map(i => ({
                placeNameSnapshot: i.placeNameSnapshot,
                category: i.category,
                startTime: i.startTime,
                endTime: i.endTime,
              })),
              issues,
              day,
              input.destination,
            );
            const repaired = await callGeminiWithRetry(
              systemPrompt, repairPrompt, ITEMS_ONLY_SCHEMA,
            ) as AIGeneratedItem[];

            if (repaired && repaired.length > 0) {
              dayItems = repaired;
              console.log(`[Gemini] Day ${day} repair 성공 (${repaired.length}개 아이템)`);
            }
          } catch (repairErr) {
            console.warn(`[Gemini] Day ${day} repair 실패:`, repairErr instanceof Error ? repairErr.message : repairErr);
          }

          // 재검증
          issues = validateDay(dayItems, day, {
            stamina: profile.lifestyle?.stamina,
            arrivalTime: profile.arrivalTime,
          }, dayCount);
        }

        // ④ 최종 fallback: 식사 누락만 augment
        const mealIssues = issues.filter(i => i.type === 'missing_lunch' || i.type === 'missing_dinner');
        if (mealIssues.length > 0) {
          console.log(`[Gemini] Day ${day} 식사 누락 ${mealIssues.length}건 → augment fallback`);
          // augmentMissingMeals는 전체 items에 대해 동작하므로 나중에 일괄 처리
        }

        allItems.push(...dayItems);
        for (const item of dayItems) previousPlaces.push(item.placeNameSnapshot);
      } catch (err) {
        console.warn(`[Gemini] Day ${day} 실패:`, err instanceof Error ? err.message : err);
        failedDays++;
      }
    }

    if (allItems.length === 0) throw new Error(`Gemini: ${dayCount}일 전체 실패`);
    if (failedDays > 0) console.warn(`[Gemini] ${dayCount}일 중 ${failedDays}일 실패`);

    // 중복 제거 + 시간순 정렬 + 시간 겹침 해소
    const seenNormalized: string[] = [];
    const dedupedItems = allItems.filter((item) => {
      const n = normalizePlaceName(item.placeNameSnapshot);
      if (seenNormalized.some((s) => isFuzzyDuplicate(s, n))) return false;
      seenNormalized.push(n);
      return true;
    });

    dedupedItems.sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.startTime.localeCompare(b.startTime);
    });

    const timeValidated = resolveTimeOverlaps(dedupedItems);

    const dayCounters: Record<number, number> = {};
    for (const item of timeValidated) {
      dayCounters[item.dayNumber] = dayCounters[item.dayNumber] ?? 0;
      item.orderIndex = dayCounters[item.dayNumber]++;
      if (item.orderIndex === 0) {
        item.transitMode = null;
        item.transitDurationMin = null;
        item.transitSummary = null;
      }
    }

    const items = toTripItems(timeValidated, stamina);

    // 메타데이터 별도 호출
    let tripSummary: string | undefined;
    let advisories: TripAdvisories | undefined;
    try {
      const metadataPrompt = buildMetadataPrompt(
        input.destination, input.startDate, input.endDate, previousPlaces,
      );
      const meta = await callGeminiWithRetry(
        systemPrompt, metadataPrompt, METADATA_SCHEMA,
      ) as { tripSummary: string; advisories: TripAdvisories };
      tripSummary = meta.tripSummary;
      advisories = meta.advisories;
    } catch (err) {
      console.warn('[Gemini] 메타데이터 생성 실패 (graceful skip):', err instanceof Error ? err.message : err);
    }

    return { items, tripSummary, advisories };
  },

  // --- 스트리밍 (AIProviderStreaming 인터페이스) ---
  async *generateItineraryStream(
    profile: FullProfileInput,
    input: GenerateInput,
    placePreferences?: PlacePreferenceInput[],
    verifiedPlaces?: VerifiedPlace[],
  ): AsyncGenerator<StreamChunk> {
    const stamina = profile.lifestyle?.stamina || 'moderate';
    const dayCount = getDayCount(input.startDate, input.endDate);
    const systemPrompt = buildSystemPrompt('gemini');

    yield { type: 'progress', message: `📋 ${dayCount}일 여행 일정을 생성합니다...` };

    // ≤4일: 단일 스트리밍 호출
    if (dayCount <= 4) {
      const userPrompt = buildUserPrompt(profile, input, placePreferences, verifiedPlaces);
      let parsed: { items: AIGeneratedItem[]; tripSummary?: string; advisories?: TripAdvisories } | null = null;

      // 스트리밍 진행률 yield + stream_result 캡처
      const streamGen = callGeminiStream(systemPrompt, userPrompt, COMBINED_RESPONSE_SCHEMA);
      for await (const chunk of streamGen) {
        if (chunk.type === 'stream_result') {
          parsed = (chunk as { type: string; data: typeof parsed }).data;
        } else {
          yield chunk;
        }
      }

      if (!parsed) {
        // 스트리밍 파싱 실패 시 비스트리밍 폴백 (1회만)
        try {
          parsed = await callGeminiWithRetry(
            systemPrompt, userPrompt, COMBINED_RESPONSE_SCHEMA,
          ) as { items: AIGeneratedItem[]; tripSummary?: string; advisories?: TripAdvisories };
        } catch {
          throw new Error('Gemini 스트리밍 + 폴백 모두 실패');
        }
      }

      yield {
        type: 'complete',
        result: {
          items: toTripItems(parsed.items, stamina),
          tripSummary: parsed.tripSummary,
          advisories: parsed.advisories,
        },
      };
      return;
    }

    // ≥5일: Day별 호출 (각 day 완료 시 progress yield)
    const allItems: AIGeneratedItem[] = [];
    const previousPlaces: string[] = [];

    for (let day = 1; day <= dayCount; day++) {
      if (day > 1) await new Promise(r => setTimeout(r, 1500));

      yield { type: 'progress', message: `📅 Day ${day}/${dayCount} 생성 중...` };

      const dayPrompt = buildSingleDayPrompt(
        profile, input, day, dayCount,
        previousPlaces, placePreferences, verifiedPlaces,
      );

      try {
        const dayItems = await callGeminiWithRetry(
          systemPrompt, dayPrompt, ITEMS_ONLY_SCHEMA,
        ) as AIGeneratedItem[];

        allItems.push(...dayItems);
        for (const item of dayItems) previousPlaces.push(item.placeNameSnapshot);

        // 부분 아이템 전달
        for (const item of dayItems) {
          yield { type: 'partial_item', item };
        }
      } catch (err) {
        yield { type: 'progress', message: `⚠️ Day ${day} 생성 실패, 건너뜁니다` };
        console.warn(`[Gemini Stream] Day ${day} 실패:`, err instanceof Error ? err.message : err);
      }
    }

    if (allItems.length === 0) throw new Error(`Gemini Stream: ${dayCount}일 전체 실패`);

    yield { type: 'progress', message: '🔄 일정 최적화 중...' };

    // 중복 제거 + 정렬 + 시간 겹침 해소
    const seenNormalized: string[] = [];
    const dedupedItems = allItems.filter((item) => {
      const n = normalizePlaceName(item.placeNameSnapshot);
      if (seenNormalized.some((s) => isFuzzyDuplicate(s, n))) return false;
      seenNormalized.push(n);
      return true;
    });

    dedupedItems.sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.startTime.localeCompare(b.startTime);
    });

    const timeValidated = resolveTimeOverlaps(dedupedItems);
    const dayCounters: Record<number, number> = {};
    for (const item of timeValidated) {
      dayCounters[item.dayNumber] = dayCounters[item.dayNumber] ?? 0;
      item.orderIndex = dayCounters[item.dayNumber]++;
      if (item.orderIndex === 0) {
        item.transitMode = null;
        item.transitDurationMin = null;
        item.transitSummary = null;
      }
    }

    const items = toTripItems(timeValidated, stamina);

    // 메타데이터
    let tripSummary: string | undefined;
    let advisories: TripAdvisories | undefined;
    try {
      yield { type: 'progress', message: '📝 여행 요약 생성 중...' };
      const metadataPrompt = buildMetadataPrompt(
        input.destination, input.startDate, input.endDate, previousPlaces,
      );
      const meta = await callGeminiWithRetry(
        systemPrompt, metadataPrompt, METADATA_SCHEMA,
      ) as { tripSummary: string; advisories: TripAdvisories };
      tripSummary = meta.tripSummary;
      advisories = meta.advisories;
    } catch (err) {
      console.warn('[Gemini Stream] 메타데이터 실패:', err instanceof Error ? err.message : err);
    }

    yield {
      type: 'complete',
      result: { items, tripSummary, advisories },
    };
  },
};
