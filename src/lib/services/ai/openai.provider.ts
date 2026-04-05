import OpenAI from 'openai';
import type { TripItem, TripAdvisories } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { AIProvider, AIGenerateResult, GenerateInput, AIGeneratedItem, PlacePreferenceInput, VerifiedPlace } from './types';
import { buildSystemPrompt, buildUserPrompt, buildChunkPrompt, buildMetadataPrompt, isGatewayMode, isReasoningModel } from './prompt';
import type { DayChunk } from './prompt';
import { parseAIResponse, parseCombinedResponse, parseMetadataResponse, filterByStamina } from './parseResponse';
import { resolveTimeOverlaps } from './itineraryValidation';
import { generateId } from '@/utils/id';
import { getDayCount } from '@/utils/date';

/** 장소명 정규화 — 중복 비교용 */
function normalizePlaceName(name: string): string {
  return name
    .replace(/\s*[\(（].*?[\)）]\s*/g, '')
    .replace(/[\s\-·・]/g, '')
    .toLowerCase();
}

/** 부분 문자열 포함 관계로 유사 장소 판별 */
function isFuzzyDuplicate(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
}

/** OpenAI 클라이언트 지연 초기화 — AI_PROVIDER=claude일 때 모듈 로드 crash 방지 */
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다');
    _client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      timeout: 120_000,
      maxRetries: 0,
    });
  }
  return _client;
}

/** 메시지 빌드 (게이트웨이: system role 미지원 → user 1개로 합침) */
function buildMessages(
  systemPrompt: string,
  userPrompt: string,
): OpenAI.ChatCompletionMessageParam[] {
  return isGatewayMode()
    ? [{ role: 'user', content: `${systemPrompt}\n\n---\n\n${userPrompt}` }]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
}

/** 타임아웃 레이스 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${ms}ms timeout`)), ms),
    ),
  ]);
}

/** 스트리밍 API 호출 (reasoning 모델 자동 분기) */
async function callOpenAIStreaming(
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxCompletionTokens: number,
  reasoningEffort?: 'low' | 'medium' | 'high',
): Promise<string> {
  const isReasoning = isReasoningModel(model);

  const stream = await getClient().chat.completions.create({
    model,
    messages,
    stream: true,
    ...(isReasoning
      ? {
          max_completion_tokens: maxCompletionTokens,
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        }
      : { max_tokens: maxCompletionTokens, temperature: 0.7 }),
  });

  let content = '';
  let reasoningContent = '';
  let chunkCount = 0;
  for await (const chunk of stream) {
    chunkCount++;
    const choice = chunk.choices[0];
    const delta = choice?.delta?.content;
    if (delta) content += delta;
    // reasoning 모델은 reasoning_content 필드에 사고 과정을 출력할 수 있음
    const reasoning = (choice?.delta as Record<string, unknown>)?.reasoning_content;
    if (typeof reasoning === 'string') reasoningContent += reasoning;
  }
  if (!content) {
    const info = `chunks=${chunkCount}, reasoning_len=${reasoningContent.length}`;
    throw new Error(`Streaming returned empty (${info})`);
  }
  return content;
}

/** primary 모델 시도 → 실패 시 fallback 모델 자동 전환 */
async function callWithFallback(
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
): Promise<string> {
  const primaryModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-5-mini';
  const messages = buildMessages(systemPrompt, userPrompt);

  // Layer 1: primary 모델 (reasoning_effort: medium, 55초 타임아웃)
  try {
    const start = Date.now();
    const result = await withTimeout(
      callOpenAIStreaming(primaryModel, messages, maxCompletionTokens, 'medium'),
      55_000,
    );
    console.log(`[AI] ✓ Layer1 성공: ${primaryModel} (reasoning_effort:medium) ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  } catch (err) {
    console.warn(
      `[AI] ✗ Layer1 실패: ${primaryModel} (${err instanceof Error ? err.message : String(err)}), Layer1.5 재시도`,
    );
  }

  // Layer 1.5: 같은 모델 reasoning_effort:low 재시도 (1초 대기 후)
  try {
    await new Promise(r => setTimeout(r, 1000));
    const start15 = Date.now();
    const result = await withTimeout(
      callOpenAIStreaming(primaryModel, messages, maxCompletionTokens, 'low'),
      55_000,
    );
    console.log(`[AI] ✓ Layer1.5 성공: ${primaryModel} (reasoning_effort:low) ${((Date.now() - start15) / 1000).toFixed(1)}s`);
    return result;
  } catch (err15) {
    console.warn(`[AI] ✗ Layer1.5 실패: ${primaryModel} low (${err15 instanceof Error ? err15.message : String(err15)}), Layer2 ${fallbackModel}로 전환`);
  }

  // Layer 2: fallback 모델 (reasoning_effort:low, streaming → 빠른 폴백)
  const start = Date.now();
  const result = await callOpenAIStreaming(
    fallbackModel,
    messages,
    Math.min(maxCompletionTokens, 4000),
    'low',
  );
  console.log(`[AI] ✓ Layer2 성공: ${fallbackModel} (reasoning_effort:low) ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return result;
}

/** 단일 API 호출 (직접 API 모드 — 비-게이트웨이용) */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const messages = buildMessages(systemPrompt, userPrompt);

  const response = await getClient().chat.completions.create({
    model,
    messages,
    ...(isReasoningModel(model)
      ? { max_completion_tokens: maxCompletionTokens }
      : { max_tokens: maxCompletionTokens, temperature: 0.7 }),
  }).catch((err) => {
    throw new Error(`OpenAI API 호출 실패: ${err instanceof Error ? err.message : String(err)}`);
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    const finishReason = response.choices[0]?.finish_reason;
    const usage = response.usage;
    throw new Error(
      `OpenAI returned empty response (finish_reason=${finishReason}, ` +
      `reasoning_tokens=${usage?.completion_tokens_details?.reasoning_tokens ?? '?'}, ` +
      `completion_tokens=${usage?.completion_tokens ?? '?'})`,
    );
  }
  return content;
}

/** 결과를 TripItem[]으로 변환 */
function toTripItems(rawItems: AIGeneratedItem[], stamina: string): TripItem[] {
  const items = filterByStamina(rawItems, stamina as 'high' | 'moderate' | 'low');
  return items.map((item: AIGeneratedItem) => ({
    id: generateId('item'),
    tripId: '',
    placeId: '',
    createdAt: new Date().toISOString(),
    ...item,
    reasonTags: item.reasonTags || [],
    verified: item.verified ?? true,
    googlePlaceId: item.googlePlaceId ?? null,
    subActivities: null,
  }));
}

export const openaiProvider: AIProvider = {
  async generateItinerary(
    profile: FullProfileInput,
    input: GenerateInput,
    placePreferences?: PlacePreferenceInput[],
    verifiedPlaces?: VerifiedPlace[],
  ): Promise<AIGenerateResult> {
    const stamina = profile.lifestyle?.stamina || 'moderate';
    const dayCount = getDayCount(input.startDate, input.endDate);

    // 게이트웨이 모드: 청크 분할 (하루를 오전/오후로 나눠 요청 → 합침)
    // reasoning 모델(gpt-5-mini)은 max_completion_tokens의 대부분을 사고에 소비하므로
    // 요청 단위를 작게 쪼개야 60초 게이트웨이 타임아웃 안에 응답 가능
    if (isGatewayMode()) {
      const compactSystem = buildSystemPrompt(false);
      const allItems: AIGeneratedItem[] = [];
      const previousPlaces: string[] = []; // 전체 여행에서 이미 나온 장소
      let failedChunks = 0;
      const totalChunks = dayCount * 2;

      for (let day = 1; day <= dayCount; day++) {
        const dayPreviousItems: Array<{name: string, endTime: string}> = []; // 같은 날 오전에서 나온 장소
        const chunks: DayChunk[] = ['morning', 'afternoon'];

        for (const chunk of chunks) {
          // 첫 번째 청크가 아닌 경우 딜레이 (게이트웨이 rate limit 회피)
          if (day > 1 || chunk !== 'morning') {
            await new Promise(r => setTimeout(r, 1500));
          }

          // previousPlaces 최근 5개만 전달 (프롬프트 토큰 절감)
          const recentPlaces = previousPlaces.slice(-5);
          const prevNames = dayPreviousItems.map(d => d.name);
          const lastEndTime = dayPreviousItems.length > 0
            ? dayPreviousItems[dayPreviousItems.length - 1].endTime : undefined;

          const chunkPrompt = buildChunkPrompt(
            profile, input, day, dayCount, chunk,
            recentPlaces, prevNames,
            placePreferences, verifiedPlaces,
            lastEndTime,
          );

          console.log(`[AI] 청크 요청: Day ${day}/${dayCount} ${chunk}`);

          let chunkItems: AIGeneratedItem[] | null = null;

          // 1차 시도
          try {
            const content = await callWithFallback(compactSystem, chunkPrompt, 10000);
            chunkItems = parseAIResponse(content);
          } catch (err) {
            console.warn(`[AI] Day ${day} ${chunk} 1차 실패:`, err instanceof Error ? err.message : err);
            // 2초 대기 후 1회 재시도
            await new Promise(r => setTimeout(r, 2000));
            try {
              const content = await callWithFallback(compactSystem, chunkPrompt, 10000);
              chunkItems = parseAIResponse(content);
              console.log(`[AI] Day ${day} ${chunk} 재시도 성공`);
            } catch (retryErr) {
              console.warn(`[AI] Day ${day} ${chunk} 최종 실패:`, retryErr instanceof Error ? retryErr.message : retryErr);
              failedChunks++;
            }
          }

          if (chunkItems) {
            allItems.push(...chunkItems);
            for (const item of chunkItems) {
              previousPlaces.push(item.placeNameSnapshot);
              dayPreviousItems.push({ name: item.placeNameSnapshot, endTime: item.endTime });
            }
          }
        }
      }

      // 중복 제거 (퍼지 매칭: 부분 문자열 포함 관계도 중복으로 판별)
      const seenNormalized: string[] = [];
      const dedupedItems = allItems.filter((item) => {
        const normalized = normalizePlaceName(item.placeNameSnapshot);
        if (seenNormalized.some((seen) => isFuzzyDuplicate(seen, normalized))) return false;
        seenNormalized.push(normalized);
        return true;
      });

      // 시간순 정렬
      dedupedItems.sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        return a.startTime.localeCompare(b.startTime);
      });

      // 시간 중복 제거 (오전/오후 청크 조립 결함 방지)
      const timeValidated = resolveTimeOverlaps(dedupedItems);

      // orderIndex 재할당
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

      if (timeValidated.length > 0) {
        if (failedChunks > 0) {
          console.warn(`[AI] ${totalChunks}개 청크 중 ${failedChunks}개 실패`);
        }

        const items = toTripItems(timeValidated, stamina);

        // 메타데이터 별도 생성 (경량 호출, 실패 시 graceful degradation)
        let tripSummary: string | undefined;
        let advisories: TripAdvisories | undefined;
        try {
          const metadataPrompt = buildMetadataPrompt(
            input.destination, input.startDate, input.endDate, previousPlaces,
          );
          const metaContent = await callWithFallback(compactSystem, metadataPrompt, 2000);
          const metadata = parseMetadataResponse(metaContent);
          if (metadata) {
            tripSummary = metadata.tripSummary;
            advisories = metadata.advisories;
          }
        } catch (err) {
          console.warn('[AI] 메타데이터 생성 실패 (graceful skip):', err instanceof Error ? err.message : err);
        }

        return { items, tripSummary, advisories };
      }

      throw new Error(`게이트웨이 타임아웃: ${totalChunks}개 청크 전부 실패`);
    }

    // 직접 API 모드 또는 1일 여행: 전체 한번에 요청 (combined response)
    const systemPrompt = buildSystemPrompt(isGatewayMode());
    const userPrompt = buildUserPrompt(profile, input, placePreferences, verifiedPlaces);
    const content = await callOpenAI(systemPrompt, userPrompt, 16000);
    const { items: rawItems, metadata } = parseCombinedResponse(content);
    return {
      items: toTripItems(rawItems, stamina),
      tripSummary: metadata?.tripSummary,
      advisories: metadata?.advisories,
    };
  },
};
