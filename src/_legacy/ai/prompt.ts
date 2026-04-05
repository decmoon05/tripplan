import type { FullProfileInput } from '@/lib/validators/profile';
import type { GenerateInput, PlacePreferenceInput, VerifiedPlace, PreviousVisit, AIProviderType } from './types';
import { getDayCount } from '@/utils/date';
import { mapBig5ToTravelTags, getCompactPersonality } from './utils/personalityMapper';
import type { Big5Scores } from './utils/personalityMapper';
import { sanitize, detectRentalCar, extractBig5 } from './utils/profileUtils';

/**
 * 게이트웨이 호환 여부 판별.
 * OPENAI_BASE_URL이 설정되어 있으면 게이트웨이 경유 → system role 사용 불가.
 */
export function isGatewayMode(): boolean {
  return !!process.env.OPENAI_BASE_URL;
}

/** non-reasoning 모델 목록 (nano 등 경량 모델) */
const NON_REASONING_MODELS = ['gpt-5.4-nano', 'gpt-5-nano'];

/** reasoning 모델 판별 (gpt-5*, o1*, o3* — 단, nano 제외) */
export function isReasoningModel(model: string): boolean {
  if (NON_REASONING_MODELS.some(nr => model.toLowerCase().startsWith(nr))) return false;
  return /^(o1|o3|gpt-5)/i.test(model);
}

// sanitize, detectRentalCar, extractBig5 → utils/profileUtils.ts에서 import

// ─── JSON 시스템 프롬프트 ─────────────────────────────

function buildSystemJSON() {
  return {
    role: 'travel_itinerary_planner',
    output_format: {
      type: 'JSON object',
      structure: '{ "tripSummary": string, "advisories": object, "items": array }',
      tripSummary: '1-paragraph Korean, warm conversational tone (친근하고 기대감을 주는 어투)',
      advisories: {
        weather: '날씨 정보 (여행 시기 기준)',
        safety: '안전 정보',
        exchangeRate: '환율 정보',
        holidays: '현지 공휴일/축제',
        atmosphere: '현지 분위기',
        disasters: '재해/주의사항',
        unmatchedInterests: '관심사 태그 중 이 지역에서 매칭 불가능한 항목과 대안 안내 (예: "beach — 이 지역에 해변 없음, 대안: 이토시마 반나절 코스"). 모든 태그 매칭 가능하면 null.',
        other: '기타 참고사항 (계절 불일치 경고 반드시 포함)',
      },
    },
    item_schema: {
      dayNumber: 'integer, starts from 1',
      orderIndex: 'integer, starts from 0 per day',
      placeNameSnapshot: {
        format: '한국어 이름 (현지어 이름)',
        examples: ['센소지 (浅草寺)', '에펠탑 (Tour Eiffel)'],
        rule: 'NEVER English-only. Hotels/transport also Korean.',
      },
      category: { enum: ['attraction', 'restaurant', 'cafe', 'shopping', 'transport', 'hotel'] },
      startTime: { format: 'HH:MM (24h)', valid_range: '06:00~23:59' },
      endTime: { format: 'HH:MM (24h)', valid_range: '07:00~23:59' },
      estimatedCost: { type: 'integer', currency: 'LOCAL (JPY, THB, EUR, etc.)', unit: 'PER PERSON' },
      currency: 'ISO 4217 matching destination',
      priceConfidence: { enum: ['confirmed', 'estimated'] },
      placeConfidence: {
        enum: ['verified', 'unverified'],
        rule: 'Set "verified" only for places you are highly confident exist with this exact name. Set "unverified" for any doubt. Do NOT invent restaurant names — if unsure, use a well-known place instead.',
      },
      notes: { language: 'Korean', max: '2-3 sentences', content: 'practical tips' },
      latitude: 'decimal (e.g. 35.6762)',
      longitude: 'decimal (e.g. 139.6503)',
      activityLevel: {
        light: 'indoor, flat terrain, minimal walking (cafes, museums, shopping)',
        moderate: 'stairs/walking 1-2h (temples, sightseeing, theme parks)',
        intense: 'hiking, trekking, 3+ hours physical (mountain trails)',
      },
      reasonTags: {
        type: 'array of 2-4 Korean tags without #',
        rules: ['MUST be factually accurate', 'No 숨은맛집 for famous chains', 'Anime/drama only for ACTUAL locations'],
        examples: ['비건맛집', '포토스팟', '자연경관', '온천'],
      },
      address: 'local language address or null',
      businessHours: "e.g. '09:00-17:00' or null",
      closedDays: "Korean e.g. '월요일', '연중무휴', or null",
      transitMode: {
        enum: ['walk', 'bus', 'taxi', 'subway', 'train', 'bicycle', 'drive', 'flight', 'ferry', null],
        rule: 'null for first item of each day (orderIndex=0)',
      },
      transitDurationMin: 'integer or null',
      transitSummary: "Korean one-line e.g. '도보 5분' or null",
    },
    critical_rules: {
      meals: {
        priority: 'HIGHEST — NON-NEGOTIABLE',
        lunch: {
          required: true,
          every_day: true,
          time_range: ['11:00', '14:30'],
          category: ['restaurant'],
          cafe_exception: 'A cafe counts as lunch ONLY IF it serves full meals (정식, 세트메뉴, 덮밥, 파스타 등)',
          NOT_lunch: ['dessert shops', 'bakeries', 'snack bars', '떡/과자/아이스크림/롤케이크/커피 전문점', 'street food stalls'],
          day1_exception: 'If arrival is afternoon (14:00+), Day 1 lunch may be omitted. If arrival is evening (17:00+), Day 1 lunch MUST be omitted.',
        },
        dinner: { required: true, every_day: true, time_range: ['17:00', '21:30'], category: ['restaurant'] },
        instruction: 'If ANY day has no dinner restaurant, ADD ONE before returning. Check EVERY day.',
        gap_max_hours: 2.5,
      },
      items_per_day: {
        low_stamina: { min: 3, max: 4, note: 'include cafe/rest breaks' },
        moderate_stamina: { min: 4, max: 6 },
        high_stamina: { min: 5, max: 8 },
        instruction: 'NEVER exceed the stamina max.',
      },
      routing: {
        rule: 'Each day visits geographically close places. Group by neighborhood.',
        minimize_backtracking: true,
      },
      intercity_travel: {
        rule: 'REALISTIC driving/train times between cities.',
        forbidden: "Do NOT use 'subway' for inter-city travel.",
        examples: { '후쿠오카→벳푸': '~2h car', 'Tokyo→Hakone': '~1.5h train' },
      },
      transport_mode: {
        rental_car_keywords: ['렌터카', '렌트카', 'rental car', '자차', '자가용'],
        when_detected: "ALL transitMode MUST be 'drive'. Realistic driving durations. No subway.",
        day1_include: 'rental cost + tolls + gas as transport category item',
      },
      closed_day_check: {
        rule: 'Before including ANY place, verify scheduled day-of-week does NOT conflict with closedDays.',
        action: 'If conflict → pick a DIFFERENT place.',
      },
      restaurant_selection: {
        confidence: 'Only recommend restaurants you are CERTAIN exist. If uncertain, use a well-known establishment. Set placeConfidence accordingly.',
        chain_policy: {
          allowed: 'International/national chains (이치란, 스타벅스, 코코이치방야, etc.) are ALLOWED but should NOT dominate.',
          max_chains: '1 chain restaurant per entire trip, only if no local alternative exists.',
          local_request_override: 'If traveler.restaurant_preference is "local-only" → EXCLUDE all chain/franchise restaurants entirely. Use only independent local restaurants.',
        },
        dietary: {
          scope: 'Apply to ALL food items: restaurant, cafe, AND attractions with food (야타이, 시장, 푸드코트, food festivals).',
          rule: 'If a restaurant TYPE commonly includes restricted food (e.g., izakaya for no-seafood), choose a different restaurant type.',
        },
        korean_menu: 'If traveler.korean_menu_preferred is true → prioritize restaurants with Korean-language menus.',
      },
      budget: {
        cost_unit: 'PER PERSON',
        shared_costs: "Note in 'notes' when shared (hotel, rental car) vs per-person (meals, entrance)",
      },
      user_field_rules: {
        arrival_time: 'If "afternoon" → Day 1 starts from 14:00, skip morning. If "evening" → Day 1 starts from 17:00, only dinner + short activity.',
        morning_type: 'Day 2+ start time: "early" → 06:00-08:00 (sunrise OK), "moderate" → 08:00-10:00, "late" → 10:00-11:00 (brunch OK).',
        hotel_area: 'If present → last activity each day should be near this area for easy return.',
        minimize_walking: 'If true → prefer short walking distances, use taxi/bus/subway between places. Prioritize transit over walking.',
        adventure_level: 'If "explorer" → hidden gems, local alleys, off-the-beaten-path. If "cautious" → verified popular tourist spots only.',
        transport_mode: 'If "rental-car" → ALL transitMode MUST be "drive". Realistic driving times. No subway. Day 1 include rental cost + tolls + gas.',
        verified_places: 'If present → prefer these verified places. For non-verified places, set placeConfidence="unverified" and googlePlaceId=null.',
        previous_visits: 'If present → rated 4-5★ places: recommend similar. Rated 1-2★: exclude and suggest better alternative. 3★/unrated: neutral.',
        personality: {
          social_energy: 'high → nightlife, group activities, local interaction spots. low → quiet cafes, private spaces, nature.',
          novelty_seeking: 'high → local hidden gems, street food, cultural experiences, off-beaten-path. low → popular tourist spots, familiar cuisines.',
          planning_style: 'structured → reservation-required spots, time buffers in schedule. spontaneous → no-reservation spots, free time slots.',
          group_harmony: 'high → universally enjoyable places for all companions. low → personal preference priority.',
          comfort_need: 'high → safe tourist areas, well-known neighborhoods, transport buffers. low → local neighborhoods, tight schedules OK.',
        },
      },
    },
    self_check_before_return: {
      instruction: 'Verify EACH check below. If any fails, fix before returning.',
      meals: 'For EACH day: (1) lunch restaurant at 11:00-14:30 exists? Dessert/snack shops do NOT count. (2) dinner restaurant at 17:00-21:30 exists? If missing → ADD one.',
      item_count: 'For EACH day: count items excluding transport/hotel. Compare to stamina max. If OVER → remove least essential.',
      dietary: 'For EACH restaurant/cafe/food-attraction: does the food type comply with dietary restrictions? If restaurant TYPE commonly includes restricted food → replace.',
      closed_days: 'For EACH place: does scheduled day-of-week conflict with closedDays? If YES → swap.',
      format: [
        'First item each day: transitMode=null?',
        'All estimatedCost in LOCAL currency (not KRW)?',
        'All placeNameSnapshot in "한국어 (현지어)" format?',
        'All placeConfidence set correctly?',
      ],
    },
    output_only: 'Return JSON only. No markdown, no explanation.',
  };
}

/** COMPACT 버전 — 게이트웨이 청크 요청용 */
function buildCompactSystemJSON() {
  return {
    output: 'JSON array only',
    item: '{dayNumber,orderIndex,placeNameSnapshot("한국어 (현지어)"),category,startTime(HH:MM),endTime,estimatedCost(int LOCAL),currency(ISO4217),priceConfidence,placeConfidence("verified"|"unverified"),notes(Korean),latitude,longitude,activityLevel,reasonTags(2-4 Korean),address,businessHours,closedDays,transitMode,transitDurationMin,transitSummary(Korean)}',
    rules: {
      '1_diet': 'ALL food items MUST comply with dietary restrictions. If restaurant TYPE commonly includes restricted food → choose different type.',
      '2_meals': 'EVERY day: lunch(11-14:30) + dinner(17-21:30). Dessert/snack shops do NOT count as lunch. Evening arrival → skip Day 1 lunch.',
      '3_routing': 'Route by proximity. Minimize backtracking.',
      '4_tags': 'reasonTags must be factually accurate.',
      '5_stamina': 'Low → max 3-4/day. Moderate → 4-6. High → 5-8.',
      '6_rental': "Rental car → transitMode='drive' always.",
      '7_closed': 'Check closedDays vs scheduled day-of-week.',
      '8_chains': 'Max 1 chain per trip. restaurant_preference="local-only" → 0 chains.',
      '9_confidence': 'placeConfidence="verified" only if certain. If unsure → "unverified".',
      '10_fields': 'arrival_time→Day1 schedule. morning_type: early→06-08, moderate→08-10, late→10-11. hotel_area→last activity nearby. minimize_walking→prefer transit. korean_menu_preferred→Korean menu priority.',
      '11_history': 'verified_places→prefer. previous_visits: 4-5★→similar, 1-2★→exclude.',
      '12_check': 'Before returning: verify lunch+dinner every day, dietary compliance, item count within stamina limit.',
    },
  };
}

// ─── Claude 전용 포맷 (자연어 섹션) ─────────────────────
// Claude는 구조화된 출력 API가 없으므로 자연어 지시가 JSON 스키마보다 효과적.

function formatForClaude(): string {
  return `You are an expert travel itinerary planner. Generate a detailed day-by-day itinerary.
Return ONLY a valid JSON object — no markdown fences, no explanation, no commentary.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return a JSON object with exactly this structure:
{
  "tripSummary": "1-paragraph Korean, warm conversational tone (친근하고 기대감을 주는 어투)",
  "advisories": {
    "weather": "날씨 정보",
    "safety": "안전 정보",
    "exchangeRate": "환율 정보",
    "holidays": "현지 공휴일/축제",
    "atmosphere": "현지 분위기",
    "disasters": "재해/주의사항",
    "unmatchedInterests": "관심사 태그 중 매칭 불가 항목과 대안 (모두 매칭 가능하면 null)",
    "other": "기타 참고사항 (계절 불일치 경고 포함)"
  },
  "items": [ ... array of item objects ... ]
}

═══════════════════════════════════════════════
ITEM FIELDS (each item in the "items" array)
═══════════════════════════════════════════════

Required fields for every item:
- dayNumber: integer starting from 1
- orderIndex: integer starting from 0 per day
- placeNameSnapshot: "한국어 이름 (현지어 이름)" format. Examples: "센소지 (浅草寺)", "에펠탑 (Tour Eiffel)". NEVER English-only.
- category: one of "attraction", "restaurant", "cafe", "shopping", "transport", "hotel"
- startTime: "HH:MM" 24h format (valid 06:00~23:59)
- endTime: "HH:MM" 24h format (valid 07:00~23:59)
- estimatedCost: integer in LOCAL currency (JPY, THB, EUR, etc.), per person. NEVER KRW for overseas.
- currency: ISO 4217 code matching destination
- priceConfidence: "confirmed" or "estimated"
- placeConfidence: "verified" if you are highly confident this place exists with this exact name, "unverified" if any doubt. Do NOT invent restaurant names.
- notes: Korean, 2-3 sentences of practical tips
- latitude: decimal number
- longitude: decimal number
- activityLevel: "light" (indoor, minimal walking), "moderate" (stairs/walking 1-2h), or "intense" (hiking, 3+ hours)
- reasonTags: array of 2-4 Korean tags without #. Must be factually accurate. No "숨은맛집" for chains. "anime/drama" only for ACTUAL filmed locations.
- address: local language address or null
- businessHours: e.g. "09:00-17:00" or null
- closedDays: Korean e.g. "월요일", "연중무휴", or null
- transitMode: one of "walk", "bus", "taxi", "subway", "train", "bicycle", "drive", "flight", "ferry", or null. MUST be null for first item of each day.
- transitDurationMin: integer or null
- transitSummary: Korean one-line e.g. "도보 5분" or null

═══════════════════════════════════════════════
RULE 1: MEALS — HIGHEST PRIORITY, NON-NEGOTIABLE
═══════════════════════════════════════════════

Lunch (EVERY day):
- Required: a "restaurant" item with startTime between 11:00~14:30
- A "cafe" counts as lunch ONLY IF it serves full meals (정식, 세트메뉴, 덮밥, 파스타 등)
- These do NOT count as lunch: dessert shops, bakeries, snack bars, 떡/과자/아이스크림/롤케이크/커피 전문점, street food stalls
- Exception: If arrival is afternoon (14:00+), Day 1 lunch may be omitted. If evening (17:00+), Day 1 lunch MUST be omitted.

Dinner (EVERY day, no exceptions):
- Required: a "restaurant" item with startTime between 17:00~21:30

If ANY day is missing lunch or dinner, ADD a restaurant before returning.
Maximum gap between meals: 2.5 hours without any restaurant or cafe.

═══════════════════════════════════════════════
RULE 2: ITEMS PER DAY
═══════════════════════════════════════════════

Count ONLY: attraction, restaurant, cafe, shopping. Do NOT count transport or hotel.
- Low stamina: min 3, max 4 (include cafe/rest breaks)
- Moderate stamina: min 4, max 6
- High stamina: min 5, max 8
NEVER exceed the max.

═══════════════════════════════════════════════
RULE 3: RESTAURANT SELECTION
═══════════════════════════════════════════════

Confidence: Only recommend restaurants you are CERTAIN exist. If uncertain, use a well-known establishment. Set placeConfidence accordingly.

Chain policy: International chains (이치란, 스타벅스, 코코이치방야, etc.) are allowed but max 1 chain per entire trip. If traveler.restaurant_preference is "local-only" → EXCLUDE all chains entirely.

Dietary: Apply restrictions to ALL food items — restaurant, cafe, AND food-related attractions (야타이, 시장, 푸드코트). If a restaurant TYPE commonly includes restricted food (e.g., izakaya for no-seafood), choose a different type.

Korean menu: If traveler.korean_menu_preferred is true → prioritize restaurants with Korean-language menus.

═══════════════════════════════════════════════
RULE 4: ROUTING & TRANSIT
═══════════════════════════════════════════════

Group each day by geographic area. Minimize backtracking.
Use REALISTIC travel times between cities.
Do NOT use "subway" for inter-city travel.
If traveler.transport_mode is "rental-car": ALL transitMode MUST be "drive" with realistic driving times. Day 1 must include rental cost + tolls + gas as a "transport" category item.
If traveler.minimize_walking is true: prefer short distances, use taxi/bus/subway between places instead of walking.

═══════════════════════════════════════════════
RULE 5: CLOSED DAYS & BUDGET
═══════════════════════════════════════════════

Before including ANY place, verify the scheduled day-of-week does NOT conflict with closedDays. If conflict, pick a different place.
All costs are PER PERSON. Note shared costs (hotel, car) in the notes field.

═══════════════════════════════════════════════
RULE 6: USER FIELD INTERPRETATION
═══════════════════════════════════════════════

Read these fields from the traveler object and apply accordingly:
- arrival_time: "afternoon" → Day 1 starts 14:00+, skip morning. "evening" → Day 1 starts 17:00+, dinner only.
- morning_type: Day 2+ start time — "early" → 06:00-08:00, "moderate" → 08:00-10:00, "late" → 10:00-11:00.
- hotel_area: Last activity each day should be near this area.
- adventure_level: "explorer" → hidden gems, off-the-beaten-path. "cautious" → verified popular spots only.
- verified_places: Prefer these. For non-verified, set placeConfidence="unverified".
- previous_visits: Rated 4-5★ → recommend similar. Rated 1-2★ → exclude. 3★/unrated → neutral.
- personality (if present): Read each tag and apply:
  social_energy: "high" → nightlife, group activities, local interaction spots. "low" → quiet cafes, private spaces, nature.
  novelty_seeking: "high" → local hidden gems, street food, cultural experiences, off-beaten-path. "low" → popular tourist spots, familiar cuisines.
  planning_style: "structured" → reservation-required spots, time buffers in schedule. "spontaneous" → no-reservation spots, free time slots.
  group_harmony: "high" → universally enjoyable places for all companions. "low" → personal preference priority.
  comfort_need: "high" → safe tourist areas, well-known neighborhoods, transport buffers. "low" → local neighborhoods, tight schedules OK.

═══════════════════════════════════════════════
SELF-CHECK (MANDATORY)
═══════════════════════════════════════════════

Before returning, verify ALL of these:
1. MEALS: Every day has lunch (11:00-14:30) AND dinner (17:00-21:30)? Dessert shops do NOT count as lunch.
2. ITEM COUNT: Each day within stamina limit? Count excludes transport/hotel.
3. DIETARY: All restaurants comply with dietary restrictions?
4. CLOSED DAYS: No conflicts with scheduled day-of-week?
5. FORMAT: First item each day has transitMode=null? All costs in LOCAL currency? All names in "한국어 (현지어)"? All placeConfidence set?
If any check fails, FIX it before returning.`;
}

// ─── OpenAI 전용 포맷 ─────────────────────────────────
// OpenAI는 response_format: { type: 'json_object' }와 함께 사용.
// Gemini 형식 기반이되, JSON 출력을 명시적으로 요구.

function formatForOpenAI(compact: boolean): string {
  const json = compact ? buildCompactSystemJSON() : buildSystemJSON();

  const preamble = compact
    ? `You are an expert travel itinerary planner. Return a valid JSON array only — no markdown, no explanation.
CRITICAL CHECKLIST:
1. Every day has lunch (11:00-14:30) restaurant — dessert/snack shops do NOT count
2. Every day has dinner (17:00-21:30) restaurant
3. Dietary restrictions fully respected
4. closedDays do not conflict with scheduled day
5. placeConfidence set correctly for each item

Rules:`
    : `You are an expert travel itinerary planner. Generate a detailed day-by-day itinerary.
You MUST return a valid JSON object. No markdown fences, no explanation, no commentary — raw JSON only.

CRITICAL (non-negotiable):
- Every day MUST have BOTH lunch (11:00-14:30) AND dinner (17:00-21:30) restaurants
- Dessert shops, bakeries, snack bars do NOT count as lunch
- Before including any place, CHECK its closedDays against the scheduled day-of-week
- All estimatedCost in LOCAL currency, NEVER KRW
- All placeNameSnapshot in "한국어 (현지어)" format
- Max 1 chain restaurant per entire trip
- placeConfidence: "verified" only if certain, "unverified" if any doubt

SELF-CHECK before returning:
□ Every day has lunch (real restaurant)? □ Every day has dinner?
□ Dietary restrictions met for ALL food items? □ No closedDay conflicts?
□ Items within stamina limit? □ Max 1 chain restaurant total? □ placeConfidence set?

Detailed rules and item schema:`;

  return `${preamble}\n${JSON.stringify(json, null, compact ? 0 : 2)}`;
}

// extractBig5 → utils/profileUtils.ts에서 import

// ─── 유저 프롬프트 JSON (v2) ─────────────────────────
// 설계 원칙: 시스템 프롬프트 = 규칙, 유저 프롬프트 = 데이터.
// 규칙(rule, instruction, reminder)을 전부 제거하고 순수 데이터만 전송.
// 시스템 프롬프트가 값을 보고 자동으로 규칙을 적용한다.

function buildTravelerJSON(profile: FullProfileInput) {
  const isRental = detectRentalCar(profile);

  // ─ 플랫 구조: 중첩 제거, 출력에 영향 주는 필드만 ─
  const traveler: Record<string, unknown> = {
    travel_pace: profile.travelPace,
    budget: profile.budgetRange,
    stamina: profile.lifestyle?.stamina || 'moderate',
    morning_type: profile.lifestyle?.morningType || 'moderate',
    companion: profile.companion,
  };

  // adventure_level: balanced가 아닐 때만 포함 (기본값은 토큰 절약)
  const adventure = profile.lifestyle?.adventureLevel;
  if (adventure && adventure !== 'balanced') {
    traveler.adventure_level = adventure;
  }

  // photo_style: casual이 아닐 때만 포함
  const photo = profile.lifestyle?.photoStyle;
  if (photo && photo !== 'casual') {
    traveler.photo_style = photo;
  }

  // 도착 시간: undecided가 아닐 때만 (시스템 프롬프트가 Day 1 규칙 자동 적용)
  if (profile.arrivalTime && profile.arrivalTime !== 'undecided') {
    traveler.arrival_time = profile.arrivalTime;
  }

  // 숙소 위치 (시스템 프롬프트가 "마지막 일정은 숙소 근처" 규칙 적용)
  if (profile.hotelArea) {
    traveler.hotel_area = sanitize(profile.hotelArea, 100);
  }

  // 식단 제한: 값만 (규칙은 시스템 프롬프트)
  const dietRestrictions = [
    ...(profile.foodPreference || []),
    ...(profile.customFoodPreference ? [sanitize(profile.customFoodPreference, 100)] : []),
  ].filter(Boolean);
  if (dietRestrictions.length > 0) {
    traveler.diet_restrictions = dietRestrictions;
  }

  // 관심사: 값만 (규칙은 시스템 프롬프트)
  const interests = [
    ...(profile.interests || []),
    ...(profile.customInterests ? [sanitize(profile.customInterests, 200)] : []),
  ].filter(Boolean);
  if (interests.length > 0) {
    traveler.interests = interests;
  }

  // 특별 요청 → 구조화 가능한 것은 전용 필드로 추출, 나머지만 자유 텍스트
  if (profile.specialNote) {
    const note = profile.specialNote;

    // 구조화 필드 추출 (시스템 프롬프트가 각 필드를 보고 규칙 적용)
    if (/숨은\s*맛집|현지인\s*맛집|로컬|local.only/i.test(note)) {
      traveler.restaurant_preference = 'local-only';
    }
    if (/한국어\s*메뉴|korean\s*menu/i.test(note)) {
      traveler.korean_menu_preferred = true;
    }
    if (/걷는.*최소|도보.*최소|minimize.*walk|최소.*걸/i.test(note)) {
      traveler.minimize_walking = true;
    }

    // 구조화 키워드를 제거한 나머지 자유 텍스트
    const freeText = note
      .replace(/현지인만\s*아는\s*숨은\s*맛집\s*위주로?\s*추천해?\s*주세요?/g, '')
      .replace(/한국어\s*메뉴판?\s*있는\s*식당\s*우선/g, '')
      .replace(/체력이?\s*약해서?\s*걷는\s*거리\s*최소화해?\s*주세요?/g, '')
      .replace(/[,，、\s]+/g, ' ')
      .trim();
    if (freeText.length > 2) {
      traveler.special_requests = [sanitize(freeText, 300)];
    }
  }

  // 렌터카: 값만 (규칙은 시스템 프롬프트)
  if (isRental) {
    traveler.transport_mode = 'rental-car';
  }

  // Big Five 성격 → 행동 태그 (moderate는 생략 → 토큰 절약)
  // big5는 두 가지 형태로 올 수 있음:
  //   1. nested: profile.big5 = { extraversion, agreeableness, ... } (validator에서)
  //   2. flat: profile.big5Extraversion, ... (DB에서)
  const big5 = extractBig5(profile);
  if (big5) {
    const tags = mapBig5ToTravelTags(big5);
    const compact = getCompactPersonality(tags);
    if (compact) {
      traveler.personality = compact;
    }
  }

  return traveler;
}

// ─── 검증된 장소 (데이터만 — 규칙은 시스템 프롬프트) ─────

function buildVerifiedPlacesJSON(verifiedPlaces?: VerifiedPlace[]) {
  if (!verifiedPlaces || verifiedPlaces.length === 0) return null;

  return verifiedPlaces.map(vp => ({
    name: sanitize(vp.displayName, 100),
    category: vp.category || 'attraction',
    googlePlaceId: vp.googlePlaceId,
    address: vp.address ? sanitize(vp.address, 200) : null,
    rating: vp.rating || null,
    businessHours: vp.businessHours ? sanitize(vp.businessHours, 50) : null,
    closedDays: vp.closedDays || null,
    lat: vp.latitude,
    lng: vp.longitude,
  }));
}

// ─── 이전 여행 경험 (데이터만 — 규칙은 시스템 프롬프트) ──

function buildPreviousExperienceJSON(previousVisits?: PreviousVisit[]) {
  if (!previousVisits || previousVisits.length === 0) return null;

  const rated = previousVisits.filter(v => v.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const unrated = previousVisits.filter(v => v.rating == null);

  return {
    rated: rated.map(v => ({
      name: sanitize(v.placeNameSnapshot, 100),
      rating: v.rating,
      memo: v.memo ? sanitize(v.memo, 50) : null,
    })),
    unrated: unrated.length > 0 ? unrated.map(v => sanitize(v.placeNameSnapshot, 60)) : undefined,
  };
}

// ─── 장소 선호도 (데이터만) ──────────────────────────

function buildPlacePreferencesJSON(placePreferences?: PlacePreferenceInput[]) {
  if (!placePreferences || placePreferences.length === 0) return null;

  const excludes = placePreferences.filter(p => p.preference === 'exclude').map(p => sanitize(p.placeName, 100));
  const revisits = placePreferences.filter(p => p.preference === 'revisit').map(p => sanitize(p.placeName, 100));

  return {
    exclude: excludes.length > 0 ? excludes : undefined,
    must_include: revisits.length > 0 ? revisits : undefined,
  };
}

// ─── 공개 API ────────────────────────────────────────
// provider별 최적 포맷으로 시스템 프롬프트 생성.
// - gemini: JSON 하이브리드 (preamble + JSON.stringify) — responseSchema와 함께 사용
// - claude: 자연어 섹션 (═══ 구분) — 구조화 출력 API 없으므로 prose가 효과적
// - openai: JSON 하이브리드 + JSON mode 지시 — response_format과 함께 사용

export function buildSystemPrompt(provider: AIProviderType = 'gemini', compact = false): string {
  // Claude는 compact 모드 없음 (게이트웨이 불필요)
  if (provider === 'claude') return formatForClaude();
  if (provider === 'openai') return formatForOpenAI(compact);

  // Gemini (기본값) — 현행 JSON 하이브리드 유지
  const json = compact ? buildCompactSystemJSON() : buildSystemJSON();

  const preamble = compact
    ? `You are an expert travel itinerary planner. Return JSON array only. Follow the rules below STRICTLY.
CRITICAL CHECKLIST (verify before returning):
1. Every day has lunch (11:00-14:30) restaurant — dessert/snack shops do NOT count
2. Every day has dinner (17:00-21:30) restaurant
3. Dietary restrictions fully respected for ALL food items
4. closedDays do not conflict with scheduled day
5. placeConfidence set correctly

Rules:`
    : `You are an expert travel itinerary planner. Generate a detailed day-by-day itinerary as JSON.
Follow ALL rules below STRICTLY — no exceptions.

CRITICAL (non-negotiable):
- Every single day MUST have BOTH lunch (11:00-14:30) AND dinner (17:00-21:30) restaurants
- Dessert shops, bakeries, snack bars do NOT count as lunch
- If you notice a day is missing dinner, ADD a dinner restaurant before returning
- Before including any place, CHECK its closedDays against the scheduled day-of-week
- All estimatedCost in LOCAL currency, NEVER KRW
- All placeNameSnapshot in "한국어 (현지어)" format

SELF-CHECK before returning your response:
□ Every day has lunch (real restaurant, NOT dessert/snack)? □ Every day has dinner?
□ Dietary restrictions met for ALL food items? □ No closedDay conflicts?
□ Items within stamina limit? □ Max 1 chain restaurant total? □ placeConfidence set correctly?

Detailed rules and item schema:`;

  return `${preamble}\n${JSON.stringify(json, null, compact ? 0 : 2)}`;
}

export function buildUserPrompt(
  profile: FullProfileInput,
  input: GenerateInput,
  placePreferences?: PlacePreferenceInput[],
  verifiedPlaces?: VerifiedPlace[],
  previousVisits?: PreviousVisit[],
): string {
  const dayCount = getDayCount(input.startDate, input.endDate);

  // v2: 데이터만 — 규칙/지시/출력 형식은 시스템 프롬프트에 있음
  const prompt: Record<string, unknown> = {
    destination: sanitize(input.destination, 100),
    dates: {
      start: input.startDate,
      end: input.endDate,
      days: dayCount,
    },
    traveler: buildTravelerJSON(profile),
  };

  // 조건부 데이터 (있을 때만 포함 — 빈 필드 토큰 절약)
  const placePref = buildPlacePreferencesJSON(placePreferences);
  if (placePref) prompt.place_preferences = placePref;

  const verified = buildVerifiedPlacesJSON(verifiedPlaces);
  if (verified) prompt.verified_places = verified;

  const prevExp = buildPreviousExperienceJSON(previousVisits);
  if (prevExp) prompt.previous_visits = prevExp;

  return `Generate a ${dayCount}-day travel itinerary.\n\n${JSON.stringify(prompt, null, 2)}`;
}

/**
 * 일 단위 프롬프트 — 5일+ 여행에서 하루 단위 요청.
 */
export function buildSingleDayPrompt(
  profile: FullProfileInput,
  input: GenerateInput,
  dayNumber: number,
  totalDays: number,
  previousPlaces: string[],
  placePreferences?: PlacePreferenceInput[],
  verifiedPlaces?: VerifiedPlace[],
): string {
  const recentPlaces = previousPlaces.slice(-8);

  const stamina = profile.lifestyle?.stamina || 'moderate';
  const itemLimits: Record<string, string> = { low: '3-4', moderate: '4-6', high: '5-8' };

  const prompt: Record<string, unknown> = {
    request: `Generate Day ${dayNumber}/${totalDays} itinerary`,
    destination: sanitize(input.destination, 100),
    dates: { start: input.startDate, end: input.endDate },
    traveler: buildTravelerJSON(profile),
    day_rules: {
      mandatory_lunch: {
        count: 1,
        time_range: ['11:00', '14:30'],
        category: 'restaurant',
        cafe_exception: 'Cafe counts as lunch ONLY IF it serves full meals (정식, 세트메뉴, 덮밥)',
        NOT_lunch: 'dessert shops, bakeries, snack bars, 떡/과자/아이스크림/커피 전문점',
      },
      mandatory_dinner: { count: 1, time_range: ['17:00', '21:30'], category: 'restaurant' },
      total_items: itemLimits[stamina] || '4-6',
      meal_gap_max_hours: 2.5,
      all_places_in: sanitize(input.destination, 50),
      routing: 'geographic proximity, minimize backtracking',
      closed_day_check: 'Verify scheduled day-of-week does NOT conflict with closedDays. If conflict → different place.',
      chain_policy: 'Max 1 chain restaurant per entire trip.',
      placeConfidence: '"verified" if certain place exists, "unverified" if any doubt.',
    },
    do_not_repeat: recentPlaces.length > 0 ? recentPlaces : undefined,
    output: {
      format: 'JSON array',
      dayNumber,
      orderIndex_from: 0,
      name_format: '한국어 (현지어)',
      notes_language: 'Korean',
      first_item_transit: null,
    },
  };

  const placePref = buildPlacePreferencesJSON(placePreferences);
  if (placePref) prompt.place_preferences = placePref;

  const verified = buildVerifiedPlacesJSON(verifiedPlaces);
  if (verified) {
    prompt.verified_places = verified;
    (prompt.output as Record<string, unknown>).include_verified_fields = true;
  }

  return `Generate Day ${dayNumber}/${totalDays} itinerary. MUST include 1 lunch (11:00-14:30) + 1 dinner (17:00-21:30) restaurant.
Dessert/snack shops do NOT count as lunch. Check closedDays before including. placeConfidence required.
Korean notes. "한국어 (현지어)" names. Max ${itemLimits[stamina] || '4-6'} items (stamina: ${stamina}).

${JSON.stringify(prompt, null, 2)}`;
}

/**
 * 메타데이터 전용 프롬프트 — tripSummary + advisories만 요청.
 */
export function buildMetadataPrompt(
  destination: string,
  startDate: string,
  endDate: string,
  placeNames: string[],
): string {
  const prompt = {
    request: 'Generate trip metadata only (no itinerary items)',
    destination: sanitize(destination, 100),
    dates: { start: startDate, end: endDate },
    places_visited: placeNames.slice(0, 30),
    output: {
      format: 'JSON object',
      fields: {
        tripSummary: '1-paragraph Korean, warm conversational tone (친근하고 기대감을 주는 어투)',
        advisories: {
          weather: '날씨 정보 (여행 시기 기준)',
          safety: '안전 정보',
          exchangeRate: '환율 정보',
          holidays: '현지 공휴일/축제',
          atmosphere: '현지 분위기',
          disasters: '재해/주의사항',
          other: '기타 참고사항 (계절 불일치 시 경고 포함)',
        },
      },
      no_markdown: true,
    },
  };

  return `Generate trip metadata only (tripSummary + advisories). JSON only, no markdown.
If there are seasonal mismatches (e.g. requesting autumn leaves in summer), mention in advisories.other.

${JSON.stringify(prompt, null, 2)}`;
}

/**
 * 청크 단위 프롬프트 (게이트웨이 타임아웃 방지용).
 * 하루를 오전/오후로 나눠 요청.
 */
export type DayChunk = 'morning' | 'afternoon';

export function buildChunkPrompt(
  profile: FullProfileInput,
  input: GenerateInput,
  dayNumber: number,
  totalDays: number,
  chunk: DayChunk,
  previousPlaces: string[],
  dayPreviousItems: string[],
  placePreferences?: PlacePreferenceInput[],
  verifiedPlaces?: VerifiedPlace[],
  lastEndTime?: string,
): string {
  const ls = profile.lifestyle;
  const isRental = detectRentalCar(profile);
  const allPrev = [...previousPlaces, ...dayPreviousItems];

  // stamina 기반 아이템 수 (travelPace 대신 stamina 사용 — 시스템 프롬프트와 일관성)
  const stamina = ls?.stamina || 'moderate';
  const itemCounts: Record<string, { morning: string; afternoon: string }> = {
    low: { morning: '1-2', afternoon: '1-2' },      // 합계 3-4/day
    moderate: { morning: '2-3', afternoon: '2-3' },  // 합계 4-6/day
    high: { morning: '3', afternoon: '3-4' },        // 합계 5-8/day
  };
  const counts = itemCounts[stamina] || itemCounts.moderate;

  const chunkConfig = chunk === 'morning'
    ? {
        label: 'morning~lunch',
        items: counts.morning,
        mandatory_meal: {
          type: 'lunch',
          time_range: ['11:00', '14:30'],
          category: 'restaurant',
          cafe_exception: 'Cafe counts as lunch ONLY IF it serves full meals (정식, 세트메뉴, 덮밥)',
          NOT_lunch: 'dessert shops, bakeries, snack bars, 커피 전문점',
        },
        time_hint: 'End chunk before 15:00',
        morning_type: ls?.morningType === 'late' ? 'Start 10-11am, brunch OK' : ls?.morningType === 'early' ? 'Start 6-8am, sunrise OK' : 'Start 8-10am',
      }
    : {
        label: 'afternoon~evening',
        items: counts.afternoon,
        mandatory_meal: {
          type: 'dinner',
          time_range: ['17:00', '21:30'],
          category: 'restaurant',
        },
        time_hint: 'Fill until ~22:00',
        continue_from: lastEndTime ? `Start AFTER ${lastEndTime}` : undefined,
      };

  const prompt: Record<string, unknown> = {
    request: `${chunkConfig.items} items for Day ${dayNumber}/${totalDays} ${chunkConfig.label}`,
    destination: sanitize(input.destination, 100),
    all_places_in: sanitize(input.destination, 50),
    chunk: chunkConfig,
    traveler: {
      mbti: profile.mbtiStyle,
      pace: profile.travelPace,
      budget: profile.budgetRange,
      companion: profile.companion,
      stamina: ls?.stamina || 'moderate',
      stamina_rule: (ls?.stamina === 'low' || ls?.stamina === 'moderate') ? 'No intense activities' : null,
      adventure: ls?.adventureLevel !== 'balanced' ? (ls?.adventureLevel === 'explorer' ? 'hidden gems, local alleys' : 'verified tourist spots only') : null,
      photo: ls?.photoStyle === 'sns' ? 'Include Instagram spots' : null,
    },
  };

  // 식단
  if (profile.foodPreference?.length || profile.customFoodPreference) {
    (prompt.traveler as Record<string, unknown>).diet = {
      restrictions: [...(profile.foodPreference || []), profile.customFoodPreference].filter(Boolean),
      rule: 'MUST respect',
    };
  }

  // 관심사
  if (profile.interests?.length || profile.customInterests) {
    (prompt.traveler as Record<string, unknown>).interests = [...(profile.interests || []), profile.customInterests].filter(Boolean);
  }

  // 특별 요청
  if (profile.specialNote) {
    prompt.special_request = sanitize(profile.specialNote, 200);
  }

  // 도착 시간 (Day 1 morning만)
  if (dayNumber === 1 && chunk === 'morning' && profile.arrivalTime && profile.arrivalTime !== 'undecided') {
    prompt.arrival = profile.arrivalTime === 'afternoon' ? 'Arrives afternoon. Start 14:00-15:00.'
      : profile.arrivalTime === 'evening' ? 'Arrives evening. Only dinner+short activity.'
      : 'Arrives morning. Full day OK.';
  }

  // 호텔
  if (profile.hotelArea) {
    prompt.hotel = { area: sanitize(profile.hotelArea, 50), instruction: 'Last activity near hotel' };
  }

  // 렌터카
  if (isRental) {
    prompt.transport = { mode: 'drive', rule: 'ALL transitMode="drive". Realistic driving. No subway.' };
  }

  // 중복 방지
  if (allPrev.length > 0) {
    prompt.do_not_repeat = allPrev;
  }

  // 장소 선호
  const placePref = buildPlacePreferencesJSON(placePreferences);
  if (placePref) prompt.place_preferences = placePref;

  // 검증된 장소 (압축)
  if (verifiedPlaces && verifiedPlaces.length > 0) {
    prompt.verified_places = {
      instruction: 'Prefer these. Others: verified=false, googlePlaceId=null.',
      list: verifiedPlaces.map(vp => `${vp.displayName}|${vp.category}|${vp.googlePlaceId}`),
    };
  }

  // 출력 형식 + 추가 규칙
  const startOrderIndex = chunk === 'morning' ? 0 : dayPreviousItems.length;
  prompt.output = {
    format: 'JSON array',
    dayNumber,
    orderIndex_from: startOrderIndex,
    name_format: '한국어 (현지어)',
    notes_language: 'Korean',
    first_item_transit: chunk === 'morning' ? null : undefined,
    routing: 'geographic proximity, minimize backtracking',
  };
  prompt.critical_rules = {
    closed_day_check: 'Verify scheduled day-of-week vs closedDays. If conflict → different place.',
    placeConfidence: '"verified" if certain, "unverified" if any doubt. Do NOT invent restaurant names.',
    chain_policy: 'Max 1 chain restaurant per entire trip.',
    dietary_scope: 'Apply to ALL food items: restaurant, cafe, AND food-related attractions.',
  };

  const mealReminder = chunk === 'afternoon'
    ? 'MUST include 1 dinner restaurant (17:00-21:30).'
    : 'MUST include 1 lunch restaurant (11:00-14:30). Dessert/snack shops do NOT count.';

  return `${(prompt.request as string)}. ${mealReminder}
Check closedDays before including. placeConfidence required.
Korean notes. "한국어 (현지어)" format.

${JSON.stringify(prompt, null, 2)}`;
}

// ---------------------------------------------------------------------------
// repairDay 프롬프트 — 부분 재생성용
// ---------------------------------------------------------------------------

import type { DayIssue } from './itineraryValidation';

/**
 * 하루치 검증 실패 시, 기존 아이템 + 문제 설명을 전달하여
 * 수정된 하루 일정을 재생성하도록 요청하는 프롬프트.
 */
export function buildRepairPrompt(
  dayItems: { placeNameSnapshot: string; category: string; startTime: string; endTime: string }[],
  issues: DayIssue[],
  dayNum: number,
  destination: string,
): string {
  const issueDescriptions = issues.map(issue => {
    switch (issue.type) {
      case 'missing_lunch':
        return `- 점심 식당이 없습니다. 11:00~14:30 사이에 레스토랑 1개를 추가하세요.`;
      case 'missing_dinner':
        return `- 저녁 식당이 없습니다. 17:00~21:30 사이에 레스토랑 1개를 추가하세요.`;
      case 'time_overlap':
        return `- 시간이 겹칩니다: ${issue.detail}. 시간을 조정하세요.`;
      case 'too_many_items':
        return `- 아이템이 너무 많습니다: ${issue.detail}. 덜 중요한 항목을 제거하세요.`;
      case 'arrival_mismatch':
        return `- Day 1은 저녁 도착입니다. 17:00 이후부터 시작하세요.`;
      case 'negative_time':
        return `- 비정상 시간이 있습니다: ${issue.detail}. 06:00~23:59 범위로 수정하세요.`;
      default:
        return `- ${issue.detail}`;
    }
  });

  const currentSchedule = dayItems.map(item =>
    `  ${item.startTime}-${item.endTime} [${item.category}] ${item.placeNameSnapshot}`
  ).join('\n');

  return `Fix Day ${dayNum} of a ${destination} travel itinerary.

CURRENT SCHEDULE (has problems):
${currentSchedule}

PROBLEMS TO FIX:
${issueDescriptions.join('\n')}

INSTRUCTIONS:
- Return the COMPLETE fixed Day ${dayNum} as a JSON array of items.
- Keep existing good items, only fix the problems listed above.
- All place names must be "한국어 (현지어)" format.
- All notes in Korean.
- Maintain the same item schema (dayNumber, orderIndex, placeNameSnapshot, category, startTime, endTime, estimatedCost, currency, notes, latitude, longitude, activityLevel, reasonTags, transitMode, transitDurationMin, transitSummary).`;
}
