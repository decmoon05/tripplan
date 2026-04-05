/**
 * v3 프롬프트 빌더 — AI에게 장소 추천만 요청
 *
 * v2 대비 변경:
 * - 시간/좌표/이동수단 필드 요청 제거
 * - 8필드만 요청 (name, category, notes, tags, mealSlot, duration, cost, timePreference)
 * - 식사 슬롯 최소 수량 명시
 */

import type { FullProfileInput } from '@/lib/validators/profile';
import { mapBig5ToTravelTags, getCompactPersonality } from '../utils/personalityMapper';
import { sanitize, detectRentalCar, extractBig5 } from '../utils/profileUtils';

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
import type { PlacePreferenceInput, VerifiedPlace, PreviousVisit, AIProviderType } from '../types';
import { getSeasonalWarnings } from '../seasonal-events';

interface V3PromptInput {
  destination: string;
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------------------
// v3 유저 데이터 빌더 (prompt.ts의 buildTravelerJSON 패턴 재사용)
// ---------------------------------------------------------------------------

// sanitize, detectRentalCar, extractBig5 → utils/profileUtils.ts에서 import

function buildV3TravelerData(profile: FullProfileInput): Record<string, unknown> {
  const traveler: Record<string, unknown> = {
    travel_pace: profile.travelPace || 'moderate',
    budget: profile.budgetRange || 'moderate',
    stamina: profile.lifestyle?.stamina || 'moderate',
    morning_type: profile.lifestyle?.morningType || 'moderate',
    companion: profile.companion || 'solo',
  };

  const adventure = profile.lifestyle?.adventureLevel;
  if (adventure && adventure !== 'balanced') traveler.adventure_level = adventure;

  const photo = profile.lifestyle?.photoStyle;
  if (photo && photo !== 'casual') traveler.photo_style = photo;

  if (profile.arrivalTime && profile.arrivalTime !== 'undecided') {
    traveler.arrival_time = profile.arrivalTime;
  }
  if (profile.hotelArea) {
    traveler.hotel_area = sanitize(profile.hotelArea, 100);
  }

  // 식단
  const diet = [
    ...(profile.foodPreference || []),
    ...(profile.customFoodPreference ? [sanitize(profile.customFoodPreference, 100)] : []),
  ].filter(Boolean);
  if (diet.length > 0) traveler.diet_restrictions = diet;

  // 관심사
  const interests = [
    ...(profile.interests || []),
    ...(profile.customInterests ? [sanitize(profile.customInterests, 200)] : []),
  ].filter(Boolean);
  if (interests.length > 0) traveler.interests = interests;

  // 특별 요청 구조화
  if (profile.specialNote) {
    const note = profile.specialNote;
    if (/숨은\s*맛집|현지인\s*맛집|로컬|local.only/i.test(note)) traveler.restaurant_preference = 'local-only';
    if (/한국어\s*메뉴|korean\s*menu/i.test(note)) traveler.korean_menu_preferred = true;
    if (/걷는.*최소|도보.*최소|minimize.*walk|최소.*걸/i.test(note)) traveler.minimize_walking = true;
    const freeText = note
      .replace(/현지인만\s*아는\s*숨은\s*맛집\s*위주로?\s*추천해?\s*주세요?/g, '')
      .replace(/한국어\s*메뉴판?\s*있는\s*식당\s*우선/g, '')
      .replace(/체력이?\s*약해서?\s*걷는\s*거리\s*최소화해?\s*주세요?/g, '')
      .replace(/[,，、\s]+/g, ' ').trim();
    if (freeText.length > 2) traveler.special_requests = [sanitize(freeText, 300)];
  }

  if (detectRentalCar(profile)) traveler.transport_mode = 'rental-car';

  // Big Five 성격 태그
  const big5 = extractBig5(profile);
  if (big5) {
    const tags = mapBig5ToTravelTags(big5);
    const compact = getCompactPersonality(tags);
    if (compact) traveler.personality = compact;
  }

  return traveler;
}

/**
 * v3 시스템 프롬프트 — 장소 추천 전문가
 * provider별 최적 포맷:
 * - gemini: JSON 하이브리드 (현행) — responseSchema와 함께 사용
 * - claude: 자연어 섹션 — 구조화 출력 API 없으므로 prose 지시
 * - openai: JSON 하이브리드 + JSON 출력 명시
 */
export function buildV3SystemPrompt(provider: AIProviderType = 'gemini'): string {
  if (provider === 'claude') return buildV3ClaudePrompt();
  if (provider === 'openai') return buildV3OpenAIPrompt();
  return buildV3GeminiPrompt();
}

/** v3 Claude 전용 — 자연어 섹션 */
function buildV3ClaudePrompt(): string {
  return `You are an expert travel place recommender.
Your job is to recommend PLACES only. Do NOT generate schedules, times, coordinates, or transit.
Code will handle all scheduling, routing, and time calculation.
Return ONLY a valid JSON object — no markdown fences, no explanation.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return JSON with a "places" array. Each place object has these fields:
- placeNameSnapshot: "한국어 이름 (현지어 이름)" — MUST be a REAL, SPECIFIC business name, NEVER generic like "신주쿠 라멘 맛집"
- category: "attraction", "restaurant", "cafe", or "shopping"
- notes: Korean, max 15 characters
- reasonTags: exactly 2 Korean tags, factually accurate
- mealSlot: "breakfast", "lunch", "dinner", "snack", or "none"
- estimatedDurationMinutes: integer 30~180
- estimatedCost: integer in LOCAL currency, per person (never KRW for overseas)
- timePreference: "morning", "afternoon", "evening", or "anytime"
- placeConfidence: "verified" if certain this place exists, "unverified" if any doubt

Also include if possible (optional, code handles if missing):
- tripSummary: 1-line Korean summary (optional)

═══════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════

MEALS: At least 1 lunch + 1 dinner restaurant per trip day. Dessert shops, bakeries, snack bars, 커피 전문점 do NOT count as lunch — only real meal restaurants (정식, 세트메뉴, 덮밥 등). If dietary restrictions exist, ALL restaurants must comply. If a restaurant TYPE commonly includes restricted food (izakaya/soba for no-seafood, BBQ for vegetarian), choose a DIFFERENT type entirely — do not just add "avoid X" in notes.

CHAINS: Max 1 chain restaurant per entire trip. If restaurant_preference is "local-only": EXCLUDE all chains/franchises (이치란, 스타벅스, 요시노야, CoCo壱番屋, etc.) entirely.

KOREAN MENU: If korean_menu_preferred is true, prioritize restaurants with Korean-language menus.

PLACE NAMES: Use REAL specific names. Bad: "신주쿠 라멘 맛집". Good: "쓰케멘 야스베 (つけ麺 やすべえ)". If unsure a place exists, set placeConfidence: "unverified".

DIVERSITY: Mix categories. Never repeat the same place. Never place similar types consecutively (temple→temple, forest→forest).

GEOGRAPHIC GROUPING: Same-day places must be in the same city/area. Never mix cities in one day for multi-city trips.

INTEREST TAGS: Match ONLY genuinely relevant places. Do NOT force-match: "beach" to 海地獄 (hot spring), "anime" to unrelated place. If a tag cannot be matched, note it in advisories.unmatchedInterests.

TIME PREFERENCE: sunrise/hiking → morning (before heat/dark), night markets/bars → evening, museums/galleries → morning or afternoon (opening hours), gardens/parks → morning or afternoon (daylight required).

OUTDOOR SAFETY: Outdoor activities (hiking, walking trails, beach) MUST be during daylight hours.

BUDGET: estimatedCost must match the traveler's budget level. All costs per person in LOCAL currency.

USER FIELDS: Read traveler fields and apply:
- arrival_time: "afternoon" → 1 fewer lunch. "evening" → 1 fewer lunch AND dinner.
- adventure_level: "explorer" → hidden gems, off-beaten-path. "cautious" → verified popular spots.
- personality (if present): social_energy/novelty_seeking/planning_style/group_harmony/comfort_need — apply travel behavior accordingly.`;
}

/** v3 OpenAI 전용 — Gemini 형식 + JSON 명시 */
function buildV3OpenAIPrompt(): string {
  const base = buildV3GeminiPrompt();
  return base.replace(
    'You are an expert travel place recommender.',
    'You are an expert travel place recommender.\nYou MUST return a valid JSON object. No markdown fences, no explanation — raw JSON only.',
  );
}

/** v3 Gemini 전용 — 현행 유지 */
function buildV3GeminiPrompt(): string {
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
        placeConfidence: '"verified" if certain this place exists, "unverified" if any doubt',
      }],
      tripSummary: '전체 여행 한줄 요약 (한국어)',
      advisories: {
        weather: '날씨 주의사항 | null',
        safety: '안전 주의사항 | null',
        health: '건강 주의사항 | null',
        transport: '교통 참고사항 | null',
        culture: '문화/예절 | null',
        budget: '예산 참고 | null',
        unmatchedInterests: '관심사 태그 중 매칭 불가 항목과 대안 (모두 매칭 가능하면 null)',
      },
    },
    critical_rules: {
      meals: {
        rule: 'MUST include enough restaurants to cover every lunch and dinner',
        lunch_count: 'At least N restaurants with mealSlot=lunch (N = trip days)',
        dinner_count: 'At least N restaurants with mealSlot=dinner (N = trip days)',
        meal_quality: {
          cafe_exception: 'A cafe counts as lunch ONLY IF it serves full meals (정식, 세트메뉴, 덮밥, 파스타 등)',
          NOT_lunch: 'The following do NOT count as lunch: dessert shops, bakeries, snack bars, 떡/과자/아이스크림/롤케이크/커피 전문점, street food stalls',
          day1_exception: 'If traveler.arrival_time is "afternoon", 1 fewer lunch needed. If "evening", 1 fewer lunch AND dinner.',
        },
        dietary: 'If dietary restrictions exist, ALL restaurants MUST comply',
        dietary_type: 'If a restaurant TYPE commonly includes restricted food (e.g., izakaya/soba for no-seafood, BBQ for vegetarian), choose a DIFFERENT restaurant type. Do NOT just add a note saying "avoid X" — actually replace the restaurant.',
      },
      restaurant_selection: {
        confidence: 'Only recommend restaurants you are CERTAIN exist. If uncertain, use a well-known establishment. Set placeConfidence accordingly.',
        chain_policy: {
          max_chains: '1 chain restaurant per entire trip, only if no local alternative.',
          local_override: 'If traveler.restaurant_preference is "local-only" → EXCLUDE all chains/franchises (이치란, 스타벅스, 요시노야, CoCo壱番屋, etc.) entirely.',
        },
        korean_menu: 'If traveler.korean_menu_preferred is true → prioritize restaurants known to have Korean-language menus.',
      },
      interest_matching: {
        rule: 'For each interest tag, match ONLY genuinely relevant places.',
        no_force_match: 'Do NOT force-match: "beach" to 海地獄 (hot spring), "anime" to unrelated place, "shopping-vintage" to generic mall.',
        unmatched: 'If a tag cannot be matched, that is OK. Note it in advisories.',
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
- Dessert shops, bakeries, snack bars do NOT count as lunch — only real meal restaurants
- If dietary restrictions exist, ALL restaurants must comply. If restaurant TYPE commonly includes restricted food (izakaya for no-seafood), choose a different type entirely.
- If restaurant_preference is "local-only": NO chain restaurants (이치란, 스타벅스, etc.)
- All place names: "한국어 (현지어)" format
- estimatedCost in LOCAL currency, never KRW for overseas
- Only recommend REAL existing places. If unsure a place exists, set placeConfidence: "unverified"
- Do NOT force-match interest tags to unrelated places (beach ≠ 海地獄)

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
  const totalPlaces = totalDays * itemsPerDay;
  // arrival_time에 따라 Day 1 식사 수 조정
  const isEvening = profile.arrivalTime === 'evening';
  const isAfternoon = profile.arrivalTime === 'afternoon';
  const minLunches = totalDays + 1 - (isEvening || isAfternoon ? 1 : 0);
  const minDinners = totalDays + 1 - (isEvening ? 1 : 0);

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
    traveler: buildV3TravelerData(profile),
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
