/**
 * v3 Audit 2nd Call — 의미 검증
 *
 * 코드(validateDay)가 하는 구조 검증이 아닌, LLM만 가능한 의미 검증 6가지:
 * 1. MEAL QUALITY — 디저트/간식이 식사 slot에 있는가
 * 2. DIETARY SAFETY — 식당 타입이 식이제한에 위험한가
 * 3. TRANSIT REALISM — 도보 >15min이면 SUSPECT
 * 4. CHAIN FILTER — local-only 요청인데 체인 존재하는가
 * 5. PLACE CONFIDENCE — 확실하지 않은 장소 플래그
 * 6. INTEREST TAG HONESTY — 억지 매칭 태그 제거
 *
 * 문제 발견 시 자동 수정한 items를 반환. 실패 시 원본 유지 (graceful).
 */

import { Type } from '@google/genai';
import type { TripItem } from '@/types/database';
import type { AuditIssue, AuditResult } from './types';
import { getGeminiLiteModel, estimateCost } from '../models';
import { getGeminiClient, rotateGeminiKey, getGeminiKeyCount } from '../utils/geminiClient';

// ---------------------------------------------------------------------------
// Audit Response Schema (Gemini responseSchema)
// ---------------------------------------------------------------------------

const AUDIT_ISSUE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    check: { type: Type.INTEGER, description: 'Check number 1-6' },
    item: { type: Type.STRING, description: 'Place name of the problematic item' },
    issue: { type: Type.STRING, description: 'What is wrong' },
    fix: { type: Type.STRING, description: 'What was changed to fix it' },
  },
  required: ['check', 'item', 'issue', 'fix'],
};

// Audit item schema — TripItem의 핵심 필드만 (audit이 수정할 수 있는 것)
const AUDIT_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dayNumber: { type: Type.INTEGER },
    orderIndex: { type: Type.INTEGER },
    placeNameSnapshot: { type: Type.STRING },
    category: { type: Type.STRING },
    startTime: { type: Type.STRING },
    endTime: { type: Type.STRING },
    estimatedCost: { type: Type.INTEGER },
    currency: { type: Type.STRING },
    priceConfidence: { type: Type.STRING },
    placeConfidence: { type: Type.STRING, nullable: true },
    notes: { type: Type.STRING },
    latitude: { type: Type.NUMBER, nullable: true },
    longitude: { type: Type.NUMBER, nullable: true },
    reasonTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    address: { type: Type.STRING, nullable: true },
    businessHours: { type: Type.STRING, nullable: true },
    closedDays: { type: Type.STRING, nullable: true },
    transitMode: { type: Type.STRING, nullable: true },
    transitDurationMin: { type: Type.INTEGER, nullable: true },
    transitSummary: { type: Type.STRING, nullable: true },
  },
  required: ['dayNumber', 'orderIndex', 'placeNameSnapshot', 'category', 'startTime', 'endTime'],
};

const AUDIT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    auditIssues: { type: Type.ARRAY, items: AUDIT_ISSUE_SCHEMA },
    items: { type: Type.ARRAY, items: AUDIT_ITEM_SCHEMA },
  },
  required: ['auditIssues', 'items'],
};

// ---------------------------------------------------------------------------
// Audit Prompt Builders
// ---------------------------------------------------------------------------

interface AuditProfile {
  dietRestrictions: string[];
  restaurantPref?: string;  // 'local-only' | 'no-preference'
  interests: string[];
}

function buildAuditSystemPrompt(): string {
  return `You are a travel itinerary quality auditor.
Review the itinerary and check ONLY the following semantic issues that code cannot detect.
For each check, PRINT the actual values. Do not say "looks good" without evidence.

CHECK 1 — MEAL QUALITY
For each item in a lunch (11:00-14:30) or dinner (17:00-21:30) slot, verify it serves a REAL meal:
A "real meal" = 정식, 세트메뉴, 덮밥, 면류, 고기요리 등
NOT a meal = 떡, 과자, 빵, 디저트, 아이스크림, 커피만 파는 곳, 길거리 간식
If NOT a meal is in a lunch/dinner slot → replace with a real restaurant.

CHECK 2 — DIETARY SAFETY
For each restaurant/cafe AND any attraction involving food (야타이, 시장, 푸드코트):
Evaluate if the cuisine TYPE commonly includes the restricted food.
RISKY examples: izakaya/soba/kaiseki for no-seafood, BBQ for vegetarian.
If RISKY → replace with a safer restaurant type. Do NOT just add "해산물 제외 가능" in notes — actually replace the restaurant.

CHECK 3 — TRANSIT REALISM
For each walking transit: if > 15min, flag as SUSPECT (likely should be bus/taxi).
For inter-city transit: verify the mode and duration are realistic.

CHECK 4 — CHAIN RESTAURANT FILTER
If restaurant_preference is "local-only": any chain/franchise (이치란, 스타벅스, 요시노야, CoCo壱番屋, etc.) → replace with a local independent restaurant.
If "no-preference": flag if > 2 chains in the entire trip.

CHECK 5 — INTEREST TAG HONESTY
For each interest tag matched to a place, verify it is GENUINELY relevant:
FORCED examples: "beach" matched to 海地獄, "anime" matched to unrelated place, "shopping-vintage" matched to generic mall.
If FORCED → remove the tag from reasonTags. If no genuine match exists, that's OK — do not force-match.

CHECK 6 — PLACE CONFIDENCE
For each restaurant/cafe: Am I certain this exact place exists at this location?
If UNSURE → set placeConfidence: "unverified" and consider replacing with a well-known establishment.

OUTPUT: Return JSON with "auditIssues" array listing all problems found and fixes applied, and "items" array with the COMPLETE corrected itinerary.
If no issues found, return empty auditIssues and the original items unchanged.`;
}

function buildAuditUserPrompt(
  items: TripItem[],
  profile: AuditProfile,
  destination: string,
): string {
  // items를 경량화 — audit에 불필요한 필드(id, tripId, placeId, createdAt) 제거
  const lightItems = items.map(item => ({
    dayNumber: item.dayNumber,
    orderIndex: item.orderIndex,
    placeNameSnapshot: item.placeNameSnapshot,
    category: item.category,
    startTime: item.startTime,
    endTime: item.endTime,
    estimatedCost: item.estimatedCost,
    currency: item.currency,
    priceConfidence: item.priceConfidence,
    placeConfidence: (item as unknown as Record<string, unknown>).placeConfidence || null,
    notes: item.notes,
    latitude: item.latitude,
    longitude: item.longitude,
    verified: item.verified,
    reasonTags: item.reasonTags,
    address: item.address,
    businessHours: item.businessHours,
    closedDays: item.closedDays,
    transitMode: item.transitMode,
    transitDurationMin: item.transitDurationMin,
    transitSummary: item.transitSummary,
  }));

  const context: Record<string, unknown> = {
    destination,
    diet_restrictions: profile.dietRestrictions.length > 0 ? profile.dietRestrictions : 'none',
    restaurant_preference: profile.restaurantPref || 'no-preference',
    interests: profile.interests.length > 0 ? profile.interests : 'none',
  };

  return `Audit this ${destination} itinerary.\n\n${JSON.stringify(context, null, 2)}\n\nItinerary:\n${JSON.stringify(lightItems, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Audit 실행
// ---------------------------------------------------------------------------

export async function auditItinerary(
  items: TripItem[],
  profile: AuditProfile,
  destination: string,
): Promise<AuditResult> {
  const systemPrompt = buildAuditSystemPrompt();
  const userPrompt = buildAuditUserPrompt(items, profile, destination);

  // lite 모델 사용 — audit은 비용 절약이 중요 (메인 생성보다 부차적)
  const model = getGeminiLiteModel();
  const maxRetries = getGeminiKeyCount();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: AUDIT_RESPONSE_SCHEMA,
          maxOutputTokens: 65536,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Audit: Gemini returned empty');

      const parsed = JSON.parse(text) as {
        auditIssues: AuditIssue[];
        items: Array<Record<string, unknown>>;
      };

      // 비용 로깅
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usage = (response as any).usageMetadata as Record<string, number> | undefined;
      const inputTokens = usage?.promptTokenCount ?? usage?.inputTokens ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? usage?.outputTokens ?? 0;
      const cost = estimateCost(model, inputTokens, outputTokens);
      console.log(
        `[v3 Audit] ${parsed.auditIssues.length}개 이슈 발견 (${model}) | ${inputTokens} in + ${outputTokens} out = $${cost.totalCost.toFixed(4)}`,
      );

      if (parsed.auditIssues.length > 0) {
        for (const issue of parsed.auditIssues) {
          console.log(`  [Audit] CHECK ${issue.check}: ${issue.item} — ${issue.issue} → ${issue.fix}`);
        }
      }

      // 수정된 items 반환 — audit이 반환한 items에 원본의 id/tripId/placeId/createdAt 복원
      const correctedItems = mergeAuditItems(items, parsed.items);

      return {
        issues: parsed.auditIssues,
        items: correctedItems,
      };
    } catch (err) {
      const isRateLimit = err instanceof Error && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));
      if (isRateLimit && rotateGeminiKey()) {
        console.warn(`[v3 Audit] 429 → 키 로테이션 (attempt ${attempt + 1})`);
        continue;
      }
      throw err;
    }
  }

  // 모든 키 소진 — 원본 반환
  console.warn('[v3 Audit] 모든 키 소진, 원본 유지');
  return { issues: [], items };
}

/**
 * audit이 반환한 경량 items에 원본의 메타데이터(id, tripId, placeId, createdAt)를 복원.
 * audit이 장소를 교체한 경우 새 아이템으로 대체되되 메타 필드는 유지.
 */
function mergeAuditItems(
  originals: TripItem[],
  audited: Array<Record<string, unknown>>,
): TripItem[] {
  // dayNumber + orderIndex 기준으로 매핑
  const origMap = new Map<string, TripItem>();
  for (const item of originals) {
    origMap.set(`${item.dayNumber}-${item.orderIndex}`, item);
  }

  return audited.map(a => {
    const key = `${a.dayNumber}-${a.orderIndex}`;
    const orig = origMap.get(key);

    return {
      // 메타 필드는 원본에서
      id: orig?.id || '',
      tripId: orig?.tripId || '',
      placeId: orig?.placeId || '',
      createdAt: orig?.createdAt || new Date().toISOString(),
      // 나머지는 audit 결과에서 (없으면 원본 fallback)
      dayNumber: (a.dayNumber as number) ?? orig?.dayNumber ?? 1,
      orderIndex: (a.orderIndex as number) ?? orig?.orderIndex ?? 0,
      placeNameSnapshot: (a.placeNameSnapshot as string) ?? orig?.placeNameSnapshot ?? '',
      category: (a.category as string) ?? orig?.category ?? 'attraction',
      startTime: (a.startTime as string) ?? orig?.startTime ?? '09:00',
      endTime: (a.endTime as string) ?? orig?.endTime ?? '10:00',
      estimatedCost: (a.estimatedCost as number) ?? orig?.estimatedCost ?? 0,
      currency: (a.currency as string) ?? orig?.currency ?? 'JPY',
      priceConfidence: ((a.priceConfidence as string) ?? orig?.priceConfidence ?? 'estimated') as 'confirmed' | 'estimated',
      notes: (a.notes as string) ?? orig?.notes ?? '',
      latitude: (a.latitude as number | null) ?? orig?.latitude ?? null,
      longitude: (a.longitude as number | null) ?? orig?.longitude ?? null,
      reasonTags: (a.reasonTags as string[]) ?? orig?.reasonTags ?? [],
      address: (a.address as string | null) ?? orig?.address ?? null,
      businessHours: (a.businessHours as string | null) ?? orig?.businessHours ?? null,
      closedDays: (a.closedDays as string | null) ?? orig?.closedDays ?? null,
      transitMode: (a.transitMode as string | null) ?? orig?.transitMode ?? null,
      transitDurationMin: (a.transitDurationMin as number | null) ?? orig?.transitDurationMin ?? null,
      transitSummary: (a.transitSummary as string | null) ?? orig?.transitSummary ?? null,
      // TripItem 전용 필드 — audit은 변경하지 않으므로 원본 유지
      verified: orig?.verified ?? false,
      googlePlaceId: orig?.googlePlaceId ?? null,
      subActivities: orig?.subActivities ?? null,
    };
  });
}
