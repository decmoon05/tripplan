/**
 * v4 전체 파이프라인 오케스트레이션
 *
 * Phase 2(AI 추천 + 필터 + 검증) + Phase 3(Day 배정 + 동선 + 시간)을
 * 순서대로 실행하여 TripItem[]을 생성.
 *
 * 파이프라인 순서:
 * 1. Day별 2차 군집 배정
 * 2. 고유 군집별 AI 장소 추천 (캐시로 중복 방지)
 * 3. Hard Filter
 * 4. 경량 정렬 (interest + quality만) → 상위 N개
 * 5. 검증 (Nominatim/Google)
 * 6. Post-Verify Filter (군집 반경)
 * 7. Day 내 장소 선택 (전체 scoreCandidate)
 * 8. 동선 최적화 (Greedy NN + 2-opt)
 * 9. 시간 계산 (OSRM)
 * 10. TripItem 변환
 */

import type { TripItem } from '@/types/database';
import type {
  Region, Area, DayContext, PlannerUserProfile, PlaceCandidate,
  ScheduledPlace, StreamEvent, DebugLog, PlaceCategory,
  RegionDayAssignment, ForcedPlace,
} from './types';
import { buildPlaceRecommendationPrompt } from './promptPlanner';
import { callGeminiForPlaces } from './aiAdapter';
import { applyDayIndependentFilters } from './filter';
import { lightScore } from './scorer';
import { verifyTopPlaces, postVerifyFilter } from './verifier';
import { assignAreasToDays } from './dayAssigner';
import { assignPlacesToDay } from './placeAssigner';
import { optimizeDayRoute } from './routeOptimizer';
import { calculateTimes, getOsrmStats, resetOsrmStats } from './timeCalculator';
import { toTripItems } from './tripItemMapper';
import { BASE_PLACES_PER_CATEGORY, BASE_VERIFY_TOP_N, placeScaleFactor, ITEMS_PER_DAY } from './weights';

/**
 * v4 메인 파이프라인 (비스트리밍).
 */
export async function generateItinerary(
  profile: PlannerUserProfile,
  tripInput: { destination: string; startDate: string; endDate: string },
  dayContexts: DayContext[],
  regionDayMap: RegionDayAssignment[],
  forcedPlaces?: ForcedPlace[],
): Promise<{
  items: TripItem[];
  debugLog: DebugLog;
  cost: { aiCalls: number; apiCalls: number; totalUSD: number };
}> {
  const events: StreamEvent[] = [];
  const generator = generateItineraryStream(profile, tripInput, dayContexts, regionDayMap, forcedPlaces);

  for await (const event of generator) {
    events.push(event);
  }

  const completeEvent = events.find(e => e.type === 'complete');
  const items = completeEvent?.type === 'complete' ? completeEvent.items : [];

  // debugLog 조립
  const debugLog: DebugLog = {
    dayAssignments: events.filter(e => e.type === 'day_areas').map(e => e.type === 'day_areas' ? { dayNumber: e.dayNumber, areas: e.areas } : { dayNumber: 0, areas: [] }),
    aiCalls: [],
    filterStats: events.filter(e => e.type === 'filtered').map(e => e.type === 'filtered' ? { area: '', before: e.before, after: e.after } : { area: '', before: 0, after: 0 }),
    verifyStats: { verified: 0, failed: 0, costUSD: 0 },
    osrmStats: getOsrmStats(),
    totalCostUSD: 0,
  };

  return { items, debugLog, cost: { aiCalls: 0, apiCalls: 0, totalUSD: 0 } };
}

/**
 * v4 스트리밍 파이프라인.
 */
export async function* generateItineraryStream(
  profile: PlannerUserProfile,
  tripInput: { destination: string; startDate: string; endDate: string },
  dayContexts: DayContext[],
  regionDayMap: RegionDayAssignment[],
  forcedPlaces?: ForcedPlace[],
): AsyncGenerator<StreamEvent> {
  resetOsrmStats();
  let totalCost = 0;

  // ─── Step 1: Day별 군집 배정 (regionDayMap → dayAssigner per Day) ──────

  yield { type: 'progress', message: '📅 Day별 지역 배정 중...' };

  // Day별로 해당 region의 areas만 전달하여 2차 군집 배정
  const dayAssignments = assignAreasToDays(regionDayMap, dayContexts, profile);

  for (const da of dayAssignments) {
    yield {
      type: 'day_areas',
      dayNumber: da.dayNumber,
      areas: da.areas.map(a => a.areaNameKo),
    };
  }

  // ─── Step 2: 고유 군집 추출 + AI 추천 (캐시로 중복 방지) ──────────────

  yield { type: 'progress', message: '🔍 장소 추천 요청 중...' };

  // region별 체류일 수 계산 (동적 추천/검증 수 결정)
  const regionDayCounts = new Map<string, number>();
  for (const rdm of regionDayMap) {
    regionDayCounts.set(rdm.region.id, (regionDayCounts.get(rdm.region.id) || 0) + 1);
  }

  // dayAssigner가 실제 배정한 areas만 수집 (미배정 area에 AI 호출 낭비 방지)
  const uniqueAreas = new Map<string, { area: Area; region: Region }>();
  for (const da of dayAssignments) {
    const rdm = regionDayMap.find(r => r.dayNumber === da.dayNumber);
    if (!rdm) continue;
    for (const area of da.areas) {
      if (!uniqueAreas.has(area.id)) {
        uniqueAreas.set(area.id, { area, region: rdm.region });
      }
    }
  }

  const placeCache = new Map<string, PlaceCandidate[]>(); // areaId → places
  const primaryTransport = dayContexts[0]?.transportMode || 'public';

  // ─── Area별 병렬 처리 (AI 호출 + filter + score + verify) ─────────────

  async function processArea(areaId: string, area: Area, region: Region): Promise<{
    areaId: string; areaName: string; allCount: number; filteredCount: number;
    verifiedCount: number; failedCount: number; passed: PlaceCandidate[]; cost: number;
  }> {
    const regionDays = regionDayCounts.get(region.id) || 1;
    const scale = placeScaleFactor(regionDays);
    let areaCost = 0;

    // Step 2: 카테고리별 병렬 AI 호출
    const categoryPromises = Object.entries(BASE_PLACES_PER_CATEGORY).map(async ([category, baseCount]) => {
      const count = Math.ceil(baseCount * scale);
      const { system, user } = buildPlaceRecommendationPrompt(
        area, category as PlaceCategory, count, profile, region,
      );
      try {
        const result = await callGeminiForPlaces(system, user);
        result.places.forEach(p => { p.areaId = areaId; });
        areaCost += result.usage.costUSD;
        return result.places;
      } catch (err) {
        console.warn(`[pipeline] AI 실패 (${area.areaNameKo}/${category}):`, (err as Error).message);
        return [];
      }
    });

    const categoryResults = await Promise.all(categoryPromises);
    const allPlaces = categoryResults.flat();

    // Step 3: Hard Filter
    const filtered = applyDayIndependentFilters(allPlaces, profile, area, primaryTransport);

    // Step 4: 경량 정렬
    const lightScored = filtered.map(p => ({
      ...p,
      nodeScore: lightScore(p, profile.interests),
    }));
    lightScored.sort((a, b) => (b.nodeScore ?? 0) - (a.nodeScore ?? 0));

    // Step 5: 검증
    const verifyN = Math.ceil(BASE_VERIFY_TOP_N * scale);
    const verifyResult = await verifyTopPlaces(
      lightScored, verifyN, tripInput.destination,
      false, // TODO: plan feature에서 usePlaces 결정
      area,
    );
    areaCost += verifyResult.costUSD;

    // Step 6: Post-Verify Filter
    const { passed } = postVerifyFilter(verifyResult.verified, area);

    return {
      areaId, areaName: area.areaNameKo,
      allCount: allPlaces.length, filteredCount: filtered.length,
      verifiedCount: passed.length, failedCount: verifyResult.failed.length,
      passed, cost: areaCost,
    };
  }

  // area별 병렬 실행 (각 area 내부에서 카테고리 4개도 병렬)
  const areaEntries = Array.from(uniqueAreas.entries());
  const areaResults = await Promise.all(
    areaEntries.map(([areaId, { area, region }]) => processArea(areaId, area, region))
  );

  // 결과 수집 + 이벤트 emit
  for (const r of areaResults) {
    placeCache.set(r.areaId, r.passed);
    totalCost += r.cost;
    yield { type: 'places_received', area: r.areaName, count: r.allCount };
    yield { type: 'filtered', before: r.allCount, after: r.filteredCount };
    yield { type: 'verified', verified: r.verifiedCount, failed: r.failedCount };
  }

  // ─── Step 7~9: Day별 장소 선택 + 동선 + 시간 ──────────────────────────

  yield { type: 'progress', message: '🗺️ 동선 최적화 중...' };

  const allScheduled: ScheduledPlace[] = [];
  const usedPlaceNames = new Set<string>(); // cross-day 중복 방지

  for (const da of dayAssignments) {
    const dayCtx = dayContexts[da.dayNumber - 1];
    if (!dayCtx) continue;

    // Step 7: 장소 선택
    // forcedPlaces 처리는 Phase 4 B분기에서 구현 (현재 빈 배열)
    // 구현 시: forcedPlaces.filter(fp => fp.dayNumber === dayCtx.dayNumber) → 스코어링 없이 선배정
    let dayPlaces = assignPlacesToDay(
      placeCache, da.areas, dayCtx, profile, placeCache, usedPlaceNames,
    );

    // Step 7.5: 풀 부족 시 솔직하게 알림 (인접 region 보충 안 함)
    // 이유: region 분리의 근거가 "별도 숙소"이므로, 다른 region 장소는 수십~수백 km 떨어져 비현실적.
    // 거리 체크를 해도 먼 region이면 전부 걸러져서 보충 효과 0.
    const stamina = (profile.stamina || 'moderate') as keyof typeof ITEMS_PER_DAY;
    const minItems = (ITEMS_PER_DAY[stamina] || ITEMS_PER_DAY.moderate).min;
    if (dayPlaces.length < minItems) {
      yield {
        type: 'pool_insufficient',
        dayNumber: da.dayNumber,
        available: dayPlaces.length,
        minimum: minItems,
      };
    }

    // Step 8: 동선 최적화
    const optimized = optimizeDayRoute(dayPlaces, dayCtx, profile);

    // Step 9: 시간 계산
    const scheduled = await calculateTimes(
      optimized,
      dayCtx,
      (profile.morningType || 'moderate') as 'early' | 'moderate' | 'late',
    );

    allScheduled.push(...scheduled);

    // cross-day 중복 방지: 이번 Day에서 사용된 장소 이름 누적
    for (const sp of scheduled) {
      usedPlaceNames.add(sp.placeNameSnapshot);
    }

    yield {
      type: 'day_schedule',
      dayNumber: da.dayNumber,
      places: scheduled.map(s => `${s.startTime} ${s.placeNameSnapshot}`),
    };
  }

  // ─── Step 10: TripItem 변환 ─────────────────────────────────────────────

  yield { type: 'progress', message: '💾 일정 생성 완료!' };

  const currency = regionDayMap[0]?.region.currencyCode || 'JPY';
  const items = toTripItems(allScheduled, '', currency);

  yield { type: 'complete', items };
}

