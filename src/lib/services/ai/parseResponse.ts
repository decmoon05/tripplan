import { z } from 'zod/v4';
import type { AIGeneratedItem, AITripMetadata } from './types';
import type { StaminaLevel } from '@/types/database';

const aiItemSchema = z.object({
  dayNumber: z.number().int().min(1),
  orderIndex: z.number().int().min(0),
  placeNameSnapshot: z.string().min(1),
  category: z.enum(['attraction', 'restaurant', 'cafe', 'shopping', 'transport', 'hotel']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  estimatedCost: z.number().int().min(0),
  currency: z.string().min(3).max(3).default('KRW'),
  priceConfidence: z.enum(['confirmed', 'estimated']).default('estimated'),
  notes: z.string(),
  latitude: z.number().nullable().optional().default(null),
  longitude: z.number().nullable().optional().default(null),
  activityLevel: z.enum(['light', 'moderate', 'intense']).default('moderate'),
  reasonTags: z.array(z.string().max(20)).max(5).optional().default([]),
  address: z.string().nullable().optional().default(null),
  businessHours: z.string().nullable().optional().default(null),
  closedDays: z.string().nullable().optional().default(null),
  transitMode: z.enum(['walk', 'bus', 'taxi', 'subway', 'train', 'bicycle', 'drive', 'flight', 'ferry']).nullable().optional().default(null),
  transitDurationMin: z.number().int().min(0).nullable().optional().default(null),
  transitSummary: z.string().nullable().optional().default(null),
  verified: z.boolean().optional().default(true),
  googlePlaceId: z.string().nullable().optional().default(null),
});

/** AI 반환값의 enum 필드를 소문자 정규화 + 별칭 매핑 */
function normalizeEnumField(
  obj: Record<string, unknown>,
  field: string,
  aliases: Record<string, string>,
): void {
  if (typeof obj[field] !== 'string') return;
  const lower = (obj[field] as string).toLowerCase().trim();
  obj[field] = aliases[lower] || lower;
}

export function parseAIResponse(raw: string): AIGeneratedItem[] {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const cleaned = raw.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*$/gm, '').trim();

  // Find outermost JSON array: first '[' to last ']'
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    console.error('[parseAI] No JSON array found. Raw (first 500 chars):', raw.slice(0, 500));
    throw new Error('AI response does not contain a valid JSON array');
  }

  const jsonStr = cleaned.slice(firstBracket, lastBracket + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try fixing common issues: trailing commas before ] or }
    const fixedJson = jsonStr
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    try {
      parsed = JSON.parse(fixedJson);
    } catch {
      console.error('[parseAI] JSON parse failed. Extracted (first 500 chars):', jsonStr.slice(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  return parsed.map((item, index) => {
    // AI가 대소문자/변형 값을 반환할 수 있으므로 정규화
    if (item && typeof item === 'object') {
      normalizeEnumField(item, 'category', {
        'attractions': 'attraction', 'sightseeing': 'attraction', 'tourism': 'attraction', 'tour': 'attraction',
        'restaurants': 'restaurant', 'food': 'restaurant', 'dining': 'restaurant', 'meal': 'restaurant',
        'cafes': 'cafe', 'coffee': 'cafe',
        'shops': 'shopping', 'shop': 'shopping', 'market': 'shopping',
        'hotels': 'hotel', 'accommodation': 'hotel', 'lodging': 'hotel',
        'transportation': 'transport', 'transit': 'transport',
      });
      normalizeEnumField(item, 'priceConfidence', {
        'confirm': 'confirmed', 'exact': 'confirmed',
        'estimate': 'estimated', 'approx': 'estimated', 'approximate': 'estimated',
      });
      normalizeEnumField(item, 'activityLevel', {
        'easy': 'light', 'low': 'light', 'mild': 'light',
        'medium': 'moderate', 'normal': 'moderate',
        'hard': 'intense', 'high': 'intense', 'heavy': 'intense',
      });
      normalizeEnumField(item, 'transitMode', {
        'metro': 'subway', 'rail': 'train', 'car': 'drive', 'bike': 'bicycle', 'foot': 'walk',
      });
    }

    const result = aiItemSchema.safeParse(item);
    if (!result.success) {
      console.warn(`[parseAI] Item ${index} raw:`, JSON.stringify(item).slice(0, 300));
      throw new Error(`Invalid item at index ${index}: ${result.error.message}`);
    }
    return result.data;
  });
}

/** advisories 스키마 */
const advisoriesSchema = z.object({
  weather: z.string().default(''),
  safety: z.string().default(''),
  exchangeRate: z.string().default(''),
  holidays: z.string().default(''),
  atmosphere: z.string().default(''),
  disasters: z.string().default(''),
  other: z.string().default(''),
});

/**
 * 4일 이하 단일 호출: { tripSummary, advisories, items } 객체 파싱.
 * AI가 배열만 반환한 경우 폴백 (metadata null).
 */
export function parseCombinedResponse(raw: string): {
  items: AIGeneratedItem[];
  metadata: AITripMetadata | null;
} {
  const cleaned = raw.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*$/gm, '').trim();

  // 1) 배열인지 객체인지 판별
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  // AI가 배열만 반환한 경우 → 기존 파서로 폴백
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    return { items: parseAIResponse(raw), metadata: null };
  }

  // 2) JSON 객체 추출
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.warn('[parseCombined] No JSON object found, falling back to array parse');
    return { items: parseAIResponse(raw), metadata: null };
  }

  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const fixed = jsonStr.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    try {
      parsed = JSON.parse(fixed);
    } catch {
      console.warn('[parseCombined] JSON parse failed, falling back to array parse');
      return { items: parseAIResponse(raw), metadata: null };
    }
  }

  // 3) items 추출
  const itemsRaw = parsed.items;
  if (!Array.isArray(itemsRaw)) {
    console.warn('[parseCombined] No items array in object, falling back');
    return { items: parseAIResponse(raw), metadata: null };
  }

  // items를 JSON 문자열로 변환 후 기존 parseAIResponse 재사용
  const items = parseAIResponse(JSON.stringify(itemsRaw));

  // 4) metadata 추출
  let metadata: AITripMetadata | null = null;
  try {
    const tripSummary = typeof parsed.tripSummary === 'string' ? parsed.tripSummary : '';
    const advResult = advisoriesSchema.safeParse(parsed.advisories);
    if (tripSummary || advResult.success) {
      metadata = {
        tripSummary,
        advisories: advResult.success ? advResult.data : {
          weather: '', safety: '', exchangeRate: '', holidays: '',
          atmosphere: '', disasters: '', other: '',
        },
      };
    }
  } catch {
    console.warn('[parseCombined] Failed to extract metadata');
  }

  return { items, metadata };
}

/**
 * 5+일 별도 메타데이터 호출 응답 파싱.
 */
export function parseMetadataResponse(raw: string): AITripMetadata | null {
  const cleaned = raw.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*$/gm, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.warn('[parseMetadata] No JSON object found');
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    const tripSummary = typeof parsed.tripSummary === 'string' ? parsed.tripSummary : '';
    const advResult = advisoriesSchema.safeParse(parsed.advisories);
    return {
      tripSummary,
      advisories: advResult.success ? advResult.data : {
        weather: '', safety: '', exchangeRate: '', holidays: '',
        atmosphere: '', disasters: '', other: '',
      },
    };
  } catch {
    console.warn('[parseMetadata] JSON parse failed');
    return null;
  }
}

/** stamina에 맞지 않는 intense 아이템을 필터링하고 orderIndex 재정렬 */
export function filterByStamina(
  items: AIGeneratedItem[],
  stamina: StaminaLevel,
): AIGeneratedItem[] {
  if (stamina === 'high') return items;
  // low/moderate → intense 제거
  const filtered = items.filter((item) => item.activityLevel !== 'intense');
  // orderIndex 재정렬 (dayNumber별로 0부터)
  const dayCounters: Record<number, number> = {};
  return filtered.map((item) => {
    dayCounters[item.dayNumber] = (dayCounters[item.dayNumber] ?? 0);
    const reindexed = { ...item, orderIndex: dayCounters[item.dayNumber] };
    dayCounters[item.dayNumber]++;
    return reindexed;
  });
}
