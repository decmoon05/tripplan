/**
 * v3 프롬프트 빌더 — AI에게 장소 추천만 요청
 *
 * v2 대비 변경:
 * - 시간/좌표/이동수단 필드 요청 제거
 * - 8필드만 요청 (name, category, notes, tags, mealSlot, duration, cost, timePreference)
 * - 식사 슬롯 최소 수량 명시
 */

import type { FullProfileInput } from '@/lib/validators/profile';

// ---------------------------------------------------------------------------
// 식사 설정 추출 (specialNote에서 파싱)
// ---------------------------------------------------------------------------

export interface MealPreferences {
  skipLunch: boolean;
  skipDinner: boolean;
  lateDinner: boolean;
}

export function extractMealPreferences(specialNote: string | undefined): MealPreferences {
  if (!specialNote) return { skipLunch: false, skipDinner: false, lateDinner: false };
  const note = specialNote.toLowerCase();
  return {
    skipLunch: /점심.*안|점심.*패스|점심.*스킵|점심.*필요.*없|no.*lunch|skip.*lunch/i.test(note),
    skipDinner: /저녁.*안|저녁.*패스|저녁.*스킵|no.*dinner|skip.*dinner/i.test(note),
    lateDinner: /늦은.*저녁|야식|late.*dinner|22시|23시|21시.*저녁|밤.*식사/i.test(note),
  };
}
import type { PlacePreferenceInput, VerifiedPlace, PreviousVisit } from '../types';
import { getSeasonalWarnings } from '../seasonal-events';

interface V3PromptInput {
  destination: string;
  startDate: string;
  endDate: string;
}

/**
 * v3 시스템 프롬프트 — 장소 추천 전문가
 */
export function buildV3SystemPrompt(): string {
  const json = {
    role: 'travel_place_recommender',
    task: 'Recommend places for a travel itinerary. Do NOT generate schedules, times, coordinates, or transit information. Only recommend places with the fields below.',
    output_format: {
      places: [{
        placeNameSnapshot: '한국어 이름 (현지어 이름)',
        category: 'attraction | restaurant | cafe | shopping',
        notes: '한국어 15자 이내 한줄팁',
        reasonTags: ['한국어태그1', '한국어태그2'],
        mealSlot: 'breakfast | lunch | dinner | snack | none',
        estimatedDurationMinutes: '30~180 정수',
        estimatedCost: '현지 통화 정수 (1인 기준)',
        timePreference: 'morning | afternoon | evening | anytime',
      }],
      tripSummary: '전체 여행 한줄 요약 (한국어)',
      advisories: {
        weather: '날씨 주의사항 | null',
        safety: '안전 주의사항 | null',
        health: '건강 주의사항 | null',
        transport: '교통 참고사항 | null',
        culture: '문화/예절 | null',
        budget: '예산 참고 | null',
      },
    },
    critical_rules: {
      meals: {
        rule: 'MUST include enough restaurants to cover every lunch and dinner',
        lunch_count: 'At least N restaurants with mealSlot=lunch (N = trip days)',
        dinner_count: 'At least N restaurants with mealSlot=dinner (N = trip days)',
        dietary: 'If dietary restrictions exist, ALL restaurants MUST comply',
      },
      place_names: {
        format: '한국어 (현지어)',
        example: '센소지 (浅草寺)',
        rule: 'CRITICAL: Must use REAL, SPECIFIC business names. NEVER use generic names like "신주쿠 라멘 맛집" or "현지 레스토랑". Always use actual restaurant names like "이치란 라멘 신주쿠점 (一蘭 新宿中央東口店)".',
        bad_examples: ['신주쿠 라멘 맛집', '현지 레스토랑', '오사카 카페', 'Local Restaurant'],
        good_examples: ['이치란 라멘 시부야점 (一蘭 渋谷店)', '쓰케멘 야스베 (つけ麺 やすべえ)', '몬머스 커피 (Monmouth Coffee)'],
      },
      cost: {
        rule: 'estimatedCost is per person in LOCAL currency. Never use KRW for overseas trips.',
        budget_alignment: 'Costs should match the traveler budget level',
      },
      diversity: {
        rule: 'Mix categories. Not all attractions or all restaurants.',
        no_repeats: 'Never recommend the same place twice.',
        no_similar_consecutive: 'NEVER place similar types consecutively. Bad: forest→forest, temple→temple, museum→museum. Good: forest→cafe→temple→shopping.',
      },
      timePreference_rules: {
        rule: 'timePreference MUST match the place characteristics.',
        sunrise_spots: 'Places with "일출", "sunrise", "dawn" in name → timePreference: morning',
        sunset_spots: 'Places with "일몰", "sunset", "야경", "night view" → timePreference: evening',
        outdoor_hiking: 'Hiking trails, trekking, long walks → timePreference: morning (before heat/dark)',
        night_markets: 'Night markets, bars, nightlife → timePreference: evening',
        museums: 'Museums, galleries → timePreference: morning or afternoon (opening hours)',
        gardens_parks: 'Botanical gardens, parks → timePreference: morning or afternoon (daylight required)',
      },
      outdoor_safety: {
        rule: 'Outdoor activities (hiking, walking trails, beach) MUST be scheduled during daylight hours.',
        bad: 'Olle Trail at 18:30 (dark), Botanical garden at 22:00 (closed)',
        good: 'Olle Trail at 09:00, Botanical garden at 14:00',
      },
      geographic_grouping: {
        rule: 'CRITICAL: Group places by city/area. Same-day places MUST be in the same city. NEVER mix cities in one day.',
        bad: 'Day 1: Fukuoka museum → Nagasaki museum → Fukuoka restaurant (4 hours driving wasted)',
        good: 'Day 1: all Fukuoka, Day 2: all Yufuin/Beppu, Day 3: all Nagasaki',
        multi_city_trips: 'For multi-city destinations (e.g. "규슈", "간사이"), organize by city per day. Move between cities only between days, not within a day.',
      },
    },
  };

  return `You are an expert travel place recommender.
Your job is to recommend PLACES only. Do NOT generate schedules, times, coordinates, or transit.
Code will handle all scheduling, routing, and time calculation.

CRITICAL:
- Include enough restaurants: at least 1 lunch + 1 dinner per day
- If dietary restrictions exist, ALL restaurants must comply
- All place names: "한국어 (현지어)" format
- estimatedCost in LOCAL currency, never KRW for overseas
- Only recommend REAL existing places

${JSON.stringify(json, null, 2)}`;
}

/**
 * v3 유저 프롬프트 — 여행 조건 + 필요 장소 수
 */
export function buildV3UserPrompt(
  profile: FullProfileInput,
  input: V3PromptInput,
  totalDays: number,
  itemsPerDay: number,
  placePreferences?: PlacePreferenceInput[],
  verifiedPlaces?: VerifiedPlace[],
  previousVisits?: PreviousVisit[],
): string {
  const totalPlaces = totalDays * itemsPerDay; // 정확히 필요한 수만 (여분 제거 — 토큰 절약)
  const minLunches = totalDays + 1; // 여분 1개
  const minDinners = totalDays + 1;

  // 계절 경고
  const month = new Date(input.startDate).getMonth() + 1;
  const seasonalWarnings = getSeasonalWarnings(input.destination, month);

  const prompt: Record<string, unknown> = {
    request: `Recommend EXACTLY ${totalPlaces} places for a ${totalDays}-day trip. STRICT RULES: (1) Do NOT exceed ${totalPlaces} places. (2) notes: MAX 10 characters Korean. (3) reasonTags: exactly 2 tags. (4) No long descriptions anywhere.`,
    destination: input.destination,
    dates: { start: input.startDate, end: input.endDate, days: totalDays },
    required_counts: {
      total_places: totalPlaces,
      min_lunch_restaurants: minLunches,
      min_dinner_restaurants: minDinners,
      attractions: `${Math.ceil(totalPlaces * 0.5)}+ places`,
    },
    traveler: {
      pace: profile.travelPace || 'moderate',
      budget: profile.budgetRange || 'moderate',
      companion: profile.companion || 'solo',
      interests: profile.interests || [],
      customInterests: profile.customInterests || '',
      dietary: profile.foodPreference || [],
      customDietary: profile.customFoodPreference || '',
      specialRequest: profile.specialNote || '',
      stamina: profile.lifestyle?.stamina || 'moderate',
    },
  };

  // 이전 여행 경험
  if (previousVisits && previousVisits.length > 0) {
    const liked = previousVisits.filter(v => v.rating && v.rating >= 4);
    const disliked = previousVisits.filter(v => v.rating && v.rating <= 2);
    if (liked.length > 0 || disliked.length > 0) {
      prompt.previous_experience = {
        liked: liked.map(v => `${v.placeNameSnapshot} (★${v.rating})`),
        disliked: disliked.map(v => `${v.placeNameSnapshot} (★${v.rating})`),
        instruction: 'Recommend similar to liked places. Avoid similar to disliked.',
      };
    }
  }

  // 장소 선호도
  if (placePreferences && placePreferences.length > 0) {
    const exclude = placePreferences.filter(p => p.preference === 'exclude').map(p => p.placeName);
    const mustInclude = placePreferences.filter(p => p.preference === 'revisit').map(p => p.placeName);
    if (exclude.length > 0) prompt.exclude_places = exclude;
    if (mustInclude.length > 0) prompt.must_include = mustInclude;
  }

  // 검증된 장소 (Google Places 캐시)
  if (verifiedPlaces && verifiedPlaces.length > 0) {
    prompt.verified_local_places = verifiedPlaces.slice(0, 20).map(v => ({
      name: v.displayName,
      category: v.category,
      rating: v.rating,
    }));
    prompt.verified_instruction = 'Prefer these verified places when possible. They have confirmed coordinates and business hours.';
  }

  // 계절 경고
  if (seasonalWarnings.length > 0) {
    prompt.seasonal_warnings = seasonalWarnings;
  }

  return `Recommend places for this trip. Return JSON with "places" array ONLY. No tripSummary, no advisories. Keep each note under 15 chars Korean.

${JSON.stringify(prompt, null, 2)}`;
}

/**
 * v3 식사 보충 프롬프트 — 부족한 식당만 추가 요청
 */
export function buildV3MealSupplementPrompt(
  destination: string,
  needed: { lunch: number; dinner: number },
  dietary: string[],
  budget: string,
): string {
  const total = needed.lunch + needed.dinner;
  return `Recommend ${total} more restaurants for ${destination}.
${needed.lunch > 0 ? `- ${needed.lunch} with mealSlot=lunch` : ''}
${needed.dinner > 0 ? `- ${needed.dinner} with mealSlot=dinner` : ''}
${dietary.length > 0 ? `- Dietary restrictions: ${dietary.join(', ')}` : ''}
- Budget level: ${budget}
- Return JSON array of places (same schema as before).
- Do NOT repeat any places already recommended.`;
}
