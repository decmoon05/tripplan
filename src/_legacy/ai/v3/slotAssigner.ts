/**
 * v3 슬롯 배정 알고리즘 — 그래프 기반 가중치 스코어링
 *
 * 1. 식사 슬롯 자동 분류
 * 2. K-means 지리적 군집화 (날짜별 지역 묶기)
 * 3. 노드 스코어 기반 장소 선택
 * 4. 엣지 비용 기반 순서 최적화 (Greedy NN + 2-opt)
 * 5. 거리 검증
 */

import type { EnrichedPlace, V3Config } from './types';
import { haversineKm } from '../itineraryValidation';
import {
  nodeScore,
  edgeCost,
  temporalFit,
  clusterPlaces,
  orderClusters,
  twoOpt,
} from './scoring';

/** 하루 일정 */
interface DaySchedule {
  dayNumber: number;
  items: EnrichedPlace[];
}

/** 요일 한국어 매핑 */
const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 슬롯 배정 옵션 (pipelineV3에서 전달) */
export interface AssignSlotsOptions {
  userInterests?: string[];
}

/**
 * 장소 리스트를 날짜별로 배정한다.
 * 군집화 → 스코어링 → 최적 순서.
 */
export function assignSlots(
  places: EnrichedPlace[],
  config: V3Config,
  options?: AssignSlotsOptions,
): DaySchedule[] {
  const { totalDays, startDate, arrivalTime, stamina } = config;
  const userInterests = options?.userInterests || [];

  // ─── Phase 0: 식사 슬롯 자동 분류 ───
  autoClassifyMeals(places);

  // ─── Phase 1: 분리 ───
  const lunches = places.filter(p => p.mealSlot === 'lunch' && (p.category === 'restaurant' || p.category === 'cafe'));
  const dinners = places.filter(p => p.mealSlot === 'dinner' && (p.category === 'restaurant' || p.category === 'cafe'));
  const others = places.filter(p => p.mealSlot !== 'lunch' && p.mealSlot !== 'dinner');

  console.log(`[SlotAssigner] 입력: ${places.length}개 (lunch: ${lunches.length}, dinner: ${dinners.length}, others: ${others.length})`);

  // ─── Phase 2: 요일 + 휴무 필터 ───
  const dayOfWeek: string[] = [];
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    dayOfWeek.push(DAY_NAMES_KO[date.getDay()]);
  }

  function isOpenOnDay(place: EnrichedPlace, dayIndex: number): boolean {
    if (!place.closedDays) return true;
    const closed = place.closedDays.toLowerCase();
    if (closed.includes('연중무휴') || closed.includes('없음')) return true;
    return !closed.includes(dayOfWeek[dayIndex] + '요일');
  }

  // ─── Phase 3: 지리적 군집화 (NEW) ───
  const clusters = clusterPlaces(others, totalDays);
  let dayPlacePools: EnrichedPlace[][];

  if (clusters) {
    // 클러스터 순서 결정 (이동 거리 최소화)
    const clusterOrder = orderClusters(clusters);
    dayPlacePools = clusterOrder.map(ci => clusters[ci].places);
    console.log(`[SlotAssigner] 군집화 성공: ${clusters.length}개 클러스터`);
    clusters.forEach((c, i) => {
      console.log(`  클러스터 ${i}: ${c.places.length}개 (center: ${c.centerLat.toFixed(2)}, ${c.centerLon.toFixed(2)})`);
    });
  } else {
    // 군집화 불가 → 기존 방식 (전체 풀에서 채우기)
    dayPlacePools = Array.from({ length: totalDays }, () => [...others]);
    console.log(`[SlotAssigner] 군집화 불가 (좌표 부족) → 단일 풀 모드`);
  }

  // ─── Phase 4: 날짜별 스코어 기반 배정 (REWRITE) ───
  const days: DaySchedule[] = [];
  const usedPlaces = new Set<string>();
  const maxItems: Record<string, number> = { low: 5, moderate: 7, high: 9 };
  const dayMax = maxItems[stamina] || 7;
  const day1MaxItems = arrivalTime === 'evening' ? 3
    : arrivalTime === 'afternoon' ? Math.ceil(dayMax * 0.6) : dayMax;

  for (let d = 0; d < totalDays; d++) {
    const dayNum = d + 1;
    const isDay1 = dayNum === 1;
    const currentMax = isDay1 ? day1MaxItems : dayMax;
    const dayItems: EnrichedPlace[] = [];

    // 식사 배정 — 해당 날짜 클러스터와 가까운 식당 우선
    const dayPool = dayPlacePools[Math.min(d, dayPlacePools.length - 1)];
    const dayCenter = getDayCenter(dayPool);

    // 점심
    const skipLunch = isDay1 && arrivalTime === 'evening';
    if (!skipLunch) {
      const lunch = findScoredMeal(lunches, d, usedPlaces, isOpenOnDay, userInterests, dayCenter);
      if (lunch) {
        dayItems.push(lunch);
        usedPlaces.add(lunch.placeNameSnapshot);
        console.log(`[SlotAssigner] Day${dayNum} 점심: ${lunch.placeNameSnapshot}`);
      } else {
        // fallback: 아무 식당
        const fallback = findFallbackMeal(places, usedPlaces, p => isOpenOnDay(p, d));
        if (fallback) {
          const lunchFallback = { ...fallback, mealSlot: 'lunch' as const };
          dayItems.push(lunchFallback);
          usedPlaces.add(lunchFallback.placeNameSnapshot);
          console.log(`[SlotAssigner] Day${dayNum} 점심 (fallback): ${lunchFallback.placeNameSnapshot}`);
        }
      }
    }

    // 저녁
    const dinner = findScoredMeal(dinners, d, usedPlaces, isOpenOnDay, userInterests, dayCenter);
    if (dinner) {
      dayItems.push(dinner);
      usedPlaces.add(dinner.placeNameSnapshot);
      console.log(`[SlotAssigner] Day${dayNum} 저녁: ${dinner.placeNameSnapshot}`);
    } else {
      const fallback = findFallbackMeal(places, usedPlaces, p => isOpenOnDay(p, d));
      if (fallback) {
        const dinnerFallback = { ...fallback, mealSlot: 'dinner' as const };
        dayItems.push(dinnerFallback);
        usedPlaces.add(dinnerFallback.placeNameSnapshot);
        console.log(`[SlotAssigner] Day${dayNum} 저녁 (fallback): ${dinnerFallback.placeNameSnapshot}`);
      }
    }

    // 관광지 배정 — 스코어 기반
    const remaining = currentMax - dayItems.length;
    const candidates = dayPool
      .filter(p => !usedPlaces.has(p.placeNameSnapshot) && isOpenOnDay(p, d))
      .map(p => ({
        place: p,
        score: computePlaceScore(p, dayItems, userInterests, isDay1, arrivalTime),
      }))
      .sort((a, b) => b.score - a.score); // 높은 스코어 우선

    let filled = 0;
    for (const { place } of candidates) {
      if (filled >= remaining) break;
      dayItems.push(place);
      usedPlaces.add(place.placeNameSnapshot);
      filled++;
    }

    // 클러스터 풀이 부족하면 전체 풀에서 보충
    if (filled < remaining) {
      const globalCandidates = others
        .filter(p => !usedPlaces.has(p.placeNameSnapshot) && isOpenOnDay(p, d))
        .map(p => ({
          place: p,
          score: computePlaceScore(p, dayItems, userInterests, isDay1, arrivalTime),
        }))
        .sort((a, b) => b.score - a.score);

      for (const { place } of globalCandidates) {
        if (filled >= remaining) break;
        dayItems.push(place);
        usedPlaces.add(place.placeNameSnapshot);
        filled++;
      }
    }

    // ─── Phase 5: 엣지 비용 기반 순서 최적화 ───
    const sorted = sortDayItemsWithScoring(dayItems);

    days.push({ dayNumber: dayNum, items: sorted });
  }

  // ─── Phase 6: 동일 날짜 내 거리 검증 ───
  for (const day of days) {
    const withCoords = day.items.filter(i => i.latitude != null && i.longitude != null);
    for (let i = 1; i < withCoords.length; i++) {
      const prev = withCoords[i - 1];
      const curr = withCoords[i];
      const dist = haversineKm(prev.latitude!, prev.longitude!, curr.latitude!, curr.longitude!);
      if (dist > 50) {
        console.warn(`[SlotAssigner] Day${day.dayNumber} 거리 경고: "${prev.placeNameSnapshot}" → "${curr.placeNameSnapshot}" = ${dist.toFixed(0)}km`);
      }
    }
  }

  return days;
}

// ---------------------------------------------------------------------------
// 스코어 기반 배정 헬퍼
// ---------------------------------------------------------------------------

/** 장소 종합 점수 = 노드 스코어 + 시간대 적합 + 거리 보너스 */
function computePlaceScore(
  place: EnrichedPlace,
  dayItems: EnrichedPlace[],
  userInterests: string[],
  isDay1: boolean,
  arrivalTime: string,
): number {
  // 노드 스코어 (관심사, 품질, 신뢰도)
  const nScore = nodeScore(place, userInterests);

  // 시간대 적합
  const slots: Array<'morning' | 'afternoon' | 'evening'> =
    isDay1 && arrivalTime === 'evening' ? ['evening']
    : isDay1 && arrivalTime === 'afternoon' ? ['afternoon', 'evening']
    : ['morning', 'afternoon', 'evening'];
  const tScore = Math.max(...slots.map(s => temporalFit(place, s)));

  // 거리 보너스: 이미 배치된 장소와 가까울수록 보너스
  let distBonus = 0;
  if (dayItems.length > 0 && place.latitude && place.longitude) {
    const avgEdge = dayItems
      .filter(di => di.latitude && di.longitude)
      .map(di => 1 - edgeCost(di, place)) // 가까울수록 높은 보너스
      .reduce((a, b) => a + b, 0) / Math.max(1, dayItems.filter(di => di.latitude).length);
    distBonus = avgEdge;
  }

  // 카테고리 다양성 패널티
  const sameCatCount = dayItems.filter(di => di.category === place.category).length;
  const diversityPenalty = sameCatCount > 1 ? -0.15 * sameCatCount : 0;

  return 0.35 * nScore + 0.25 * tScore + 0.25 * distBonus + 0.15 + diversityPenalty;
}

/** 스코어 기반 식사 선택 — 관심사 + 해당 날짜 클러스터 거리 */
function findScoredMeal(
  meals: EnrichedPlace[],
  dayIndex: number,
  used: Set<string>,
  isOpen: (p: EnrichedPlace, d: number) => boolean,
  userInterests: string[],
  dayCenter: { lat: number; lon: number } | null,
): EnrichedPlace | null {
  const available = meals.filter(m => !used.has(m.placeNameSnapshot) && isOpen(m, dayIndex));
  if (available.length === 0) return null;

  // 스코어링: 관심사 + 거리
  const scored = available.map(m => {
    let score = nodeScore(m, userInterests);
    if (dayCenter && m.latitude && m.longitude) {
      const dist = haversineKm(dayCenter.lat, dayCenter.lon, m.latitude, m.longitude);
      score += Math.max(0, 1 - dist / 30) * 0.3; // 30km 이내면 보너스
    }
    return { meal: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].meal;
}

/** fallback 식사 — 아무 레스토랑 */
function findFallbackMeal(
  allPlaces: EnrichedPlace[],
  used: Set<string>,
  isOpen: (p: EnrichedPlace) => boolean,
): EnrichedPlace | null {
  const available = allPlaces.filter(p =>
    (p.category === 'restaurant' || p.category === 'cafe') &&
    !used.has(p.placeNameSnapshot) && isOpen(p),
  );
  return available.length > 0 ? available[0] : null;
}

/** 클러스터 중심 계산 */
function getDayCenter(pool: EnrichedPlace[]): { lat: number; lon: number } | null {
  const withCoords = pool.filter(p => p.latitude != null && p.longitude != null);
  if (withCoords.length === 0) return null;
  const lat = withCoords.reduce((s, p) => s + p.latitude!, 0) / withCoords.length;
  const lon = withCoords.reduce((s, p) => s + p.longitude!, 0) / withCoords.length;
  return { lat, lon };
}

// ---------------------------------------------------------------------------
// 식사 슬롯 자동 분류 (Phase 0)
// ---------------------------------------------------------------------------

function autoClassifyMeals(places: EnrichedPlace[]): void {
  let lunchCount = places.filter(p => p.mealSlot === 'lunch').length;
  let dinnerCount = places.filter(p => p.mealSlot === 'dinner').length;

  for (const place of places) {
    if ((place.category === 'restaurant' || place.category === 'cafe') && place.mealSlot === 'none') {
      if (place.timePreference === 'morning' || place.timePreference === 'afternoon') {
        place.mealSlot = 'lunch';
      } else if (place.timePreference === 'evening') {
        place.mealSlot = 'dinner';
      } else {
        if (lunchCount <= dinnerCount) {
          place.mealSlot = 'lunch';
          lunchCount++;
        } else {
          place.mealSlot = 'dinner';
          dinnerCount++;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 엣지 비용 기반 순서 정렬 + 2-opt
// ---------------------------------------------------------------------------

function sortDayItemsWithScoring(items: EnrichedPlace[]): EnrichedPlace[] {
  const lunch = items.find(i => i.mealSlot === 'lunch');
  const dinner = items.find(i => i.mealSlot === 'dinner');
  const others = items.filter(i => i.mealSlot !== 'lunch' && i.mealSlot !== 'dinner');

  // 시간대 기반 1차 정렬
  const order: Record<string, number> = { morning: 0, anytime: 1, afternoon: 2, evening: 3 };
  others.sort((a, b) => (order[a.timePreference] ?? 1) - (order[b.timePreference] ?? 1));

  // 오전/오후 블록 분리
  const morningBlock = others.filter(o => (order[o.timePreference] ?? 1) <= 1).slice(0, 2);
  const afternoonBlock = [
    ...others.filter(o => (order[o.timePreference] ?? 1) <= 1).slice(2),
    ...others.filter(o => (order[o.timePreference] ?? 1) >= 2),
  ];

  // 2-opt로 블록 내 순서 최적화
  const optimizedMorning = twoOpt(morningBlock);
  const optimizedAfternoon = twoOpt(afternoonBlock);

  // 조합: 오전 → 점심 → 오후 → 저녁 → 야간
  const maxBeforeDinner = Math.min(3, optimizedAfternoon.length);
  const beforeDinner = optimizedAfternoon.slice(0, maxBeforeDinner);
  const afterDinner = optimizedAfternoon.slice(maxBeforeDinner);

  const result: EnrichedPlace[] = [];
  result.push(...optimizedMorning);
  if (lunch) result.push(lunch);
  result.push(...beforeDinner);
  if (dinner) result.push(dinner);
  result.push(...afterDinner);

  // 3연속 같은 카테고리 방지
  for (let i = 2; i < result.length; i++) {
    if (result[i - 2].category === result[i - 1].category && result[i - 1].category === result[i].category
        && result[i].category !== 'restaurant' && result[i].category !== 'cafe') {
      for (let j = i + 1; j < result.length; j++) {
        if (result[j].category !== result[i].category) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }

  // 아이템 유실 검증
  if (result.length !== items.length) {
    console.error(`[SlotAssigner] 아이템 유실! 입력 ${items.length} → 출력 ${result.length}`);
    for (const item of items) {
      if (!result.includes(item)) result.push(item);
    }
  }

  return result;
}
