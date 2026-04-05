import type { TripItem } from '@/types/database';
import type { AIGeneratedItem } from './types';

/** "HH:MM" → 분 변환 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 분 → "HH:MM" 안전 변환 (0~23:59 범위 강제) */
export function toHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(Math.round(minutes), 1439));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Haversine 공식으로 두 좌표 간 직선 거리(km) 계산 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 시간 중복 제거 — dayNumber별로 B.startTime < A.endTime이면 B 제거.
 * 이미 startTime 정렬된 배열을 받아야 함.
 */
export function resolveTimeOverlaps(items: AIGeneratedItem[]): AIGeneratedItem[] {
  const byDay = new Map<number, AIGeneratedItem[]>();
  for (const item of items) {
    const arr = byDay.get(item.dayNumber) || [];
    arr.push(item);
    byDay.set(item.dayNumber, arr);
  }

  const result: AIGeneratedItem[] = [];

  for (const [, dayItems] of byDay) {
    const kept: AIGeneratedItem[] = [];
    for (const item of dayItems) {
      if (kept.length === 0) {
        kept.push(item);
        continue;
      }
      const prev = kept[kept.length - 1];
      if (toMinutes(item.startTime) < toMinutes(prev.endTime)) {
        // 시간 중복 — 후순위(오후 청크) 아이템 제거
        continue;
      }
      kept.push(item);
    }

    // orderIndex 재할당 + 첫 아이템 transit null 처리
    for (let i = 0; i < kept.length; i++) {
      kept[i].orderIndex = i;
      if (i === 0) {
        kept[i].transitMode = null;
        kept[i].transitDurationMin = null;
        kept[i].transitSummary = null;
      }
    }

    result.push(...kept);
  }

  return result;
}

/**
 * 지리 경계 검증 — 중앙값 좌표 기준 maxRadiusKm 초과 시 unverified 플래그.
 * postValidate 이후(Google 좌표 채워진 상태)에서 실행.
 */
export function validateGeoBoundary(items: TripItem[], maxRadiusKm = 30): TripItem[] {
  const withCoords = items.filter((it) => it.latitude != null && it.longitude != null);
  if (withCoords.length < 2) return items;

  // 중앙값(median) 좌표 계산 — 이상치에 강건
  const lats = withCoords.map((it) => it.latitude!).sort((a, b) => a - b);
  const lngs = withCoords.map((it) => it.longitude!).sort((a, b) => a - b);
  const mid = Math.floor(lats.length / 2);
  const medianLat = lats.length % 2 ? lats[mid] : (lats[mid - 1] + lats[mid]) / 2;
  const medianLng = lngs.length % 2 ? lngs[mid] : (lngs[mid - 1] + lngs[mid]) / 2;

  return items.map((item) => {
    if (item.latitude == null || item.longitude == null) return item;
    const dist = haversineKm(medianLat, medianLng, item.latitude, item.longitude);
    if (dist > maxRadiusKm) {
      return { ...item, verified: false, googlePlaceId: null };
    }
    return item;
  });
}

/**
 * 식사 커버리지 검증 + 보강 — 점심/저녁 누락 시 디폴트 식사 아이템 자동 삽입.
 * 반환: 보강된 아이템 배열 (원본 + 추가된 식사)
 */
/**
 * @param arrivalTime - 'morning' | 'afternoon' | 'evening' (Day 1 점심 스킵 판단)
 * @param totalDays - 전체 일수 (마지막 날 저녁 스킵 판단)
 */
export function augmentMissingMeals(
  items: TripItem[],
  arrivalTime?: string,
  totalDays?: number,
): TripItem[] {
  const result = [...items];
  const byDay = new Map<number, TripItem[]>();
  const maxDay = totalDays ?? Math.max(...items.map(i => i.dayNumber), 1);

  for (const item of result) {
    const arr = byDay.get(item.dayNumber) || [];
    arr.push(item);
    byDay.set(item.dayNumber, arr);
  }

  // ── 헬퍼: 전체 아이템에서 최빈 통화 감지 ──
  function detectCurrency(allItems: TripItem[]): string {
    const counts = new Map<string, number>();
    for (const it of allItems) {
      if (it.currency && it.currency !== 'KRW') {
        counts.set(it.currency, (counts.get(it.currency) || 0) + 1);
      }
    }
    if (counts.size === 0) return allItems[0]?.currency || 'KRW';
    let max = 0, best = 'KRW';
    for (const [cur, cnt] of counts) {
      if (cnt > max) { max = cnt; best = cur; }
    }
    return best;
  }

  // ── 헬퍼: 범위 내에서 충돌 없는 1시간 슬롯 찾기 ──
  function findFreeSlot(dayItems: TripItem[], rangeStartMin: number, rangeEndMin: number): { start: number; end: number } | null {
    // 30분 간격으로 시도
    for (let tryStart = rangeStartMin; tryStart <= rangeEndMin - 60; tryStart += 30) {
      const tryEnd = tryStart + 60;
      let conflict = false;
      for (const it of dayItems) {
        const itStart = toMinutes(it.startTime);
        const itEnd = toMinutes(it.endTime);
        if (tryStart < itEnd && tryEnd > itStart) { conflict = true; break; }
      }
      if (!conflict) return { start: tryStart, end: tryEnd };
    }
    return null; // 빈 슬롯 없음
  }

  // ── 헬퍼: 같은 날에서 유효 좌표 찾기 ──
  function findValidCoords(dayItems: TripItem[]): { lat: number | null; lng: number | null } {
    for (const it of dayItems) {
      if (it.latitude != null && it.longitude != null) {
        return { lat: it.latitude, lng: it.longitude };
      }
    }
    return { lat: null, lng: null };
  }

  const currency = detectCurrency(result);

  for (const [day, dayItems] of byDay) {
    // augment된 아이템도 포함하여 충돌 체크 — mutable 배열로 추가 시 반영
    const augmentedForDay = result.filter(r => r.dayNumber === day && (r.id || '').startsWith('augmented-'));
    const allDayItems: TripItem[] = [...dayItems, ...augmentedForDay];

    const meals = allDayItems.filter(
      (it) => it.category === 'restaurant' || it.category === 'cafe',
    );

    const hasLunch = meals.some((m) => {
      const start = toMinutes(m.startTime);
      return start >= toMinutes('11:00') && start <= toMinutes('14:30');
    });

    const hasDinner = meals.some((m) => {
      const start = toMinutes(m.startTime);
      return start >= toMinutes('17:00') && start <= toMinutes('21:30');
    });

    // Day 1 evening 도착이면 점심 스킵
    const skipLunch = day === 1 && arrivalTime === 'evening';
    // 마지막 날도 저녁 삽입 (출발 시간 정보가 없으므로 안전하게 넣기)
    // 오전 출발이면 AI가 저녁을 안 넣었을 것이고, augment도 시간대가 없으면 자연 스킵
    const skipDinner = false;

    if (!hasLunch && !skipLunch) {
      const slot = findFreeSlot(allDayItems, toMinutes('11:00'), toMinutes('14:30'));
      if (!slot) {
        console.warn(`[MealAugment] Day ${day}: 점심 시간대 빈 슬롯 없음 → 삽입 스킵 (종일 활동 가능성)`);
      } else {
        const startTime = toHHMM(slot.start);
        const endTime = toHHMM(slot.end);
        console.warn(`[MealAugment] Day ${day}: 점심 없음 → ${startTime} 삽입`);
        const nearbyItem = dayItems.find(it => Math.abs(toMinutes(it.startTime) - slot.start) < 120 && it.latitude != null);
        let lat = nearbyItem?.latitude ?? null;
        let lng = nearbyItem?.longitude ?? null;
        if (lat == null || lng == null) {
          const fallback = findValidCoords(dayItems);
          lat = fallback.lat;
          lng = fallback.lng;
        }
        result.push({
          id: `augmented-lunch-${day}`,
          tripId: dayItems[0]?.tripId || '',
          dayNumber: day,
          orderIndex: 900,
          placeId: '',
          placeNameSnapshot: `현지 점심 식당 Day${day} (Local Restaurant)`,
          category: 'restaurant',
          startTime,
          endTime,
          estimatedCost: 0,
          currency,
          priceConfidence: 'estimated' as const,
          notes: '점심 식사 — AI가 누락하여 자동 추가됨. 주변 식당을 이용해주세요.',
          latitude: lat,
          longitude: lng,
          reasonTags: ['점심식사'],
          address: null,
          businessHours: null,
          closedDays: null,
          transitMode: 'walk',
          transitDurationMin: null,
          transitSummary: null,
          verified: false,
          googlePlaceId: null,
          subActivities: null,
          createdAt: new Date().toISOString(),
        });
        allDayItems.push(result[result.length - 1]);
      }
    }

    if (!hasDinner && !skipDinner) {
      // 17:00~21:30 범위에서 빈 1시간 슬롯 찾기 (점심 augment 포함)
      const dinnerSlot = findFreeSlot(allDayItems, toMinutes('17:00'), toMinutes('21:30'));
      if (!dinnerSlot) {
        console.warn(`[MealAugment] Day ${day}: 저녁 시간대 빈 슬롯 없음 → 삽입 스킵`);
      }
      if (dinnerSlot) {
        const slot = dinnerSlot;
        const startTime = toHHMM(slot.start);
        const endTime = toHHMM(slot.end);
        console.warn(`[MealAugment] Day ${day}: 저녁 없음 → ${startTime} 삽입`);
        const nearbyItem = dayItems.find(it => Math.abs(toMinutes(it.startTime) - slot.start) < 120 && it.latitude != null);
        let lat = nearbyItem?.latitude ?? null;
        let lng = nearbyItem?.longitude ?? null;
        if (lat == null || lng == null) {
          const fallback = findValidCoords(dayItems);
          lat = fallback.lat;
          lng = fallback.lng;
        }

        result.push({
          id: `augmented-dinner-${day}`,
          tripId: dayItems[0]?.tripId || '',
          dayNumber: day,
          orderIndex: 901,
          placeId: '',
          placeNameSnapshot: `현지 저녁 식당 Day${day} (Local Dinner Restaurant)`,
          category: 'restaurant',
          startTime,
          endTime,
          estimatedCost: 0,
          currency,
          priceConfidence: 'estimated' as const,
          notes: '저녁 식사 — AI가 누락하여 자동 추가됨. 주변 식당을 이용해주세요.',
          latitude: lat,
          longitude: lng,
          reasonTags: ['저녁식사'],
          address: null,
          businessHours: null,
          closedDays: null,
          transitMode: 'walk',
          transitDurationMin: null,
          transitSummary: '도보 5분',
          verified: false,
          googlePlaceId: null,
          subActivities: null,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // orderIndex 재정렬
  const sortedByDay = new Map<number, TripItem[]>();
  for (const item of result) {
    const arr = sortedByDay.get(item.dayNumber) || [];
    arr.push(item);
    sortedByDay.set(item.dayNumber, arr);
  }

  const final: TripItem[] = [];
  for (const [, dayItems] of sortedByDay) {
    dayItems.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 0; i < dayItems.length; i++) {
      dayItems[i].orderIndex = i;
      if (i === 0) {
        dayItems[i].transitMode = null;
        dayItems[i].transitDurationMin = null;
        dayItems[i].transitSummary = null;
      }
    }
    final.push(...dayItems);
  }

  return final;
}

/**
 * 동선 최적화 — Nearest-neighbor 알고리즘으로 같은 날 아이템을 지리적 근접성 기반 재정렬.
 * 식사 슬롯(점심/저녁 시간대 restaurant/cafe)은 원래 위치 고정.
 */
export function optimizeRouteOrder(items: TripItem[]): TripItem[] {
  const byDay = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const arr = byDay.get(items[i].dayNumber) || [];
    arr.push(i);
    byDay.set(items[i].dayNumber, arr);
  }

  const result = [...items];

  for (const [, indices] of byDay) {
    const dayItems = indices.map((i) => result[i]);

    // 좌표가 있는 아이템이 2개 미만이면 스킵
    const withCoords = dayItems.filter((it) => it.latitude != null && it.longitude != null);
    if (withCoords.length < 2) {
      console.warn(`[RouteOptimize] Day ${dayItems[0]?.dayNumber}: 좌표 ${withCoords.length}/${dayItems.length}개 — 스킵`);
      continue;
    }

    // 식사 슬롯 판별: restaurant/cafe이고 점심(11:00-14:00) 또는 저녁(17:30-21:00) 시간대
    const isMealSlot = (it: TripItem): boolean => {
      if (it.category !== 'restaurant' && it.category !== 'cafe') return false;
      const start = toMinutes(it.startTime);
      return (start >= toMinutes('11:00') && start <= toMinutes('14:00')) ||
             (start >= toMinutes('17:30') && start <= toMinutes('21:00'));
    };

    // 식사 슬롯과 최적화 대상 분리
    const mealIndices = new Set<number>();
    const optimizable: number[] = []; // dayItems 내 인덱스
    for (let j = 0; j < dayItems.length; j++) {
      if (isMealSlot(dayItems[j])) {
        mealIndices.add(j);
      } else {
        optimizable.push(j);
      }
    }

    // 최적화할 아이템이 2개 미만이면 스킵
    if (optimizable.length < 2) {
      console.warn(`[RouteOptimize] Day ${dayItems[0]?.dayNumber}: 최적화 대상 ${optimizable.length}개 — 스킵`);
      continue;
    }

    // Nearest-neighbor: 첫 아이템 고정, 이후 가장 가까운 미방문 선택
    const visited = new Set<number>();
    const order: number[] = [optimizable[0]];
    visited.add(optimizable[0]);

    while (order.length < optimizable.length) {
      const last = dayItems[order[order.length - 1]];
      let bestIdx = -1;
      let bestDist = Infinity;

      for (const idx of optimizable) {
        if (visited.has(idx)) continue;
        const candidate = dayItems[idx];
        if (last.latitude == null || last.longitude == null ||
            candidate.latitude == null || candidate.longitude == null) continue;
        const dist = haversineKm(last.latitude, last.longitude, candidate.latitude, candidate.longitude);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }

      if (bestIdx === -1) {
        // 좌표 없는 나머지 추가
        for (const idx of optimizable) {
          if (!visited.has(idx)) order.push(idx);
        }
        break;
      }
      visited.add(bestIdx);
      order.push(bestIdx);
    }

    // 식사를 포함해 최종 순서 결합: 식사는 원래 상대 위치에 삽입
    const finalOrder: number[] = [];
    let optPtr = 0;
    for (let j = 0; j < dayItems.length; j++) {
      if (mealIndices.has(j)) {
        finalOrder.push(j);
      } else if (optPtr < order.length) {
        finalOrder.push(order[optPtr++]);
      }
    }
    // 남은 optimizable 추가
    while (optPtr < order.length) {
      finalOrder.push(order[optPtr++]);
    }

    // 재정렬 적용: orderIndex, startTime/endTime 시프트, transit 재계산
    const reordered = finalOrder.map((j) => dayItems[j]);
    const firstOriginalStart = toMinutes(reordered[0].startTime);
    let currentTime = firstOriginalStart;

    for (let k = 0; k < reordered.length; k++) {
      const item = { ...reordered[k] };
      const duration = toMinutes(item.endTime) - toMinutes(item.startTime);

      if (k === 0) {
        // 첫 아이템: 원본 시간 유지, transit null
        item.orderIndex = 0;
        item.transitMode = null;
        item.transitDurationMin = null;
        item.transitSummary = null;
        currentTime = toMinutes(item.endTime);
      } else {
        const prev = reordered[k - 1];
        // transit 재계산 (haversine 기반)
        if (prev.latitude != null && prev.longitude != null &&
            item.latitude != null && item.longitude != null) {
          const dist = haversineKm(prev.latitude, prev.longitude, item.latitude, item.longitude);

          // 기존 transitMode가 drive면 렌터카 여행 — drive 유지
          const isDriveTrip = item.transitMode === 'drive' || prev.transitMode === 'drive'
            || dayItems.some(d => d.transitMode === 'drive');

          let mode: string;
          let speed: number;
          if (isDriveTrip) {
            mode = dist <= 0.5 ? 'walk' : 'drive';
            speed = mode === 'walk' ? 0.083 : 0.7; // 차량 42km/h (시내+고속 평균)
          } else {
            mode = dist <= 1.5 ? 'walk' : 'subway';
            speed = mode === 'walk' ? 0.083 : 0.5;
          }
          const transitMin = Math.max(Math.ceil(dist / speed), 3);

          item.transitMode = mode;
          item.transitDurationMin = transitMin;
          item.transitSummary = mode === 'walk'
            ? `도보 ${transitMin}분`
            : mode === 'drive'
              ? `차량 약 ${transitMin}분`
              : `지하철 약 ${transitMin}분`;

          // 도시간 이동(180분 초과)은 120분으로 캡 — 비현실적 누적 방지
          const cappedTransit = Math.min(transitMin, 120);
          if (transitMin > 180) {
            console.warn(`[RouteOptimize] 도시간 이동 ${transitMin}분 → ${cappedTransit}분 캡: ${prev.placeNameSnapshot}→${item.placeNameSnapshot}`);
          }
          item.transitDurationMin = cappedTransit;
          currentTime += cappedTransit;
        } else {
          item.transitMode = null;
          item.transitDurationMin = null;
          item.transitSummary = null;
        }

        // startTime/endTime 시프트 (체류 시간 보존, 0~23:59 범위 강제)
        currentTime = Math.max(0, Math.min(currentTime, 23 * 60)); // 0~1380 클램프
        item.startTime = toHHMM(currentTime);
        currentTime += duration;
        currentTime = Math.max(0, Math.min(currentTime, 23 * 60 + 59));
        item.endTime = toHHMM(currentTime);
        item.orderIndex = k;
      }

      reordered[k] = item;
    }

    // 원본 배열에 반영
    for (let k = 0; k < reordered.length; k++) {
      result[indices[k]] = reordered[k];
    }
  }

  return result;
}

/**
 * 이동 타당성 검증 — 이동 모드 대비 비현실적 거리/시간 자동 보정.
 */
export function validateTransitFeasibility(items: TripItem[]): TripItem[] {
  // 이동 모드별 속도 상한 (km/분)
  const speedLimits: Record<string, number> = {
    walk: 0.083,     // 5km/h
    bus: 0.5,        // 30km/h
    subway: 0.667,   // 40km/h (지하철 평균)
    train: 1.5,      // 90km/h (특급/신칸센 제외 일반 열차)
    taxi: 0.5,       // 30km/h (시내)
    drive: 0.833,    // 50km/h (시내+고속 혼합 평균)
    bicycle: 0.25,   // 15km/h
    ferry: 0.5,      // 30km/h
  };

  const byDay = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const arr = byDay.get(items[i].dayNumber) || [];
    arr.push(i);
    byDay.set(items[i].dayNumber, arr);
  }

  const result = [...items];

  for (const [, indices] of byDay) {
    for (let j = 1; j < indices.length; j++) {
      const prevIdx = indices[j - 1];
      const currIdx = indices[j];
      const prev = result[prevIdx];
      const curr = result[currIdx];

      if (prev.latitude == null || prev.longitude == null ||
          curr.latitude == null || curr.longitude == null) continue;

      const dist = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const mode = curr.transitMode || 'walk';
      const speed = speedLimits[mode] || 0.5;

      // 도보 3km 초과 시 교통수단 업그레이드
      const needsUpgrade = mode === 'walk' && dist > 3;
      const estimatedMin = Math.ceil(dist / speed);
      const currentDuration = curr.transitDurationMin || 0;
      const unrealistic = currentDuration > 0 && dist / (currentDuration) > speed * 1.5;

      // 같은 날 다른 아이템이 drive면 렌터카 여행
      const dayItemIndices = byDay.get(curr.dayNumber) || [];
      const isDriveDay = dayItemIndices.some(idx => result[idx].transitMode === 'drive');

      if (needsUpgrade || unrealistic) {
        const newMode = isDriveDay ? 'drive' : (dist > 3 ? 'subway' : mode);
        const newSpeed = speedLimits[newMode] || 0.5;
        const newDuration = Math.max(Math.ceil(dist / newSpeed), 5);

        result[currIdx] = {
          ...curr,
          transitMode: newMode,
          transitDurationMin: newDuration,
          transitSummary: `이동 약 ${newDuration}분 (거리 기반 추정)`,
        };
      }
    }
  }

  return result;
}

/**
 * 휴무일 충돌 검증 + 제거 — closedDays가 스케줄 요일과 충돌하면 아이템 제거.
 * startDate 기준 요일 계산.
 */
export function validateClosedDays(items: TripItem[], startDate: string): TripItem[] {
  const dayOfWeekKorean = ['일', '월', '화', '수', '목', '금', '토'];
  const base = new Date(startDate);

  return items.filter((item) => {
    if (!item.closedDays) return true;
    const date = new Date(base);
    date.setDate(date.getDate() + item.dayNumber - 1);
    const dow = dayOfWeekKorean[date.getDay()];

    const closed = item.closedDays.toLowerCase();
    if (closed.includes(dow + '요일') || closed === dow) {
      // 식사(restaurant/cafe)는 제거하지 않음 — 식사 보장이 휴무일보다 우선
      if (item.category === 'restaurant' || item.category === 'cafe') {
        console.warn(`[ClosedDay] Day${item.dayNumber}(${dow}): "${item.placeNameSnapshot}" 휴무이지만 식사 보장으로 유지`);
        return true;
      }
      console.warn(`[ClosedDay] Day${item.dayNumber}(${dow}): "${item.placeNameSnapshot}" 제거 — 휴무 "${item.closedDays}"`);
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// validateDay — 하루 단위 즉시 검증 (v2 파이프라인)
// ---------------------------------------------------------------------------

export interface DayIssue {
  type: 'missing_lunch' | 'missing_dinner' | 'time_overlap' | 'too_many_items' | 'arrival_mismatch' | 'negative_time';
  detail: string;
  /** time_overlap 시 충돌하는 아이템 인덱스 */
  indices?: [number, number];
}

function isLunchTime(startTime: string): boolean {
  const m = toMinutes(startTime);
  return m >= 660 && m <= 870; // 11:00~14:30
}

function isDinnerTime(startTime: string): boolean {
  const m = toMinutes(startTime);
  return m >= 1020 && m <= 1380; // 17:00~23:00
}

/**
 * 하루치 아이템을 검증하고 문제 목록을 반환한다.
 * 문제가 없으면 빈 배열.
 */
export function validateDay(
  items: AIGeneratedItem[],
  dayNum: number,
  profile: { stamina?: string; arrivalTime?: string },
  totalDays: number,
): DayIssue[] {
  const issues: DayIssue[] = [];

  // 1. 식사 체크
  const hasLunch = items.some(i =>
    (i.category === 'restaurant' || i.category === 'cafe') && isLunchTime(i.startTime),
  );
  const hasDinner = items.some(i =>
    (i.category === 'restaurant' || i.category === 'cafe') && isDinnerTime(i.startTime),
  );

  // Day 1이 evening 도착이면 점심 불필요
  const isEveningArrival = dayNum === 1 && profile.arrivalTime === 'evening';
  // 마지막 날은 오전만일 수 있음 → 저녁 선택적
  const isLastDayDepartureEarly = dayNum === totalDays;

  if (!hasLunch && !isEveningArrival) {
    issues.push({ type: 'missing_lunch', detail: `Day ${dayNum}: 점심 없음` });
  }
  if (!hasDinner && !isLastDayDepartureEarly) {
    issues.push({ type: 'missing_dinner', detail: `Day ${dayNum}: 저녁 없음` });
  }

  // 2. 시간 순서/겹침 체크
  const sorted = [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = toMinutes(sorted[i - 1].endTime);
    const currStart = toMinutes(sorted[i].startTime);
    if (currStart < prevEnd) {
      issues.push({
        type: 'time_overlap',
        detail: `Day ${dayNum}: "${sorted[i - 1].placeNameSnapshot}" ~${sorted[i - 1].endTime} ↔ "${sorted[i].placeNameSnapshot}" ${sorted[i].startTime}~`,
        indices: [i - 1, i],
      });
    }
  }

  // 3. 아이템 수 (stamina 기반)
  const limits: Record<string, [number, number]> = {
    low: [2, 5],
    moderate: [3, 7],
    high: [4, 9],
  };
  const [, max] = limits[profile.stamina || 'moderate'] || [3, 7];
  if (items.length > max) {
    issues.push({
      type: 'too_many_items',
      detail: `Day ${dayNum}: ${items.length}개 (최대 ${max})`,
    });
  }

  // 4. Day 1 도착시간 체크
  if (dayNum === 1 && profile.arrivalTime === 'evening' && items.length > 0) {
    const firstStart = toMinutes(items[0].startTime);
    if (firstStart < 17 * 60) {
      issues.push({
        type: 'arrival_mismatch',
        detail: `Day 1: evening 도착인데 ${items[0].startTime} 시작`,
      });
    }
  }

  // 5. 음수/비정상 시간 체크
  for (const item of items) {
    if (item.startTime.includes('-') || item.endTime.includes('-')) {
      issues.push({
        type: 'negative_time',
        detail: `Day ${dayNum}: "${item.placeNameSnapshot}" ${item.startTime}~${item.endTime}`,
      });
    }
  }

  return issues;
}
