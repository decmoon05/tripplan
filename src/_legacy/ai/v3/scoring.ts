/**
 * v3 슬롯 배정용 스코어링 알고리즘
 *
 * 노드 가중치: 장소 자체의 가치 (관심사 매칭, 품질, 신뢰도)
 * 엣지 비용: 장소 간 이동 비용 (haversine 거리)
 * 군집화: K-means로 장소를 지역 클러스터로 묶기
 */

import { haversineKm } from '../itineraryValidation';
import type { EnrichedPlace } from './types';

// ---------------------------------------------------------------------------
// 노드 스코어 — 장소 자체의 가치 (0~1)
// ---------------------------------------------------------------------------

/**
 * 장소의 종합 가치 점수.
 * 관심사 매칭이 가장 중요하고, 품질/신뢰도/좌표 유무가 보완.
 */
export function nodeScore(place: EnrichedPlace, userInterests: string[]): number {
  // 관심사 매칭 (0~1) — 가중치 0.35
  const interestScore = jaccardSimilarity(place.reasonTags || [], userInterests);

  // 품질 (0~1) — 가중치 0.25
  const qualityScore = place.verified
    ? (place.rating ? Math.min(1.0, place.rating / 5.0) : 0.7)
    : 0.3;

  // placeConfidence (0~1) — 가중치 0.20
  const pc = (place as unknown as Record<string, unknown>).placeConfidence as string | undefined;
  const confidenceScore = pc === 'verified' ? 1.0 : pc === 'unverified' ? 0.4 : 0.6;

  // 좌표 유무 (0~1) — 가중치 0.20 (좌표 있어야 경로 최적화 가능)
  const coordScore = (place.latitude != null && place.longitude != null) ? 1.0 : 0.3;

  return 0.35 * interestScore
       + 0.25 * qualityScore
       + 0.20 * confidenceScore
       + 0.20 * coordScore;
}

// ---------------------------------------------------------------------------
// 엣지 비용 — 장소 간 이동 비용 (0~1, 높을수록 비쌈)
// ---------------------------------------------------------------------------

/**
 * 두 장소 간 이동 비용. 0(같은 위치) ~ 1(50km+).
 * 좌표 없으면 중간 비용(0.5) 부여 — 보수적.
 */
export function edgeCost(from: EnrichedPlace, to: EnrichedPlace): number {
  if (!from.latitude || !from.longitude || !to.latitude || !to.longitude) {
    return 0.5; // 좌표 없으면 중간 비용
  }
  const km = haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
  return Math.min(1.0, km / 50); // 50km = 최대 비용
}

// ---------------------------------------------------------------------------
// Jaccard 유사도 — 두 태그 배열 간 유사도 (0~1)
// ---------------------------------------------------------------------------

export function jaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;
  const setA = new Set(tagsA.map(t => t.toLowerCase().replace('#', '')));
  const setB = new Set(tagsB.map(t => t.toLowerCase().replace('#', '')));
  let intersection = 0;
  for (const tag of setA) {
    if (setB.has(tag)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// 시간대 적합도 — timePreference와 슬롯의 매칭 (0~1)
// ---------------------------------------------------------------------------

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TEMPORAL_FIT: Record<string, Record<TimeSlot, number>> = {
  morning:   { morning: 1.0, afternoon: 0.3, evening: 0.0 },
  afternoon: { morning: 0.2, afternoon: 1.0, evening: 0.4 },
  evening:   { morning: 0.0, afternoon: 0.2, evening: 1.0 },
  anytime:   { morning: 0.7, afternoon: 0.8, evening: 0.7 },
};

export function temporalFit(place: EnrichedPlace, slot: TimeSlot): number {
  return TEMPORAL_FIT[place.timePreference]?.[slot] ?? 0.5;
}

// ---------------------------------------------------------------------------
// K-means 군집화 — 장소를 K개 지역 클러스터로 묶기
// ---------------------------------------------------------------------------

interface Cluster {
  centerLat: number;
  centerLon: number;
  places: EnrichedPlace[];
}

/**
 * 좌표 기반 K-means 군집화.
 * K = totalDays. 좌표 없는 장소는 가장 가까운 클러스터에 배정.
 * 좌표 있는 장소가 K 미만이면 null 반환 (군집화 불가).
 */
export function clusterPlaces(
  places: EnrichedPlace[],
  k: number,
): Cluster[] | null {
  const withCoords = places.filter(p => p.latitude != null && p.longitude != null);
  const withoutCoords = places.filter(p => p.latitude == null || p.longitude == null);

  if (withCoords.length < k || k <= 1) return null;

  // Farthest-first 초기화 — 가장 먼 장소들을 시드로
  const seeds: EnrichedPlace[] = [withCoords[0]];
  while (seeds.length < k) {
    let farthest: EnrichedPlace | null = null;
    let maxDist = -1;
    for (const p of withCoords) {
      if (seeds.includes(p)) continue;
      const minDistToSeed = Math.min(
        ...seeds.map(s => haversineKm(p.latitude!, p.longitude!, s.latitude!, s.longitude!)),
      );
      if (minDistToSeed > maxDist) {
        maxDist = minDistToSeed;
        farthest = p;
      }
    }
    if (farthest) seeds.push(farthest);
    else break;
  }

  // K-means 반복 (5회 — 장소 20~30개 수준에서 충분)
  let clusters: Cluster[] = seeds.map(s => ({
    centerLat: s.latitude!,
    centerLon: s.longitude!,
    places: [],
  }));

  for (let iter = 0; iter < 5; iter++) {
    // 클러스터 비우기
    for (const c of clusters) c.places = [];

    // 각 장소를 가장 가까운 클러스터에 배정
    for (const p of withCoords) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < clusters.length; ci++) {
        const dist = haversineKm(p.latitude!, p.longitude!, clusters[ci].centerLat, clusters[ci].centerLon);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = ci;
        }
      }
      clusters[bestIdx].places.push(p);
    }

    // 빈 클러스터 제거
    clusters = clusters.filter(c => c.places.length > 0);

    // 중심 재계산
    for (const c of clusters) {
      c.centerLat = c.places.reduce((s, p) => s + p.latitude!, 0) / c.places.length;
      c.centerLon = c.places.reduce((s, p) => s + p.longitude!, 0) / c.places.length;
    }
  }

  // 좌표 없는 장소를 아이템 수가 적은 클러스터에 분배
  withoutCoords.sort(() => Math.random() - 0.5); // 셔플
  for (const p of withoutCoords) {
    // 가장 아이템이 적은 클러스터에 추가
    clusters.sort((a, b) => a.places.length - b.places.length);
    clusters[0].places.push(p);
  }

  return clusters;
}

/**
 * 클러스터 간 이동 거리를 최소화하는 순서 결정 (Greedy NN).
 * 반환: 클러스터 인덱스 배열 (날짜 순서)
 */
export function orderClusters(clusters: Cluster[]): number[] {
  if (clusters.length <= 1) return clusters.map((_, i) => i);

  const visited = new Set<number>();
  const order: number[] = [0]; // 첫 번째 클러스터부터 시작
  visited.add(0);

  while (order.length < clusters.length) {
    const current = clusters[order[order.length - 1]];
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      if (visited.has(i)) continue;
      const dist = haversineKm(
        current.centerLat, current.centerLon,
        clusters[i].centerLat, clusters[i].centerLon,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      order.push(bestIdx);
      visited.add(bestIdx);
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// 2-opt 경로 개선 — 교차 경로 제거
// ---------------------------------------------------------------------------

/**
 * 2-opt: 좌표가 있는 아이템의 순서를 개선하여 총 이동 거리를 줄임.
 * 식사 아이템은 고정 (점심/저녁 위치 유지).
 */
export function twoOpt(items: EnrichedPlace[]): EnrichedPlace[] {
  const result = [...items];
  const n = result.length;
  if (n < 4) return result;

  // 식사 아이템의 인덱스를 고정
  const fixedIndices = new Set<number>();
  result.forEach((item, idx) => {
    if (item.mealSlot === 'lunch' || item.mealSlot === 'dinner') {
      fixedIndices.add(idx);
    }
  });

  let improved = true;
  let iterations = 0;
  const maxIterations = n * n; // 최대 N² 반복

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 2; i++) {
      if (fixedIndices.has(i) || fixedIndices.has(i + 1)) continue;

      for (let j = i + 2; j < n; j++) {
        if (fixedIndices.has(j) || fixedIndices.has(j === n - 1 ? j : j + 1)) continue;

        // i와 j 사이에 고정 인덱스가 있으면 스킵
        let hasFixed = false;
        for (let k = i + 1; k <= j; k++) {
          if (fixedIndices.has(k)) { hasFixed = true; break; }
        }
        if (hasFixed) continue;

        const costBefore = segmentCost(result, i, j);
        // 2-opt 역순
        const reversed = [...result];
        const segment = reversed.slice(i + 1, j + 1).reverse();
        reversed.splice(i + 1, j - i, ...segment);
        const costAfter = segmentCost(reversed, i, j);

        if (costAfter < costBefore) {
          result.splice(i + 1, j - i, ...segment);
          improved = true;
        }
      }
    }
  }

  return result;
}

function segmentCost(items: EnrichedPlace[], i: number, j: number): number {
  let cost = 0;
  for (let k = i; k <= Math.min(j, items.length - 2); k++) {
    cost += edgeCost(items[k], items[k + 1]);
  }
  return cost;
}
