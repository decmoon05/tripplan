/**
 * v4 Day 내 장소 선택
 *
 * Day에 배정된 2차 군집의 검증된 장소 풀에서 장소를 선택.
 * 식사 우선 배정 → scoreCandidate 순위 → stamina 제한.
 */

import type { PlaceCandidate, DayContext, PlannerUserProfile, Area } from './types';
import { scoreCandidate } from './scorer';
import { applyDayDependentFilters } from './filter';
import { ITEMS_PER_DAY, AVG_TRANSIT_MINUTES } from './weights';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';

/**
 * 장소 이름 정규화 — 같은 장소의 다른 표기를 통일.
 * "かさの家" vs "か사の家" (한글/일본어 혼합) 같은 AI 표기 차이 처리.
 */
function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s・\-–/()（）]/g, '') // 공백, 중점, 하이픈, 슬래시, 괄호 제거
    .replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, '') // 한글 제거 (현지어만 비교)
    .trim();
}

/**
 * 이미 선택된 장소와 중복인지 확인.
 * 이름 정규화 매칭 + 좌표 근접(50m 이내) 매칭.
 */
function isDuplicate(
  candidate: PlaceCandidate,
  selected: PlaceCandidate[],
  usedNormalized: Set<string>,
): boolean {
  // 이름 매칭
  const norm = normalizePlaceName(candidate.placeNameSnapshot);
  if (norm.length > 0 && usedNormalized.has(norm)) return true;

  // 좌표 매칭 (50m 이내)
  if (candidate.latitude != null && candidate.longitude != null) {
    for (const s of selected) {
      if (s.latitude != null && s.longitude != null) {
        const dist = haversineKm(candidate.latitude, candidate.longitude, s.latitude, s.longitude);
        if (dist < 0.05) return true; // 50m
      }
    }
  }

  return false;
}

/**
 * Day에 장소를 배정.
 *
 * @param placePools areaId → 검증된 장소 풀
 * @param dayAreas 이 Day에 배정된 2차 군집들
 * @param dayContext Day 컨텍스트
 * @param userProfile 사용자 프로필
 * @param allAreaPools 전체 군집 풀 (식당 부족 시 fallback용)
 * @param excludeNames 이전 Day에서 이미 사용된 장소 이름 (cross-day 중복 방지)
 */
export function assignPlacesToDay(
  placePools: Map<string, PlaceCandidate[]>,
  dayAreas: Area[],
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
  allAreaPools?: Map<string, PlaceCandidate[]>,
  excludeNames?: Set<string>,
): PlaceCandidate[] {
  const stamina = userProfile.stamina as keyof typeof ITEMS_PER_DAY;
  const itemRange = ITEMS_PER_DAY[stamina] || ITEMS_PER_DAY.moderate;

  // 도착일/출발일은 아이템 축소
  let maxItems: number = itemRange.max;
  if (dayContext.isArrivalDay || dayContext.isDepartureDay) {
    maxItems = Math.max(Number(itemRange.min) - 1, 2);
  }

  // 이 Day에 해당하는 장소 풀 합치기 + Day 의존 필터 적용
  let available: PlaceCandidate[] = [];
  for (const area of dayAreas) {
    const pool = placePools.get(area.id);
    if (pool) available.push(...pool);
  }
  // businessHours, closedDay는 Day별로 다르므로 여기서 적용
  available = applyDayDependentFilters(available, dayContext);

  const selected: PlaceCandidate[] = [];
  const usedNames = new Set<string>(excludeNames || []);
  // 정규화된 이름 Set (Day 내 중복 감지용)
  const usedNormalized = new Set<string>(
    [...(excludeNames || [])].map(n => normalizePlaceName(n)).filter(n => n.length > 0)
  );

  // ─── 1. 식사 우선 배정 ───────────────────────────────────────────────────

  const needsLunch = !dayContext.isArrivalDay || dayContext.availableHours.start < 12;
  const needsDinner = dayContext.availableHours.end >= 19;

  const addPlace = (p: PlaceCandidate) => {
    selected.push(p);
    usedNames.add(p.placeNameSnapshot);
    const norm = normalizePlaceName(p.placeNameSnapshot);
    if (norm.length > 0) usedNormalized.add(norm);
  };

  if (needsLunch) {
    const lunch = findBestMeal(available, 'lunch', dayContext, userProfile, selected, usedNames, usedNormalized);
    if (lunch) {
      addPlace(lunch);
    } else {
      const fallbackLunch = findMealFromFallback('lunch', dayContext, userProfile, selected, usedNames, dayAreas, allAreaPools);
      if (fallbackLunch) addPlace(fallbackLunch);
    }
  }

  if (needsDinner) {
    const dinner = findBestMeal(available, 'dinner', dayContext, userProfile, selected, usedNames, usedNormalized);
    if (dinner) {
      addPlace(dinner);
    } else {
      const fallbackDinner = findMealFromFallback('dinner', dayContext, userProfile, selected, usedNames, dayAreas, allAreaPools);
      if (fallbackDinner) addPlace(fallbackDinner);
    }
  }

  // ─── 2. attraction 우선 배정 (관광 최소 보장) ────────────────────────────
  // 식사만 채우고 attraction이 없으면 "식사 스케줄"이 됨.
  // 최소 1~2개 attraction을 먼저 확보한 후 나머지를 score 순으로 채움.

  const allRemaining = available
    .filter(p => !isDuplicate(p, selected, usedNormalized) && !usedNames.has(p.placeNameSnapshot))
    .map(p => ({
      ...p,
      totalScore: scoreCandidate(p, dayContext, userProfile, selected),
    }));

  // 가용시간(분) 계산
  const availableMinutes = (dayContext.availableHours.end - dayContext.availableHours.start) * 60;
  let usedMinutes = selected.reduce(
    (sum, p) => sum + (p.estimatedDurationMinutes || 60) + AVG_TRANSIT_MINUTES,
    0,
  );

  // attraction 우선 (score 높은 순으로 최소 2개)
  const attractions = allRemaining
    .filter(p => p.category === 'attraction')
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  const attractionTarget = Math.min(2, Math.max(0, maxItems - selected.length - 2)); // 식사 슬롯 여유 확보
  let attractionCount = 0;

  for (const candidate of attractions) {
    if (attractionCount >= attractionTarget) break;
    if (selected.length >= maxItems) break;
    if (isDuplicate(candidate, selected, usedNormalized)) continue;
    const needed = (candidate.estimatedDurationMinutes || 60) + AVG_TRANSIT_MINUTES;
    if (usedMinutes + needed > availableMinutes) continue;
    addPlace(candidate);
    usedMinutes += needed;
    attractionCount++;
  }

  // ─── 3. 나머지: scoreCandidate 순위 + 시간 체크 ─────────────────────────

  const remaining = allRemaining
    .filter(p => !isDuplicate(p, selected, usedNormalized) && !usedNames.has(p.placeNameSnapshot))
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  for (const candidate of remaining) {
    if (selected.length >= maxItems) break;
    if (isDuplicate(candidate, selected, usedNormalized)) continue;
    const needed = (candidate.estimatedDurationMinutes || 60) + AVG_TRANSIT_MINUTES;
    if (usedMinutes + needed > availableMinutes) continue;
    addPlace(candidate);
    usedMinutes += needed;
  }

  return selected;
}

// ─── 식사 선택 헬퍼 ─────────────────────────────────────────────────────────

function findBestMeal(
  available: PlaceCandidate[],
  slot: 'lunch' | 'dinner',
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
  existing: PlaceCandidate[],
  usedNames: Set<string>,
  usedNormalized?: Set<string>,
): PlaceCandidate | null {
  const candidates = available.filter(
    p => p.mealSlot === slot &&
    !usedNames.has(p.placeNameSnapshot) &&
    !isDuplicate(p, existing, usedNormalized || new Set()) &&
    (p.category === 'restaurant' || p.category === 'cafe'),
  );

  if (candidates.length === 0) return null;

  // scoreCandidate로 최고점 선택
  const scored = candidates.map(c => ({
    ...c,
    totalScore: scoreCandidate(c, dayContext, userProfile, existing),
  }));
  scored.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  return scored[0];
}

/**
 * 식당 부족 시 fallback: 숙소 근처 군집에서 보충.
 */
function findMealFromFallback(
  slot: 'lunch' | 'dinner',
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
  existing: PlaceCandidate[],
  usedNames: Set<string>,
  currentAreas: Area[],
  allAreaPools?: Map<string, PlaceCandidate[]>,
): PlaceCandidate | null {
  if (!allAreaPools || !dayContext.accommodation) return null;

  // 현재 Day 군집 외의 풀에서 식당 찾기 (숙소에서 가장 가까운 군집 우선)
  const currentAreaIds = new Set(currentAreas.map(a => a.id));

  const otherPools = Array.from(allAreaPools.entries())
    .filter(([areaId]) => !currentAreaIds.has(areaId))
    .map(([areaId, places]) => ({ areaId, places }));

  for (const { places } of otherPools) {
    const meal = findBestMeal(places, slot, dayContext, userProfile, existing, usedNames);
    if (meal) return meal;
  }

  return null;
}
