/**
 * v4 동선 최적화
 *
 * 같은 Day에 2개 군집이 배정되면 군집 단위로 묶어서 순서 결정.
 * 텐진 장소 전부 → 다자이후 장소 전부 (왕복 방지).
 *
 * 1. areaId별 그룹핑
 * 2. 그룹 간 순서 (숙소에서 가까운 군집 먼저)
 * 3. 그룹 내 Greedy NN + 2-opt
 * 4. 식사 앵커 삽입 (lunch→그룹 전환점 부근, dinner→마지막 그룹)
 * 5. max_walking_minutes 체크
 */

import type { PlaceCandidate, DayContext, PlannerUserProfile } from './types';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';

export function optimizeDayRoute(
  places: PlaceCandidate[],
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
): PlaceCandidate[] {
  if (places.length <= 1) return places;

  // ─── 1. areaId별 그룹핑 ──────────────────────────────────────────────────

  const areaGroups = new Map<string, { places: PlaceCandidate[]; centerLat: number; centerLon: number }>();

  for (const p of places) {
    const key = p.areaId || '_unknown';
    if (!areaGroups.has(key)) {
      areaGroups.set(key, { places: [], centerLat: 0, centerLon: 0 });
    }
    areaGroups.get(key)!.places.push(p);
  }

  // 그룹별 중심 좌표 계산
  for (const group of areaGroups.values()) {
    const withCoords = group.places.filter(p => p.latitude != null);
    if (withCoords.length > 0) {
      group.centerLat = withCoords.reduce((s, p) => s + p.latitude!, 0) / withCoords.length;
      group.centerLon = withCoords.reduce((s, p) => s + p.longitude!, 0) / withCoords.length;
    }
  }

  // ─── 2. 그룹 간 순서 (숙소에서 가까운 군집 먼저) ──────────────────────────

  const startPoint = dayContext.accommodation
    ? { lat: dayContext.accommodation.lat, lon: dayContext.accommodation.lon }
    : null;

  const groupEntries = Array.from(areaGroups.entries());

  if (startPoint && groupEntries.length > 1) {
    groupEntries.sort((a, b) => {
      const distA = haversineKm(startPoint.lat, startPoint.lon, a[1].centerLat, a[1].centerLon);
      const distB = haversineKm(startPoint.lat, startPoint.lon, b[1].centerLat, b[1].centerLon);
      return distA - distB;
    });
  }

  // ─── 3. 그룹 내 정렬 (식사/비식사 분리 → Greedy NN → 2-opt) ──────────────

  const allOrdered: PlaceCandidate[] = [];
  let prevPoint = startPoint;

  for (const [, group] of groupEntries) {
    const meals: { place: PlaceCandidate; targetPosition: 'early' | 'mid' | 'late' }[] = [];
    const others: PlaceCandidate[] = [];

    for (const p of group.places) {
      if (p.mealSlot === 'breakfast') meals.push({ place: p, targetPosition: 'early' });
      else if (p.mealSlot === 'lunch') meals.push({ place: p, targetPosition: 'mid' });
      else if (p.mealSlot === 'dinner') meals.push({ place: p, targetPosition: 'late' });
      else others.push(p);
    }

    // 이전 그룹의 마지막 장소에서 이어서 Greedy NN
    const groupStart = prevPoint
      || (others[0]?.latitude != null ? { lat: others[0].latitude!, lon: others[0].longitude! } : null);

    const ordered = greedyNN(others, groupStart);
    const withMeals = insertMealAnchors(ordered, meals);

    // 그룹 내 2-opt (식사 고정)
    const fixedIndices = new Set<number>();
    for (let i = 0; i < withMeals.length; i++) {
      if (withMeals[i].mealSlot === 'lunch' || withMeals[i].mealSlot === 'dinner' || withMeals[i].mealSlot === 'breakfast') {
        fixedIndices.add(i);
      }
    }
    const optimized = twoOptImprove(withMeals, fixedIndices);

    allOrdered.push(...optimized);

    // 다음 그룹의 시작점 = 이 그룹의 마지막 장소
    const last = optimized[optimized.length - 1];
    if (last?.latitude != null) {
      prevPoint = { lat: last.latitude!, lon: last.longitude! };
    }
  }

  // ─── 4. max_walking_minutes 체크 ──────────────────────────────────────────

  return applyWalkingLimit(allOrdered, userProfile.maxWalkingMinutes);
}

// ─── 공용 함수 ───────────────────────────────────────────────────────────────

export function edgeCost(from: PlaceCandidate, to: PlaceCandidate): number {
  if (from.latitude == null || from.longitude == null || to.latitude == null || to.longitude == null) {
    return 0.5;
  }
  return Math.min(1.0, haversineKm(from.latitude, from.longitude, to.latitude, to.longitude) / 50);
}

export function twoOptImprove(
  ordered: PlaceCandidate[],
  fixedIndices: Set<number>,
): PlaceCandidate[] {
  const n = ordered.length;
  if (n <= 3) return ordered;

  const items = [...ordered];
  let improved = true;
  let iterations = 0;
  const maxIter = n * n;

  while (improved && iterations < maxIter) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 2; i++) {
      if (fixedIndices.has(i) || fixedIndices.has(i + 1)) continue;

      for (let j = i + 2; j < n; j++) {
        if (fixedIndices.has(j)) continue;
        const jNext = j + 1 < n ? j + 1 : j;
        if (fixedIndices.has(jNext)) continue;

        const d1 = edgeCost(items[i], items[i + 1]) + edgeCost(items[j], items[jNext]);
        const d2 = edgeCost(items[i], items[j]) + edgeCost(items[i + 1], items[jNext]);

        if (d2 < d1 - 0.001) {
          let left = i + 1;
          let right = j;
          while (left < right) {
            if (fixedIndices.has(left) || fixedIndices.has(right)) break;
            [items[left], items[right]] = [items[right], items[left]];
            left++;
            right--;
          }
          improved = true;
        }
      }
    }
  }

  return items;
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

function greedyNN(
  places: PlaceCandidate[],
  startPoint: { lat: number; lon: number } | null,
): PlaceCandidate[] {
  if (places.length <= 1) return [...places];

  const remaining = [...places];
  const result: PlaceCandidate[] = [];

  if (startPoint) {
    remaining.sort((a, b) => {
      const dA = a.latitude != null ? haversineKm(startPoint.lat, startPoint.lon, a.latitude, a.longitude!) : 999;
      const dB = b.latitude != null ? haversineKm(startPoint.lat, startPoint.lon, b.latitude, b.longitude!) : 999;
      return dA - dB;
    });
  }

  result.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = (last.latitude != null && remaining[i].latitude != null)
        ? haversineKm(last.latitude, last.longitude!, remaining[i].latitude!, remaining[i].longitude!)
        : 999;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result;
}

function insertMealAnchors(
  ordered: PlaceCandidate[],
  meals: { place: PlaceCandidate; targetPosition: 'early' | 'mid' | 'late' }[],
): PlaceCandidate[] {
  const result = [...ordered];

  const sorted = meals.sort((a, b) => {
    const order = { early: 0, mid: 1, late: 2 };
    return order[a.targetPosition] - order[b.targetPosition];
  });

  for (const meal of sorted) {
    const n = result.length;
    let idx: number;
    if (meal.targetPosition === 'early') {
      idx = 0;
    } else if (meal.targetPosition === 'mid') {
      idx = Math.floor(n / 2);
    } else {
      idx = n;
    }
    result.splice(idx, 0, meal.place);
  }

  return result;
}

function applyWalkingLimit(
  places: PlaceCandidate[],
  maxWalkingMinutes: number | null,
): PlaceCandidate[] {
  if (maxWalkingMinutes == null) return places;

  const walkSpeedKmH = 5;
  const maxWalkKm = (maxWalkingMinutes / 60) * walkSpeedKmH;

  for (let i = 0; i < places.length - 1; i++) {
    const a = places[i];
    const b = places[i + 1];
    if (a.latitude != null && b.latitude != null) {
      const dist = haversineKm(a.latitude, a.longitude!, b.latitude, b.longitude!);
      if (dist > maxWalkKm) {
        // 도보 한계 초과 → timeCalculator에서 이동수단을 public/taxi로 전환
        // timeCalculator.estimateTransitTime이 거리 기반으로 자동 결정하므로
        // 여기서는 별도 마킹 불필요 (haversine > maxWalkKm이면 자동으로 대중교통)
      }
    }
  }

  return places;
}
