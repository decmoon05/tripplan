/**
 * AI 생성 품질 테스트 — Layer 1 규칙 기반 검증 (20개 체크)
 * 비용 0, 즉시 실행. LLM 심층 평가(Layer 2)는 Claude Code가 직접 수행.
 */
import { haversineKm, toMinutes } from './itineraryValidation';

export interface ValidationCheck {
  id: string;
  name: string;
  category: 'transit' | 'time' | 'meal' | 'geo' | 'companion' | 'quality';
  pass: boolean;
  details: string;
}

export interface ValidationConfig {
  expectedTransitMode: string | null;   // "drive", "bus", etc.
  geoBoundaryKm: number;               // default 30
  specialNoteKeywords: string[];        // 결과에 반영됐는지 확인
  forbiddenCategories: string[];        // family-kids→nightlife 등
  expectedDayCount: number;
}

export interface TestItem {
  dayNumber: number;
  orderIndex: number;
  placeNameSnapshot: string;
  category: string;
  startTime: string;
  endTime: string;
  estimatedCost: number;
  currency: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  transitMode: string | null;
  transitDurationMin: number | null;
  transitSummary: string | null;
  closedDays: string | null;
  reasonTags: string[];
  activityLevel: string;
  foodPreference?: string[];
}

interface ScenarioProfile {
  specialNote: string;
  budgetRange: string;
  companion: string;
  arrivalTime: string;
  foodPreference: string[];
  travelPace: string;
  lifestyle: { stamina: string };
}

// ─── 교통/이동 (5개) ─────────────────────────────────

function checkTransitModeMatch(items: TestItem[], profile: ScenarioProfile, config: ValidationConfig): ValidationCheck {
  if (!config.expectedTransitMode) {
    // specialNote에서 자동 감지
    const note = profile.specialNote.toLowerCase();
    const isRentalCar = /렌터카|렌트카|rental\s*car/.test(note);
    const isWalking = /도보|걸어서|walking/.test(note);
    const isBus = /버스로만|bus only/.test(note);

    if (!isRentalCar && !isWalking && !isBus) {
      return { id: 'transit_mode_match', name: '교통수단 일관성', category: 'transit', pass: true, details: '특정 교통수단 요구 없음' };
    }
    config = { ...config, expectedTransitMode: isRentalCar ? 'drive' : isWalking ? 'walk' : 'bus' };
  }

  const expected = config.expectedTransitMode!;
  const transitItems = items.filter(it => it.transitMode != null && it.orderIndex > 0);
  const violations = transitItems.filter(it => {
    if (expected === 'drive') return it.transitMode !== 'drive' && it.transitMode !== 'walk';
    if (expected === 'walk') return it.transitMode !== 'walk';
    if (expected === 'bus') return it.transitMode !== 'bus' && it.transitMode !== 'walk';
    return false;
  });

  return {
    id: 'transit_mode_match',
    name: '교통수단 일관성',
    category: 'transit',
    pass: violations.length === 0,
    details: violations.length > 0
      ? `${expected} 기대, 위반 ${violations.length}건: ${violations.slice(0, 3).map(v => `Day${v.dayNumber} "${v.placeNameSnapshot}" (${v.transitMode})`).join(', ')}`
      : `모든 이동이 ${expected} 기반`,
  };
}

function checkTransitDurationRealistic(items: TestItem[]): ValidationCheck {
  const speeds: Record<string, number> = { walk: 0.083, bus: 0.5, subway: 0.667, train: 1.5, taxi: 0.5, drive: 0.833, bicycle: 0.25, ferry: 0.5 };
  const violations: string[] = [];

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    if (prev.dayNumber !== curr.dayNumber) continue;
    if (!prev.latitude || !prev.longitude || !curr.latitude || !curr.longitude) continue;
    if (!curr.transitMode || !curr.transitDurationMin) continue;

    const dist = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const speed = speeds[curr.transitMode] || 0.5;
    const minMinutes = Math.ceil(dist / speed);

    if (curr.transitDurationMin < minMinutes * 0.3) {
      violations.push(`Day${curr.dayNumber}: ${prev.placeNameSnapshot}→${curr.placeNameSnapshot} ${dist.toFixed(1)}km, ${curr.transitMode} ${curr.transitDurationMin}분 (최소 ${minMinutes}분 필요)`);
    }
  }

  return {
    id: 'transit_duration_realistic',
    name: '이동시간 현실성',
    category: 'transit',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : '모든 이동시간 현실적',
  };
}

function checkIntercityTravel(items: TestItem[]): ValidationCheck {
  const violations: string[] = [];

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    if (prev.dayNumber !== curr.dayNumber) continue;
    if (!prev.latitude || !prev.longitude || !curr.latitude || !curr.longitude) continue;

    const dist = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (dist > 20 && curr.transitDurationMin != null && curr.transitDurationMin < 30) {
      violations.push(`Day${curr.dayNumber}: ${prev.placeNameSnapshot}→${curr.placeNameSnapshot} ${dist.toFixed(0)}km인데 ${curr.transitDurationMin}분`);
    }
  }

  return {
    id: 'intercity_travel_detected',
    name: '도시간 이동시간',
    category: 'transit',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : '도시간 이동시간 적절',
  };
}

function checkFirstItemNoTransit(items: TestItem[]): ValidationCheck {
  const violations: string[] = [];
  const days = new Set(items.map(it => it.dayNumber));

  for (const day of days) {
    const firstItem = items.find(it => it.dayNumber === day && it.orderIndex === 0);
    if (firstItem && firstItem.transitMode != null) {
      violations.push(`Day${day}: 첫 아이템 "${firstItem.placeNameSnapshot}" transitMode=${firstItem.transitMode}`);
    }
  }

  return {
    id: 'first_item_no_transit',
    name: '첫 아이템 transit=null',
    category: 'transit',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.join(', ') : '모든 Day 첫 아이템 transit 없음',
  };
}

function checkTransitModeVariety(items: TestItem[], config: ValidationConfig): ValidationCheck {
  // 렌터카/도보 전용이면 variety 체크 스킵 (drive 100%, walk 100%가 정상)
  if (config.expectedTransitMode) {
    return { id: 'transit_mode_variety', name: '교통수단 다양성', category: 'transit', pass: true, details: `전용 교통수단(${config.expectedTransitMode}) — 스킵` };
  }

  const modes = items.filter(it => it.transitMode).map(it => it.transitMode!);
  if (modes.length < 3) return { id: 'transit_mode_variety', name: '교통수단 다양성', category: 'transit', pass: true, details: '아이템 부족으로 스킵' };

  const unique = new Set(modes);
  const dominantCount = Math.max(...[...unique].map(m => modes.filter(x => x === m).length));
  const dominantRatio = dominantCount / modes.length;

  // walk 100% 또는 drive 100%도 상황에 따라 정상
  const dominant = [...unique].find(m => modes.filter(x => x === m).length === dominantCount);
  if (dominant === 'walk' && dominantRatio > 0.9) {
    return { id: 'transit_mode_variety', name: '교통수단 다양성', category: 'transit', pass: true, details: `도보 위주 여행 — 정상 (walk ${(dominantRatio * 100).toFixed(0)}%)` };
  }
  // drive 100%: 대중교통 부실 지역(오키나와, 제주, 규슈 외곽 등)이나 렌터카 여행이면 정상
  if (dominant === 'drive' && dominantRatio > 0.8) {
    return { id: 'transit_mode_variety', name: '교통수단 다양성', category: 'transit', pass: true, details: `차량 이동 위주 — 정상 (drive ${(dominantRatio * 100).toFixed(0)}%)` };
  }
  // subway 100%: 대도시(도쿄, 오사카, 서울, 파리, 런던 등)에서 정상
  if (dominant === 'subway' && dominantRatio > 0.8) {
    return { id: 'transit_mode_variety', name: '교통수단 다양성', category: 'transit', pass: true, details: `지하철 위주 — 정상 (subway ${(dominantRatio * 100).toFixed(0)}%)` };
  }

  return {
    id: 'transit_mode_variety',
    name: '교통수단 다양성',
    category: 'transit',
    pass: unique.size > 1 || dominantRatio < 0.9,
    details: `교통수단: ${[...unique].join(', ')} (${unique.size}종류, 최다 ${(dominantRatio * 100).toFixed(0)}%)`,
  };
}

// ─── 시간/일정 (5개) ─────────────────────────────────

function checkNoTimeOverlap(items: TestItem[]): ValidationCheck {
  const violations: string[] = [];
  const days = new Set(items.map(it => it.dayNumber));

  for (const day of days) {
    const dayItems = items.filter(it => it.dayNumber === day).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 1; i < dayItems.length; i++) {
      const prevEnd = toMinutes(dayItems[i - 1].endTime);
      const currStart = toMinutes(dayItems[i].startTime);
      if (currStart < prevEnd - 5) { // 5분 여유
        violations.push(`Day${day}: "${dayItems[i - 1].placeNameSnapshot}" ~${dayItems[i - 1].endTime} ↔ "${dayItems[i].placeNameSnapshot}" ${dayItems[i].startTime}~`);
      }
    }
  }

  return {
    id: 'no_time_overlap',
    name: '시간 중복 없음',
    category: 'time',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : '시간 중복 없음',
  };
}

function checkReasonableHours(items: TestItem[]): ValidationCheck {
  const violations: string[] = [];

  for (const item of items) {
    const start = toMinutes(item.startTime);
    const end = toMinutes(item.endTime);
    if (start < toMinutes('05:00') || start > toMinutes('23:30')) {
      violations.push(`Day${item.dayNumber}: "${item.placeNameSnapshot}" 시작 ${item.startTime}`);
    }
    if (end > toMinutes('02:00') && end < toMinutes('05:00')) {
      violations.push(`Day${item.dayNumber}: "${item.placeNameSnapshot}" 종료 ${item.endTime}`);
    }
  }

  return {
    id: 'reasonable_hours',
    name: '활동 시간 합리성',
    category: 'time',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : '모든 활동 합리적 시간대',
  };
}

function checkDayStartMatchesArrival(items: TestItem[], profile: ScenarioProfile): ValidationCheck {
  const day1Items = items.filter(it => it.dayNumber === 1).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  if (day1Items.length === 0) return { id: 'day_start_matches_arrival', name: 'Day1 시작≈도착시간', category: 'time', pass: true, details: 'Day1 없음' };

  const firstStart = toMinutes(day1Items[0].startTime);
  const arrivalMap: Record<string, [number, number]> = {
    morning: [toMinutes('08:00'), toMinutes('12:00')],
    afternoon: [toMinutes('12:00'), toMinutes('18:00')],
    evening: [toMinutes('17:00'), toMinutes('22:00')],
    undecided: [toMinutes('06:00'), toMinutes('23:00')],
  };

  const [min, max] = arrivalMap[profile.arrivalTime] || arrivalMap.undecided;

  return {
    id: 'day_start_matches_arrival',
    name: 'Day1 시작≈도착시간',
    category: 'time',
    pass: firstStart >= min - 60 && firstStart <= max + 60,
    details: `Day1 첫 활동 ${day1Items[0].startTime}, 도착 ${profile.arrivalTime} (${Math.floor(min / 60)}:00~${Math.floor(max / 60)}:00 기대)`,
  };
}

function checkSufficientDuration(items: TestItem[]): ValidationCheck {
  const violations: string[] = [];

  for (const item of items) {
    let duration = toMinutes(item.endTime) - toMinutes(item.startTime);
    // overnight (호텔 체크인 19:00 → 체크아웃 07:00) → 양수로 보정
    if (duration < 0) duration += 1440;
    // 호텔/transport는 duration 체크 스킵
    if (item.category === 'hotel' || item.category === 'transport') continue;
    const minDuration = item.category === 'attraction' ? 20 : 15; // 하루 끝 시간 클램프로 잘릴 수 있음

    if (duration < minDuration) {
      violations.push(`Day${item.dayNumber}: "${item.placeNameSnapshot}" ${duration}분 (최소 ${minDuration}분)`);
    }
  }

  return {
    id: 'sufficient_duration',
    name: '활동 최소 시간',
    category: 'time',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : '모든 활동 충분한 시간',
  };
}

function checkItemCountMatchesPace(items: TestItem[], profile: ScenarioProfile): ValidationCheck {
  // augment로 추가된 식사 아이템은 카운트에서 제외 (AI가 생성한 것만 평가)
  const nonAugmented = items.filter(it => !it.placeNameSnapshot?.startsWith?.('현지 점심 식당') && !it.placeNameSnapshot?.startsWith?.('현지 저녁 식당'));
  const days = new Set(nonAugmented.map(it => it.dayNumber));
  const avgPerDay = nonAugmented.length / Math.max(days.size, 1);

  const paceExpect: Record<string, [number, number]> = {
    relaxed: [2, 5],
    moderate: [4, 8],
    active: [5, 12],
  };
  const [min, max] = paceExpect[profile.travelPace] || [3, 10];

  // 체력 보정
  const staminaFactor = profile.lifestyle.stamina === 'low' ? 0.7 : profile.lifestyle.stamina === 'high' ? 1.3 : 1;
  const adjustedMax = max * staminaFactor;

  return {
    id: 'item_count_matches_pace',
    name: '활동량≈페이스',
    category: 'time',
    pass: avgPerDay >= min * 0.7 && avgPerDay <= adjustedMax * 1.5,
    details: `하루 평균 ${avgPerDay.toFixed(1)}개 (${profile.travelPace}/${profile.lifestyle.stamina} 기대: ${min}~${Math.round(adjustedMax)}개)`,
  };
}

// ─── 식사/예산 (4개) ─────────────────────────────────

function checkLunchEveryDay(items: TestItem[], config: ValidationConfig): ValidationCheck {
  // 시간 범위 고정 X → restaurant/cafe 존재 여부만 체크
  // 사용자가 11시에 먹든 14시에 먹든 "식사가 있으면" PASS
  const missing: number[] = [];
  for (let day = 1; day <= config.expectedDayCount; day++) {
    const dayRestaurants = items.filter(it =>
      it.dayNumber === day && (it.category === 'restaurant' || it.category === 'cafe'),
    );
    // 최소 2끼(점심+저녁)가 있어야 하므로 전체 식사 수로 판단
    // Day 1 evening 도착 or 마지막 날은 1끼도 허용
    const isFirstDayEvening = day === 1 && config.specialNoteKeywords?.includes('evening');
    const isLastDay = day === config.expectedDayCount;
    const minMeals = (isFirstDayEvening || isLastDay) ? 1 : 2;
    if (dayRestaurants.length < minMeals) missing.push(day);
  }

  return {
    id: 'lunch_every_day',
    name: '매일 식사',
    category: 'meal',
    pass: missing.length === 0,
    details: missing.length > 0 ? `식사 부족 날: Day ${missing.join(', ')}` : '모든 날 식사 충분',
  };
}

function checkDinnerEveryDay(items: TestItem[], config: ValidationConfig): ValidationCheck {
  // lunch_every_day에서 이미 식사 수를 체크하므로
  // dinner_every_day는 "저녁 시간대(17:00+)에 식사가 있는지"만 확인
  // 단, 시간 범위를 넓게 잡아서 22시, 23시 저녁도 허용
  const missing: number[] = [];
  for (let day = 1; day <= config.expectedDayCount; day++) {
    const isLastDay = day === config.expectedDayCount;
    if (isLastDay) continue; // 마지막 날은 저녁 체크 스킵 (출발할 수 있음)

    const dayRestaurants = items.filter(it =>
      it.dayNumber === day && (it.category === 'restaurant' || it.category === 'cafe'),
    );
    // 식사가 2개 이상이면 그 중 하나는 저녁 역할 → PASS
    // 식사가 1개만 있으면 점심만 있고 저녁 없을 수 있음
    if (dayRestaurants.length < 2) {
      // 1개만 있는데 17:00 이후면 저녁으로 인정
      const hasLateRestaurant = dayRestaurants.some(m => toMinutes(m.startTime) >= toMinutes('15:00'));
      if (!hasLateRestaurant) missing.push(day);
    }
  }

  return {
    id: 'dinner_every_day',
    name: '매일 저녁',
    category: 'meal',
    pass: missing.length === 0,
    details: missing.length > 0 ? `저녁 없는 날: Day ${missing.join(', ')}` : '모든 날 저녁 있음',
  };
}

function checkBudgetAlignment(items: TestItem[], profile: ScenarioProfile): ValidationCheck {
  const costs = items.filter(it => it.estimatedCost > 0);
  if (costs.length === 0) return { id: 'budget_alignment', name: '예산 범위', category: 'meal', pass: true, details: '비용 데이터 없음' };

  const avgCost = costs.reduce((sum, it) => sum + it.estimatedCost, 0) / costs.length;
  const currency = costs[0]?.currency || 'KRW';

  // 통화별 예산 기준 (활동 1건당)
  const budgetThresholds: Record<string, Record<string, [number, number]>> = {
    KRW: { backpacking: [0, 15000], budget: [5000, 30000], moderate: [10000, 60000], comfort: [20000, 100000], luxury: [50000, 500000] },
    JPY: { backpacking: [0, 2000], budget: [500, 4000], moderate: [1000, 8000], comfort: [3000, 15000], luxury: [5000, 50000] },
    USD: { backpacking: [0, 15], budget: [5, 30], moderate: [10, 60], comfort: [20, 150], luxury: [50, 500] },
    EUR: { backpacking: [0, 15], budget: [5, 30], moderate: [10, 60], comfort: [20, 150], luxury: [50, 500] },
    THB: { backpacking: [0, 500], budget: [100, 1000], moderate: [300, 3000], comfort: [500, 5000], luxury: [2000, 20000] },
  };

  const thresholds = budgetThresholds[currency]?.[profile.budgetRange] || [0, 999999];

  return {
    id: 'budget_alignment',
    name: '예산 범위',
    category: 'meal',
    pass: avgCost >= thresholds[0] * 0.5 && avgCost <= thresholds[1] * 2,
    details: `평균 비용 ${Math.round(avgCost)} ${currency}/건 (${profile.budgetRange} 기대: ${thresholds[0]}~${thresholds[1]})`,
  };
}

function checkCurrencyConsistent(items: TestItem[]): ValidationCheck {
  const currencies = new Set(items.filter(it => it.currency).map(it => it.currency));

  return {
    id: 'currency_consistent',
    name: '통화 일관성',
    category: 'meal',
    pass: currencies.size <= 1,
    details: currencies.size > 1 ? `통화 혼재: ${[...currencies].join(', ')}` : `통화: ${[...currencies][0] || 'N/A'}`,
  };
}

// ─── 지리/장소 (4개) ─────────────────────────────────

function checkGeoBoundary(items: TestItem[], config: ValidationConfig): ValidationCheck {
  // 교통 허브(역, 공항), augmented 식당, transport 카테고리는 교외에 있을 수 있으므로 제외
  const isExcluded = (it: TestItem) =>
    it.category === 'transport' || it.category === 'hotel' ||
    /역|공항|터미널|station|airport|terminal|현지.*식당|Local.*Restaurant|Local.*Dinner/i.test(it.placeNameSnapshot);

  const withCoords = items.filter(it => it.latitude != null && it.longitude != null && !isExcluded(it));
  if (withCoords.length < 2) return { id: 'geo_boundary', name: '지리 경계', category: 'geo', pass: true, details: '좌표 부족 (교통/호텔 제외)' };

  // 이상 좌표 필터링: 위도 ±90, 경도 ±180 벗어나거나 (0,0)인 경우
  const validCoords = withCoords.filter(it =>
    Math.abs(it.latitude!) <= 90 && Math.abs(it.longitude!) <= 180 &&
    !(it.latitude === 0 && it.longitude === 0)
  );
  if (validCoords.length < 2) return { id: 'geo_boundary', name: '지리 경계', category: 'geo', pass: true, details: '유효 좌표 부족' };

  const lats = validCoords.map(it => it.latitude!).sort((a, b) => a - b);
  const lngs = validCoords.map(it => it.longitude!).sort((a, b) => a - b);
  const mid = Math.floor(lats.length / 2);
  const medLat = lats.length % 2 ? lats[mid] : (lats[mid - 1] + lats[mid]) / 2;
  const medLng = lngs.length % 2 ? lngs[mid] : (lngs[mid - 1] + lngs[mid]) / 2;

  // 기본 반경에 1.5배 여유 (관광지는 시 외곽에 있는 경우가 많음)
  const threshold = config.geoBoundaryKm * 1.5;
  const violations = validCoords.filter(it => haversineKm(medLat, medLng, it.latitude!, it.longitude!) > threshold);

  return {
    id: 'geo_boundary',
    name: '지리 경계',
    category: 'geo',
    pass: violations.length === 0,
    details: violations.length > 0
      ? `${threshold}km 초과 ${violations.length}건: ${violations.slice(0, 2).map(v => `"${v.placeNameSnapshot}" ${haversineKm(medLat, medLng, v.latitude!, v.longitude!).toFixed(0)}km`).join(', ')}`
      : `모든 장소 ${threshold}km 이내`,
  };
}

function checkNoDuplicatePlaces(items: TestItem[]): ValidationCheck {
  // 교통 허브(역, 공항, 렌터카)와 호텔은 중복 체크에서 제외
  const skipItems = items.filter(it =>
    it.category === 'transport' || it.category === 'hotel' ||
    /역|공항|렌터카|터미널|호텔|station|airport|hotel|체크인|체크아웃/i.test(it.placeNameSnapshot)
  );
  const nonTransport = items.filter(it => !skipItems.includes(it));

  const names = nonTransport.map(it => it.placeNameSnapshot.replace(/\s*\(.*\)/, '').trim().toLowerCase());
  const seen = new Map<string, number>();
  const duplicates: string[] = [];

  for (const name of names) {
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    if (count === 2) duplicates.push(name);
  }

  return {
    id: 'no_duplicate_places',
    name: '장소 중복 없음',
    category: 'geo',
    pass: duplicates.length === 0,
    details: duplicates.length > 0 ? `중복: ${duplicates.slice(0, 3).join(', ')}` : '중복 없음',
  };
}

function checkCoordinatesValid(items: TestItem[]): ValidationCheck {
  // 호텔, 교통(공항/기차역/렌터카), augmented 아이템은 좌표 없을 수 있음 → 제외
  const checkable = items.filter(it =>
    it.category !== 'hotel' && it.category !== 'transport' &&
    !it.placeNameSnapshot.includes('호텔') && !it.placeNameSnapshot.includes('공항') &&
    !it.placeNameSnapshot.includes('기차') && !it.placeNameSnapshot.includes('렌터카') &&
    !it.placeNameSnapshot.includes('항공편') && !it.placeNameSnapshot.includes('출발') &&
    !it.placeNameSnapshot.includes('체크인') && !it.placeNameSnapshot.includes('이동') &&
    !it.placeNameSnapshot.startsWith('현지 점심 식당') && !it.placeNameSnapshot.startsWith('현지 저녁 식당')
  );
  const invalid = checkable.filter(it => it.latitude == null || it.longitude == null || it.latitude < -90 || it.latitude > 90 || it.longitude < -180 || it.longitude > 180);

  return {
    id: 'coordinates_valid',
    name: '좌표 유효성',
    category: 'geo',
    pass: invalid.length <= 3, // 3건 이하 허용 (일반 지역명은 Nominatim이 못 찾을 수 있음)
    details: invalid.length > 0 ? `좌표 무효 ${invalid.length}건: ${invalid.slice(0, 2).map(v => `"${v.placeNameSnapshot}"`).join(', ')}` : '모든 좌표 유효',
  };
}

function checkClosedDayConflict(items: TestItem[], startDate: string): ValidationCheck {
  const violations: string[] = [];
  const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (const item of items) {
    if (!item.closedDays) continue;
    const date = new Date(startDate);
    date.setDate(date.getDate() + item.dayNumber - 1);
    const dow = dayOfWeekNames[date.getDay()];

    // "연중무휴", "비정기휴무", "시설 휴관일에 따름" 등은 스킵
    if (/연중무휴|비정기|부정기|시설.*따름|없음/.test(item.closedDays)) continue;

    // "월요일", "화·수요일" 등에서 요일 매칭 (부분 문자열 오탐 방지: "일"이 "화요일"에 매칭되지 않도록)
    const dowFull = dow + '요일'; // "월요일", "화요일", etc.
    if (item.closedDays.includes(dowFull)) {
      violations.push(`Day${item.dayNumber}(${dow}): "${item.placeNameSnapshot}" 휴무 "${item.closedDays}"`);
    }
  }

  return {
    id: 'closed_day_conflict',
    name: '휴무일 충돌',
    category: 'geo',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : '휴무일 충돌 없음',
  };
}

// ─── 동행/특수 (2개) ─────────────────────────────────

function checkCompanionAppropriate(items: TestItem[], profile: ScenarioProfile, config: ValidationConfig): ValidationCheck {
  const violations: string[] = [];
  const forbidden = config.forbiddenCategories;

  // 추가 자동 감지
  if (profile.companion === 'family-kids') {
    forbidden.push('nightlife', 'bar', 'club', 'pub', '이자카야');
  }
  if (profile.companion === 'business') {
    forbidden.push('theme-park', 'amusement', '놀이공원', '워터파크');
  }

  for (const item of items) {
    const nameAndNotes = `${item.placeNameSnapshot} ${item.notes} ${item.category} ${(item.reasonTags || []).join(' ')}`.toLowerCase();
    for (const kw of forbidden) {
      if (nameAndNotes.includes(kw.toLowerCase())) {
        violations.push(`Day${item.dayNumber}: "${item.placeNameSnapshot}" contains "${kw}"`);
      }
    }
  }

  return {
    id: 'companion_appropriate',
    name: '동행 적합성',
    category: 'companion',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.slice(0, 3).join(' | ') : `${profile.companion} 적합`,
  };
}

function checkFoodRestrictionRespected(items: TestItem[], profile: ScenarioProfile): ValidationCheck {
  const restrictions = profile.foodPreference;
  if (!restrictions || restrictions.length === 0) {
    return { id: 'food_restriction_respected', name: '식단 제한 준수', category: 'companion', pass: true, details: '식단 제한 없음' };
  }

  // 레스토랑/카페만 검사
  const meals = items.filter(it => it.category === 'restaurant' || it.category === 'cafe');
  const warnings: string[] = [];

  for (const meal of meals) {
    const text = `${meal.placeNameSnapshot} ${meal.notes} ${(meal.reasonTags || []).join(' ')}`.toLowerCase();
    if (restrictions.includes('halal') && !text.includes('할랄') && !text.includes('halal') && !text.includes('무슬림')) {
      warnings.push(`Day${meal.dayNumber}: "${meal.placeNameSnapshot}" 할랄 미확인`);
    }
    if (restrictions.includes('vegetarian') && (text.includes('고기') || text.includes('meat') || text.includes('야키니쿠'))) {
      warnings.push(`Day${meal.dayNumber}: "${meal.placeNameSnapshot}" 채식 위반 가능`);
    }
  }

  return {
    id: 'food_restriction_respected',
    name: '식단 제한 준수',
    category: 'companion',
    pass: warnings.length === 0,
    details: warnings.length > 0 ? warnings.slice(0, 3).join(' | ') : `식단 제한 준수 (${restrictions.join(', ')})`,
  };
}

// ─── 메인 함수 ──────────────────────────────────────

export function runAllValidations(
  items: TestItem[],
  profile: ScenarioProfile,
  config: ValidationConfig,
  startDate: string,
): ValidationCheck[] {
  return [
    // 교통/이동
    checkTransitModeMatch(items, profile, config),
    checkTransitDurationRealistic(items),
    checkIntercityTravel(items),
    checkFirstItemNoTransit(items),
    checkTransitModeVariety(items, config),
    // 시간/일정
    checkNoTimeOverlap(items),
    checkReasonableHours(items),
    checkDayStartMatchesArrival(items, profile),
    checkSufficientDuration(items),
    checkItemCountMatchesPace(items, profile),
    // 식사/예산
    checkLunchEveryDay(items, config),
    checkDinnerEveryDay(items, config),
    checkBudgetAlignment(items, profile),
    checkCurrencyConsistent(items),
    // 지리/장소
    checkGeoBoundary(items, config),
    checkNoDuplicatePlaces(items),
    checkCoordinatesValid(items),
    checkClosedDayConflict(items, startDate),
    // 동행/특수
    checkCompanionAppropriate(items, profile, config),
    checkFoodRestrictionRespected(items, profile),
    // 품질 (v3.1 추가)
    checkContentDiversity(items),
    checkDailyTravelTime(items),
  ];
}

// ---------------------------------------------------------------------------
// 품질 검증 (v3.1 추가)
// ---------------------------------------------------------------------------

/** 콘텐츠 다양성 — 같은 세부 카테고리 3연속 금지 */
function checkContentDiversity(items: TestItem[]): ValidationCheck {
  const maxDay = Math.max(...items.map(it => it.dayNumber));
  const violations: string[] = [];

  for (let day = 1; day <= maxDay; day++) {
    const dayItems = items.filter(it => it.dayNumber === day).sort((a, b) => a.orderIndex - b.orderIndex);
    for (let i = 2; i < dayItems.length; i++) {
      const a = dayItems[i - 2].category;
      const b = dayItems[i - 1].category;
      const c = dayItems[i].category;
      // 식사(restaurant/cafe)는 제외 — 식당 연속은 정상 (점심→카페→저녁)
      if (a === b && b === c && a !== 'restaurant' && a !== 'cafe') {
        violations.push(`Day${day}: ${a} 3연속`);
      }
    }
  }

  return {
    id: 'content_diversity',
    name: '콘텐츠 다양성',
    category: 'quality',
    pass: violations.length === 0,
    details: violations.length > 0 ? violations.join(' | ') : '카테고리 다양성 OK',
  };
}

/** 하루 총 이동시간 — 렌터카면 5시간, 아니면 3시간 초과 경고 */
function checkDailyTravelTime(items: TestItem[]): ValidationCheck {
  const maxDay = Math.max(...items.map(it => it.dayNumber));
  const violations: string[] = [];
  // 렌터카 감지: transitMode에 'drive'가 50%+ 이면 렌터카
  const driveCount = items.filter(it => it.transitMode === 'drive').length;
  const transitCount = items.filter(it => it.transitMode).length;
  const isRentalCar = transitCount > 0 && driveCount / transitCount > 0.5;
  const limit = isRentalCar ? 300 : 180; // 렌터카 5시간, 일반 3시간

  for (let day = 1; day <= maxDay; day++) {
    const dayItems = items.filter(it => it.dayNumber === day);
    const totalTransit = dayItems.reduce((sum, it) => sum + (it.transitDurationMin || 0), 0);
    if (totalTransit > limit) {
      violations.push(`Day${day}: 이동 ${totalTransit}분`);
    }
  }

  return {
    id: 'daily_travel_time',
    name: '하루 이동시간',
    category: 'quality',
    pass: violations.length === 0,
    details: violations.length > 0 ? `이동 과다: ${violations.join(', ')}` : '모든 날 이동시간 적절',
  };
}
