/**
 * v4 2차 군집 Day 배정 (Multi-Region)
 *
 * regionDayMap에서 Day별 region/areas가 이미 확정됨.
 * 이 함수는 해당 Day의 region 소속 areas 중에서 메인/보조 군집을 배정.
 *
 * 3-pass:
 *   Pass 1: forced 배정
 *   Pass 2: 메인 군집 (중간 Day는 중복 제외, 도착/출발일은 면제)
 *   Pass 3: 보조 군집 (가용시간 6h+ Day, areas 3개 이상인 경우만)
 *
 * 작은 region 분기: areas < 3이면 전부 메인으로 배정.
 */

import type { Area, DayContext, PlannerUserProfile, RegionDayAssignment } from './types';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';
import { FATIGUE_SLOPES, DAY_ASSIGNER_WEIGHTS, SUB_AREA_SCORE_THRESHOLD, SUB_AREA_MIN_HOURS } from './weights';

export interface DayAreaAssignment {
  dayNumber: number;
  areas: Area[];
}

export function assignAreasToDays(
  regionDayMap: RegionDayAssignment[],
  dayContexts: DayContext[],
  userProfile: PlannerUserProfile,
): DayAreaAssignment[] {
  const totalDays = dayContexts.length;
  const assignments: DayAreaAssignment[] = dayContexts.map(dc => ({
    dayNumber: dc.dayNumber,
    areas: [],
  }));

  // Day별로 독립 처리 (각 Day는 해당 region의 areas에서만 선택)
  for (let i = 0; i < dayContexts.length; i++) {
    const dc = dayContexts[i];
    const rdm = regionDayMap.find(r => r.dayNumber === dc.dayNumber);
    if (!rdm) continue;

    const dayAreas = rdm.areas;

    // 작은 region (areas < 3): 전부 배정, 메인/보조 구분 무의미
    if (dayAreas.length < 3) {
      assignments[i].areas = [...dayAreas];
      continue;
    }

    // ─── Pass 1: forced ─────────────────────────────────────────
    if (dc.forcedRegionId) {
      const forced = dayAreas.filter(a => a.id === dc.forcedRegionId);
      assignments[i].areas.push(...forced);
    }
    for (const fp of dc.forcedPlaces) {
      if (fp.clusterId) {
        const area = dayAreas.find(a => a.id === fp.clusterId);
        if (area && !assignments[i].areas.some(a => a.id === area.id)) {
          assignments[i].areas.push(area);
        }
      }
    }

    if (assignments[i].areas.length > 0) continue;

    // ─── Pass 2: 메인 군집 ──────────────────────────────────────
    const isMidDay = !dc.isArrivalDay && !dc.isDepartureDay;

    // 이전 Day에서 이미 메인으로 사용된 area (같은 region 내에서의 중복만 추적)
    const usedInPrevDays = new Set<string>();
    if (isMidDay) {
      for (let j = 0; j < i; j++) {
        const prevRdm = regionDayMap.find(r => r.dayNumber === j + 1);
        // 같은 region일 때만 중복 추적
        if (prevRdm?.region.id === rdm.region.id) {
          for (const a of assignments[j].areas) {
            usedInPrevDays.add(a.id);
          }
        }
      }
    }

    const scored = dayAreas
      .filter(a => !(isMidDay && usedInPrevDays.has(a.id)))
      .map(area => ({
        area,
        score: scoreAreaForDay(area, dc, userProfile, totalDays, usedInPrevDays),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      assignments[i].areas.push(scored[0].area);
    }

    // ─── Pass 3: 보조 군집 (가용시간 충분 + 점수가 의미 있을 때만) ────
    // 설계서: "Day당 1~2개 군집 배정 (availableHours 기반)"
    // 1개가 기본, 가용시간과 점수에 따라 추가. 강제 아님.
    const availableHours = dc.availableHours.end - dc.availableHours.start;
    const mainScore = scored[0]?.score ?? 0;
    if (availableHours >= SUB_AREA_MIN_HOURS && assignments[i].areas.length < 2) {
      const mainId = assignments[i].areas[0]?.id;
      const subCandidates = scored.filter(s => s.area.id !== mainId);
      if (subCandidates.length > 0 && mainScore > 0 && subCandidates[0].score >= mainScore * SUB_AREA_SCORE_THRESHOLD) {
        assignments[i].areas.push(subCandidates[0].area);
      }
    }

    // fallback: scored가 전부 중복 제외됐으면 중복이라도 배정
    if (assignments[i].areas.length === 0 && dayAreas.length > 0) {
      assignments[i].areas.push(dayAreas[0]);
    }
  }

  return assignments;
}

// ─── 스코어링 ───────────────────────────────────────────────────────────────

function scoreAreaForDay(
  area: Area,
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
  totalDays: number,
  usedInPrevDays: Set<string>,
): number {
  const W = DAY_ASSIGNER_WEIGHTS;
  let score = 0;

  // 1. 숙소 거리
  if (dayContext.accommodation) {
    const dist = haversineKm(
      dayContext.accommodation.lat, dayContext.accommodation.lon,
      area.centerLat, area.centerLon,
    );
    score += W.accommodationDistance * Math.max(0, 1 - dist / 30);
  } else {
    score += W.accommodationDistance * 0.5;
  }

  // 2. 관심사 매칭 (interests만. wishedActivities는 별개 — Phase 4 B분기에서 AI로 처리)
  const allUserTags = new Set(userProfile.interests.map(t => t.toLowerCase()));
  const areaTags = new Set(area.interestTags.map(t => t.toLowerCase()));
  let intersection = 0;
  for (const t of allUserTags) { if (areaTags.has(t)) intersection++; }
  const union = new Set([...allUserTags, ...areaTags]).size;
  score += W.interestMatch * (union > 0 ? intersection / union : 0);

  // 3. 시간대 적합 + nightComfort
  const { start, end } = dayContext.availableHours;
  let timeFit = 0;
  if (start < 12) timeFit += area.timeProfile.morning;
  if (start < 15 && end > 12) timeFit += area.timeProfile.afternoon;
  if (end > 18) timeFit += area.timeProfile.evening;
  if (end > 21) timeFit += area.timeProfile.night * (userProfile.nightComfort ?? 0.5);
  score += W.timeFit * Math.min(1, timeFit / 2.5);

  // 4. 피로도
  const fatigue = fatiguePenalty(
    dayContext.accommodation || { lat: area.centerLat, lon: area.centerLon },
    area, dayContext.dayNumber, totalDays,
    userProfile.stamina,
  );
  score -= W.fatigue * fatigue;

  // 5. 중복 패널티 (같은 region 내에서의 이전 Day 사용)
  if (usedInPrevDays.has(area.id)) {
    score -= W.repeatPenalty * 0.8;
  }

  // 6. 이동수단 × 접근성
  const mode = dayContext.transportMode;
  if (mode === 'public' && area.transportAccessibility < 0.3) {
    score -= W.transportFit * (1 - area.transportAccessibility);
  } else if (mode === 'car' && area.parking && !area.parking.available) {
    score -= W.transportFit * 0.5;
  } else {
    score += W.transportFit * area.transportAccessibility;
  }

  // 7. 휴무 영향
  const dayKey = dayContext.dayOfWeek.toLowerCase();
  const closedDaysObj = area.typicalClosedDays as Record<string, number>;
  if (closedDaysObj && typeof closedDaysObj === 'object') {
    for (const [key, ratio] of Object.entries(closedDaysObj)) {
      if (dayKey.includes(key.toLowerCase()) && typeof ratio === 'number') {
        score -= W.closedDayPenalty * ratio;
      }
    }
  }

  return score;
}

export function fatiguePenalty(
  accommodation: { lat: number; lon: number },
  area: Area,
  dayNumber: number,
  totalDays: number,
  stamina: string,
): number {
  const dist = haversineKm(accommodation.lat, accommodation.lon, area.centerLat, area.centerLon);
  const travelBurden = Math.min(1, (dist * 2) / 50);
  const dayRatio = totalDays > 1 ? (dayNumber - 1) / (totalDays - 1) : 0;
  const slope = FATIGUE_SLOPES[stamina as keyof typeof FATIGUE_SLOPES] ?? 0.6;
  return travelBurden * dayRatio * slope;
}
