/**
 * v4 시간 계산
 *
 * 최적화된 순서에 startTime/endTime/transit 정보 부여.
 * OSRM 우선, 실패 시 haversine fallback.
 */

import type { PlaceCandidate, DayContext, ScheduledPlace } from './types';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';

const MORNING_START: Record<string, number> = {
  early: 7 * 60,      // 07:00
  moderate: 9 * 60,   // 09:00
  late: 10 * 60 + 30, // 10:30
};

// OSRM 성공률 추적 (디버그/판단용)
let osrmSuccess = 0;
let osrmFailed = 0;
let osrmFallback = 0;

export function getOsrmStats() {
  return { success: osrmSuccess, failed: osrmFailed, fallback: osrmFallback };
}

export function resetOsrmStats() {
  osrmSuccess = 0;
  osrmFailed = 0;
  osrmFallback = 0;
}

/**
 * 순서가 결정된 장소 배열에 시간 정보 부여.
 * async — OSRM 호출이 비동기.
 */
export async function calculateTimes(
  orderedPlaces: PlaceCandidate[],
  dayContext: DayContext,
  morningType: 'early' | 'moderate' | 'late',
): Promise<ScheduledPlace[]> {
  if (orderedPlaces.length === 0) return [];

  // 도착일/전환일은 availableHours.start 사용 (이동 시간 반영됨)
  // 일반 Day는 morningType 기반
  const startMin = (dayContext.isArrivalDay || dayContext.isTransitDay)
    ? dayContext.availableHours.start * 60
    : MORNING_START[morningType] || MORNING_START.moderate;

  let currentMin = startMin;
  const endMin = dayContext.availableHours.end * 60;
  const results: ScheduledPlace[] = [];

  for (let i = 0; i < orderedPlaces.length; i++) {
    const place = orderedPlaces[i];

    // 이동시간 계산 (첫 장소는 0)
    let transitMin = 0;
    let transitMode = 'walk';
    let transitSummary: string | null = null;

    if (i > 0) {
      const prev = orderedPlaces[i - 1];
      const transit = await estimateTransitTime(
        prev.latitude != null ? { lat: prev.latitude, lon: prev.longitude! } : null,
        place.latitude != null ? { lat: place.latitude, lon: place.longitude! } : null,
        dayContext.transportMode === 'car' ? 'car' : 'public',
      );
      transitMin = transit.durationMin;
      transitMode = transit.mode;
      transitSummary = `${transit.distanceKm.toFixed(1)}km, ${transitMin}분 (${transitMode})`;
    }

    currentMin += transitMin;

    // 식사 시간대 보정
    if (place.mealSlot === 'lunch' && currentMin < 11 * 60) {
      currentMin = 11 * 60; // 11시 이전이면 11시로 밀기
    }
    if (place.mealSlot === 'dinner') {
      // dinner는 17시 이후가 이상적이지만, 무조건 17시로 점프하면 오후가 통째로 비어버림.
      // 현재 시간이 15시 이후면 그대로 배치 (충분히 저녁 시간대).
      // 현재 시간이 15시 이전이면 최소 17시로 밀되, 다음에 비식사 장소가 있으면 밀지 않음.
      if (currentMin < 15 * 60) {
        // 아직 오후 초반 — dinner 뒤에 비식사 장소가 더 있는지 확인
        const hasMoreNonMeal = orderedPlaces.slice(i + 1).some(p => p.mealSlot === 'none' || p.mealSlot === 'snack');
        if (!hasMoreNonMeal) {
          // dinner가 마지막 식사이고 뒤에 관광 없음 → 17시로 밀기
          currentMin = 17 * 60;
        }
        // 뒤에 비식사 장소가 있으면 밀지 않음 → 오후 장소가 dinner 앞에 끼어들 수 있음
      }
      // 15시 이후면 그대로 배치
    }

    // 가용 시간 초과 체크
    if (currentMin >= endMin) break;

    const startTime = toHHMM(currentMin);
    const duration = place.estimatedDurationMinutes || 60;
    currentMin += duration;
    const endTime = toHHMM(Math.min(currentMin, endMin));

    results.push({
      ...place,
      startTime,
      endTime,
      transitMode,
      transitDurationMin: transitMin,
      transitSummary,
      dayNumber: dayContext.dayNumber,
      orderIndex: i,
    });
  }

  return results;
}

/**
 * 이동시간 추정.
 * OSRM 우선 시도 → 실패 시 haversine × 보정계수 fallback.
 */
export async function estimateTransitTime(
  from: { lat: number; lon: number } | null,
  to: { lat: number; lon: number } | null,
  preferredMode: 'walk' | 'public' | 'car' | 'taxi',
): Promise<{ durationMin: number; distanceKm: number; mode: string }> {
  if (!from || !to) {
    return { durationMin: 10, distanceKm: 0, mode: 'walk' }; // 좌표 없으면 기본 10분
  }

  const distKm = haversineKm(from.lat, from.lon, to.lat, to.lon);

  // 이동수단 자동 결정
  let mode = preferredMode;
  if (distKm <= 0.5) mode = 'walk';
  else if (distKm <= 1.5 && mode !== 'car') mode = 'walk';
  else if (distKm > 10 && mode === 'walk') mode = 'public';

  // OSRM 시도
  try {
    const { getRoute } = await import('@/lib/services/osrm.service');
    const result = await getRoute(
      { lat: from.lat, lng: from.lon },
      { lat: to.lat, lng: to.lon },
      mode === 'car',
    );
    osrmSuccess++;
    return {
      durationMin: Math.round(result.durationMinutes),
      distanceKm: result.distanceKm,
      mode: result.mode === 'drive' ? (mode === 'car' ? 'car' : 'taxi') : 'walk',
    };
  } catch {
    osrmFailed++;
    osrmFallback++;
  }

  // Fallback: haversine × 보정계수
  const speedKmH: Record<string, number> = {
    walk: 5,
    public: 25,
    car: 40,
    taxi: 35,
  };
  const speed = speedKmH[mode] || 20;
  const durationMin = Math.round((distKm / speed) * 60);
  const bufferMin = mode === 'public' ? 10 : mode === 'walk' ? 0 : 5;

  return {
    durationMin: durationMin + bufferMin,
    distanceKm: distKm,
    mode,
  };
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function toHHMM(minutes: number): string {
  const h = Math.floor(Math.max(0, Math.min(minutes, 23 * 60 + 59)) / 60);
  const m = Math.round(Math.max(0, minutes) % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
