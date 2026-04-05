/**
 * v4 3차 장소 추천 프롬프트
 *
 * 2차 군집(동네) 단위로 AI에게 장소만 추천 요청.
 * AI는 시간/동선/Day 배정을 하지 않음 — 장소 + 태그 + 시간벡터만.
 * 카테고리별 분리 요청 (한 번에 100개 금지 — 후반부 품질 저하).
 */

import type { Area, Region, PlannerUserProfile, PlaceCategory } from './types';
import { INTEREST_TAGS } from '@/lib/validators/profile';

// ─── Gemini 응답 스키마 (responseSchema로 구조 강제) ─────────────────────────

export const PLACE_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    places: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          placeNameSnapshot: { type: 'string' as const, description: '장소명 (한국어 + 현지어). 예: "이치란 라멘 본점 (一蘭 本店)"' },
          category: { type: 'string' as const, enum: ['attraction', 'restaurant', 'cafe', 'shopping'] },
          reasonTags: { type: 'array' as const, items: { type: 'string' as const }, description: '2~4개 한국어 태그' },
          mealSlot: { type: 'string' as const, enum: ['breakfast', 'lunch', 'dinner', 'snack', 'none'] },
          estimatedDurationMinutes: { type: 'number' as const, description: '예상 체류 시간 (30~180)' },
          estimatedCost: { type: 'number' as const, description: '1인 예상 비용 (현지 통화 정수)' },
          timePreference: { type: 'string' as const, enum: ['morning', 'afternoon', 'evening', 'anytime'] },
          aiConfidence: { type: 'number' as const, description: '이 장소가 실존하고 정보가 정확하다는 확신도 (0.0~1.0)' },
          timeVector: {
            type: 'object' as const,
            properties: {
              earlyMorning: { type: 'number' as const },
              morning: { type: 'number' as const },
              afternoon: { type: 'number' as const },
              lateAfternoon: { type: 'number' as const },
              evening: { type: 'number' as const },
              night: { type: 'number' as const },
            },
            required: ['earlyMorning', 'morning', 'afternoon', 'lateAfternoon', 'evening', 'night'],
          },
          weatherSensitivity: { type: 'number' as const, description: '0=완전 실내, 1=완전 실외' },
          notes: { type: 'string' as const, description: '한 줄 설명 (한국어)' },
        },
        required: [
          'placeNameSnapshot', 'category', 'reasonTags', 'mealSlot',
          'estimatedDurationMinutes', 'estimatedCost', 'timePreference',
          'aiConfidence', 'timeVector', 'weatherSensitivity', 'notes',
        ],
      },
    },
  },
  required: ['places'],
};

// ─── 시스템 프롬프트 ─────────────────────────────────────────────────────────

export function buildPlaceSystemPrompt(provider: 'gemini' | 'claude' | 'openai'): string {
  const base = `당신은 여행 장소 추천 전문가입니다.
사용자의 프로필과 동네 정보를 기반으로 해당 동네의 장소를 추천합니다.

## 역할 제한
- 장소를 추천하고 태그를 붙이는 것만 합니다.
- 시간 배정, 동선 설계, Day별 배치는 하지 마세요. 코드가 처리합니다.
- 각 장소에 timeVector(6구간 적합도)를 반드시 제공하세요.

## reasonTags 규칙 (필수)
reasonTags는 반드시 다음 영어 어휘에서만 선택하세요. 한국어/일본어 태그 금지.
허용 태그: ${INTEREST_TAGS.join(', ')}
각 장소에 2~4개의 태그를 위 목록에서 골라 붙이세���.

## 장소 품질 규칙
1. ���제 존재하는 장소만 추천하세요. 확신이 낮으면 aiConfidence를 낮게 설정하세요.
2. reasonTags는 위 허용 목록에서만 선택하세요. 사실과 다른 태그를 붙이지 마세요.
3. 체인점은 여행 전체에서 최대 1개. 사용자가 local-only를 원하면 0개.
4. 식이제한이 있으면 해당 음식 유형 자체를 피하세요. no-seafood 사용자에게 이자카야를 추천하지 마세요.
5. 디저트/빵집/커피전문점은 mealSlot을 'snack'으로 설정하세요. 'lunch'나 'dinner'로 설정하지 마세요.
6. timeVector: 해당 시간대에 방문하기 좋으면 1.0에 가깝게, 부적절하면 0.0에 가깝게.
7. estimatedCost: 1인 기준, 현지 통화 정수. 무료면 0.
8. aiConfidence: 직접 방문했거나 Google Maps에서 확인한 장소는 0.8~1.0, 불확실하면 0.3~0.5.`;

  if (provider === 'gemini') {
    return base + '\n\nJSON 형식으로 응답하세요. places 배열에 장소를 넣으세요.';
  }
  if (provider === 'claude') {
    return base + '\n\nJSON 형식으로 응답하세요. ```json 블록 없이 순수 JSON만.';
  }
  return base + '\n\nJSON 형식으로 응답하세요.';
}

// ─── 유저 프롬프트 ───────────────────────────────────────────────────────────

export function buildPlaceRecommendationPrompt(
  area: Area,
  category: PlaceCategory,
  count: number,
  userProfile: PlannerUserProfile,
  region: Region,
): { system: string; user: string } {
  const system = buildPlaceSystemPrompt('gemini');

  // 사용자 조건 (기본값과 다른 것만 포함 — 토큰 절약)
  const conditions: string[] = [];
  if (userProfile.foodPreference.length > 0) {
    conditions.push(`식이제한: ${userProfile.foodPreference.join(', ')}`);
  }
  if (userProfile.interests.length > 0) {
    conditions.push(`관심사: ${userProfile.interests.join(', ')}`);
  }
  if (userProfile.budgetRange !== 'moderate') {
    conditions.push(`예산: ${userProfile.budgetRange}`);
  }
  if (userProfile.specialNote) {
    conditions.push(`특별 요청: ${userProfile.specialNote}`);
  }
  if (userProfile.personality) {
    const tags: string[] = [];
    if (userProfile.personality.socialEnergy) tags.push(`사교성: ${userProfile.personality.socialEnergy}`);
    if (userProfile.personality.noveltySeeking) tags.push(`새로움 추구: ${userProfile.personality.noveltySeeking}`);
    if (userProfile.personality.comfortNeed) tags.push(`안정 욕구: ${userProfile.personality.comfortNeed}`);
    if (tags.length > 0) conditions.push(`성향: ${tags.join(', ')}`);
  }

  const categoryLabel = {
    restaurant: '식당 (아침/점심/저녁 포함)',
    attraction: '관광지/명소',
    cafe: '카페/디저트',
    shopping: '쇼핑 스팟',
  }[category];

  const user = `## 요청
${area.areaNameKo} (${area.areaNameLocal}) 동네에서 ${categoryLabel} ${count}개를 추천해주세요.

## 동네 정보
- 지역: ${region.regionNameKo} (${region.country})
- 동네: ${area.areaNameKo}
- 특징: ${area.interestTags.join(', ')}
- 물가 수준: ${area.budgetLevel}/5
- 중심 좌표: ${area.centerLat}, ${area.centerLon}
- 반경: ${area.radiusKm}km

## 사용자 조건
${conditions.length > 0 ? conditions.join('\n') : '특별한 제한 없음'}

## 통화
${region.currencyCode}

## 주의
- ${area.areaNameKo} 반경 ${area.radiusKm}km 내의 장소만 추천하세요.
- 시간/동선/Day 배정은 하지 마세요.
- 각 장소에 timeVector 6구간과 aiConfidence를 반드시 포함하세요.`;

  return { system, user };
}
