import type { FullProfileInput } from '@/lib/validators/profile';
import type { GenerateInput, PlacePreferenceInput, VerifiedPlace, PreviousVisit } from './types';
import { getDayCount } from '@/utils/date';

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

// ─── 입력 새니타이즈 ─────────────────────────────────
const sanitize = (s: string, max = 200) => s.replace(/[\x00-\x1f"""]/g, '').slice(0, max);

// ─── 렌터카 감지 ─────────────────────────────────────
function detectRentalCar(profile: FullProfileInput): boolean {
  const text = `${profile.specialNote || ''} ${profile.customInterests || ''}`.toLowerCase();
  return /렌터카|렌트카|rental\s*car|자차|자가용|drive|드라이브/.test(text);
}

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
        lunch: { required: true, every_day: true, time_range: ['11:00', '14:30'], category: ['restaurant', 'cafe'] },
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
      budget: {
        cost_unit: 'PER PERSON',
        shared_costs: "Note in 'notes' when shared (hotel, rental car) vs per-person (meals, entrance)",
      },
    },
    self_check_before_return: [
      'Every day has lunch (11:00-14:30) restaurant/cafe? If NO → add one.',
      'Every day has dinner (17:00-21:30) restaurant? If NO → add one.',
      'No gap > 2.5 hours without restaurant/cafe?',
      'Items per day within stamina limit?',
      'No closedDays conflicts with scheduled day-of-week?',
      'First item each day: transitMode=null?',
      'All estimatedCost in LOCAL currency (not KRW)?',
      'All placeNameSnapshot in 한국어 (현지어) format?',
    ],
    output_only: 'Return JSON only. No markdown, no explanation.',
  };
}

/** COMPACT 버전 — 게이트웨이 청크 요청용 */
function buildCompactSystemJSON() {
  return {
    output: 'JSON array only',
    item: '{dayNumber,orderIndex,placeNameSnapshot("한국어 (현지어)"),category,startTime(HH:MM),endTime,estimatedCost(int LOCAL),currency(ISO4217),priceConfidence,notes(Korean),latitude,longitude,activityLevel,reasonTags(2-4 Korean),address,businessHours,closedDays,transitMode,transitDurationMin,transitSummary(Korean)}',
    rules: {
      '1_diet': 'ALL restaurants MUST comply with dietary restrictions.',
      '2_meals': 'EVERY day: lunch(11-14:30) + dinner(17-21:30) — NO EXCEPTIONS.',
      '3_routing': 'Route by proximity. Minimize backtracking.',
      '4_tags': 'reasonTags must be factually accurate.',
      '5_stamina': 'Low → max 3-4/day. Moderate → 4-6. High → 5-8.',
      '6_rental': "Rental car → transitMode='drive' always.",
      '7_closed': 'Check closedDays vs scheduled day-of-week.',
      '8_check': 'Before returning: verify lunch+dinner every day.',
    },
  };
}

// ─── 유저 프롬프트 JSON ─────────────────────────────

function buildTravelerJSON(profile: FullProfileInput) {
  const companionDesc: Record<string, string> = {
    solo: 'solo traveler',
    couple: 'couple (include romantic spots)',
    friends: 'friends group (active, food & fun)',
    family: 'family (comfortable routes)',
    'family-kids': 'family with kids (stroller accessible, kid-friendly, no bars/clubs)',
    business: 'business/workation (efficient routes, cafes with wifi)',
    other: 'other',
  };

  const arrivalDesc: Record<string, string> = {
    morning: 'Day 1 full day from ~10:00',
    afternoon: 'Day 1 starts ~14:00, skip morning',
    evening: 'Day 1: dinner + short activity only',
  };

  const isRental = detectRentalCar(profile);

  const traveler: Record<string, unknown> = {
    mbti: profile.mbtiStyle,
    travel_pace: profile.travelPace,
    budget: profile.budgetRange,
    lifestyle: {
      morning_type: profile.lifestyle?.morningType || 'moderate',
      stamina: profile.lifestyle?.stamina || 'moderate',
      adventure_level: profile.lifestyle?.adventureLevel || 'balanced',
      photo_style: profile.lifestyle?.photoStyle || 'casual',
    },
    companion: {
      type: profile.companion,
      description: companionDesc[profile.companion] || profile.companion,
    },
  };

  // 식단 제한
  if (profile.foodPreference?.length || profile.customFoodPreference) {
    traveler.diet = {
      restrictions: profile.foodPreference || [],
      custom: profile.customFoodPreference ? sanitize(profile.customFoodPreference, 100) : '',
      rule: 'ALL restaurants MUST comply. No exceptions.',
    };
  } else {
    traveler.diet = { restrictions: [], rule: 'No restrictions' };
  }

  // 관심사
  if (profile.interests?.length || profile.customInterests) {
    traveler.interests = {
      tags: profile.interests || [],
      custom: profile.customInterests ? sanitize(profile.customInterests, 200) : '',
      rule: 'Include places genuinely matching these. Anime/drama: ACTUAL locations only. 빈티지: actual vintage districts.',
    };
  }

  // 도착 시간
  if (profile.arrivalTime && profile.arrivalTime !== 'undecided') {
    traveler.arrival = {
      time: profile.arrivalTime,
      day1_instruction: arrivalDesc[profile.arrivalTime] || profile.arrivalTime,
    };
  }

  // 숙소
  if (profile.hotelArea) {
    traveler.hotel_area = {
      area: sanitize(profile.hotelArea, 100),
      instruction: 'Last activity each day near hotel',
    };
  }

  // 특별 요청
  if (profile.specialNote) {
    traveler.special_request = sanitize(profile.specialNote, 500);
  }

  // 교통수단 오버라이드
  if (isRental) {
    traveler.transport_override = {
      mode: 'drive',
      instruction: 'ALL transitMode MUST be "drive". Realistic driving times. Include parking tips. No subway/train.',
      day1_include: 'Rental cost + highway tolls + gas as "transport" category item.',
    };
  }

  // 비용 노트 (동행자 타입별)
  if (profile.companion === 'family' || profile.companion === 'family-kids') {
    traveler.cost_note = 'Family trip — estimatedCost PER PERSON. Shared costs (hotel, car) noted in notes.';
  } else if (profile.companion === 'friends') {
    traveler.cost_note = 'Group trip — all costs PER PERSON. Shared costs noted in notes.';
  }

  return traveler;
}

// ─── 검증된 장소 ─────────────────────────────────────

function buildVerifiedPlacesJSON(verifiedPlaces?: VerifiedPlace[]) {
  if (!verifiedPlaces || verifiedPlaces.length === 0) return null;

  return {
    instruction: 'Prefer these verified places. Others: verified=false, googlePlaceId=null.',
    places: verifiedPlaces.map(vp => ({
      name: sanitize(vp.displayName, 100),
      category: vp.category || 'attraction',
      googlePlaceId: vp.googlePlaceId,
      address: vp.address ? sanitize(vp.address, 200) : null,
      rating: vp.rating || null,
      businessHours: vp.businessHours ? sanitize(vp.businessHours, 50) : null,
      closedDays: vp.closedDays || null,
      latitude: vp.latitude,
      longitude: vp.longitude,
    })),
  };
}

// ─── 이전 여행 경험 ──────────────────────────────────

function buildPreviousExperienceJSON(previousVisits?: PreviousVisit[]) {
  if (!previousVisits || previousVisits.length === 0) return null;

  const rated = previousVisits.filter(v => v.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const unrated = previousVisits.filter(v => v.rating == null);

  return {
    instruction: 'This traveler visited this city before. Use ratings to improve.',
    rules: {
      '4-5_stars': 'Recommend similar + allow revisit',
      '1-2_stars': 'Exclude + suggest better alternative',
      '3_or_unrated': 'Neutral (can include or exclude)',
    },
    rated_places: rated.map(v => ({
      name: sanitize(v.placeNameSnapshot, 100),
      rating: v.rating,
      memo: v.memo ? sanitize(v.memo, 50) : null,
      action: v.rating! >= 4 ? 'recommend_similar' : v.rating! <= 2 ? 'exclude' : 'neutral',
    })),
    unrated_places: unrated.map(v => sanitize(v.placeNameSnapshot, 60)),
  };
}

// ─── 장소 선호도 ─────────────────────────────────────

function buildPlacePreferencesJSON(placePreferences?: PlacePreferenceInput[]) {
  if (!placePreferences || placePreferences.length === 0) return null;

  const excludes = placePreferences.filter(p => p.preference === 'exclude').map(p => sanitize(p.placeName, 100));
  const revisits = placePreferences.filter(p => p.preference === 'revisit').map(p => sanitize(p.placeName, 100));

  return {
    exclude: excludes.length > 0 ? excludes : undefined,
    must_include: revisits.length > 0 ? revisits : undefined,
  };
}

// ─── 공개 API (함수 시그니처 유지) ────────────────────

export function buildSystemPrompt(compact = false): string {
  const json = compact ? buildCompactSystemJSON() : buildSystemJSON();

  // 자연어 프레이밍 + JSON 규칙 (하이브리드 프롬프트)
  // AI는 자연어 지시를 먼저 읽고, JSON을 참조 규칙으로 사용
  const preamble = compact
    ? `You are an expert travel itinerary planner. Return JSON array only. Follow the rules below STRICTLY.
CRITICAL CHECKLIST (verify before returning):
1. Every day has lunch (11:00-14:30) restaurant/cafe
2. Every day has dinner (17:00-21:30) restaurant
3. All places in the destination city
4. Dietary restrictions fully respected
5. closedDays do not conflict with scheduled day

Rules:`
    : `You are an expert travel itinerary planner. Generate a detailed day-by-day itinerary as JSON.
Follow ALL rules below STRICTLY — no exceptions.

CRITICAL (non-negotiable):
- Every single day MUST have BOTH lunch (11:00-14:30) AND dinner (17:00-21:30) restaurants
- If you notice a day is missing dinner, ADD a dinner restaurant before returning
- Before including any place, CHECK its closedDays against the scheduled day-of-week
- All estimatedCost in LOCAL currency, NEVER KRW
- All placeNameSnapshot in "한국어 (현지어)" format

SELF-CHECK before returning your response:
□ Every day has lunch? □ Every day has dinner? □ No closedDay conflicts? □ Items within stamina limit?

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

  const prompt: Record<string, unknown> = {
    request: 'Generate travel itinerary',
    destination: sanitize(input.destination, 100),
    dates: {
      start: input.startDate,
      end: input.endDate,
      days: dayCount,
    },
    traveler: buildTravelerJSON(profile),
    output_requirements: {
      notes_language: 'Korean',
      placeNameSnapshot_format: '한국어 이름 (현지어 이름)',
      generate: `${dayCount}-day optimized itinerary`,
    },
  };

  const placePref = buildPlacePreferencesJSON(placePreferences);
  if (placePref) prompt.place_preferences = placePref;

  const verified = buildVerifiedPlacesJSON(verifiedPlaces);
  if (verified) {
    prompt.verified_places = verified;
    prompt.output_requirements = {
      ...(prompt.output_requirements as Record<string, unknown>),
      include_fields: 'For each item: "verified" (boolean) and "googlePlaceId" (string or null)',
    };
  }

  const prevExp = buildPreviousExperienceJSON(previousVisits);
  if (prevExp) prompt.previous_experience = prevExp;

  // 도착시간 강조 (자연어 — AI가 무시하지 못하도록)
  let arrivalWarning = '';
  if (profile.arrivalTime === 'evening') {
    arrivalWarning = '\nIMPORTANT: Traveler arrives in the EVENING. Day 1 should start from 17:00 or later. Do NOT schedule morning/afternoon activities on Day 1.';
  } else if (profile.arrivalTime === 'afternoon') {
    arrivalWarning = '\nIMPORTANT: Traveler arrives in the AFTERNOON. Day 1 should start from 14:00 or later. Do NOT schedule morning activities on Day 1.';
  }

  return `Generate a ${dayCount}-day travel itinerary for the following traveler.
Write all "notes" in Korean. Format all place names as "한국어 이름 (현지어 이름)".
REMINDER: Include lunch AND dinner restaurants EVERY day.${arrivalWarning}

Traveler and trip details:
${JSON.stringify(prompt, null, 2)}`;
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

  const prompt: Record<string, unknown> = {
    request: `Generate Day ${dayNumber}/${totalDays} itinerary`,
    destination: sanitize(input.destination, 100),
    dates: { start: input.startDate, end: input.endDate },
    traveler: buildTravelerJSON(profile),
    day_rules: {
      mandatory_lunch: { count: 1, time_range: ['11:00', '13:30'], category: 'restaurant' },
      mandatory_dinner: { count: 1, time_range: ['18:00', '20:30'], category: 'restaurant' },
      total_items: '3-5',
      all_places_in: sanitize(input.destination, 50),
      routing: 'geographic proximity, minimize backtracking',
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

  return `Generate Day ${dayNumber}/${totalDays} itinerary. MUST include 1 lunch + 1 dinner restaurant.
Korean notes. "한국어 (현지어)" names. Check closedDays before including.

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

  const itemCounts: Record<string, { morning: string; afternoon: string }> = {
    relaxed: { morning: '2', afternoon: '2' },
    moderate: { morning: '2-3', afternoon: '2-3' },
    active: { morning: '3', afternoon: '3-4' },
  };
  const counts = itemCounts[profile.travelPace] || itemCounts.moderate;

  const chunkConfig = chunk === 'morning'
    ? {
        label: 'morning~lunch',
        items: counts.morning,
        mandatory_meal: { type: 'lunch', time_range: ['11:00', '13:30'], category: 'restaurant' },
        time_hint: 'End chunk before 14:00',
        morning_type: ls?.morningType === 'late' ? 'Start after 11am, brunch' : ls?.morningType === 'early' ? 'Start 6-7am, sunrise activities' : 'Start 9-10am',
      }
    : {
        label: 'afternoon~evening',
        items: counts.afternoon,
        mandatory_meal: { type: 'dinner', time_range: ['18:00', '20:30'], category: 'restaurant' },
        time_hint: 'Fill until ~21:00',
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

  // 출력 형식
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

  const mealReminder = chunk === 'afternoon'
    ? 'MUST include 1 dinner restaurant (18:00-20:30).'
    : 'MUST include 1 lunch restaurant (11:00-13:30).';

  return `${(prompt.request as string)}. ${mealReminder}
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
