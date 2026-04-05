/**
 * v4 Day별 컨텍스트 생성
 *
 * 사용자 입력(숙소, 이동수단, 도착/출발 시간, 예약)에서
 * Day별 제약조건 배열(DayContext[])을 생성.
 */

import type { DayContext, ForcedPlace } from './types';

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

const ARRIVAL_START_HOUR: Record<string, number> = {
  morning: 10,
  afternoon: 14,
  evening: 18,
};

export interface DayContextInput {
  startDate: string;       // "2026-05-01"
  endDate: string;         // "2026-05-04"
  accommodations: { dayRange: [number, number]; lat: number; lon: number; name: string }[];
  transportModes: { dayRange: [number, number]; mode: 'public' | 'car' | 'taxi' | 'mixed' }[];
  arrivalTime: 'morning' | 'afternoon' | 'evening';
  departureTime: string;   // "15:00"
  forcedPlaces: { dayNumber: number; placeName: string; startTime: string; durationMin: number; clusterId?: string }[];
  forcedRegions: { dayNumber: number; regionId: string }[];
}

export function buildDayContexts(input: DayContextInput): DayContext[] {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (totalDays <= 0) return [];

  const contexts: DayContext[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d - 1);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfWeek = DAY_NAMES_KO[date.getDay()];

    const isArrivalDay = d === 1;
    const isDepartureDay = d === totalDays;

    // 가용 시간
    let startHour = 9; // 기본
    let endHour = 22;  // 기본

    if (isArrivalDay) {
      startHour = ARRIVAL_START_HOUR[input.arrivalTime] || 14;
    }
    if (isDepartureDay) {
      const [depH] = input.departureTime.split(':').map(Number);
      endHour = Math.max(8, (depH || 15) - 2); // 출발 2시간 전
    }

    // 숙소 매칭
    const accom = input.accommodations.find(
      a => d >= a.dayRange[0] && d <= a.dayRange[1]
    );

    // 이동수단 매칭
    const transport = input.transportModes.find(
      t => d >= t.dayRange[0] && d <= t.dayRange[1]
    );

    // 예약 장소
    const forced: ForcedPlace[] = input.forcedPlaces
      .filter(fp => fp.dayNumber === d)
      .map(fp => ({
        placeName: fp.placeName,
        startTime: fp.startTime,
        estimatedDurationMin: fp.durationMin,
        clusterId: fp.clusterId,
      }));

    // 강제 지역
    const forcedRegion = input.forcedRegions.find(fr => fr.dayNumber === d);

    contexts.push({
      dayNumber: d,
      date: dateStr,
      dayOfWeek,
      accommodation: accom ? { lat: accom.lat, lon: accom.lon, name: accom.name } : null,
      transportMode: transport?.mode || 'public',
      availableHours: { start: startHour, end: endHour },
      isArrivalDay,
      isDepartureDay,
      forcedRegionId: forcedRegion?.regionId || null,
      forcedPlaces: forced,
    });
  }

  return contexts;
}

// ─── 2단계: Region 전환일 가용시간 보정 ──────────────────────────────────────

import type { RegionDayAssignment, RegionTravelTime } from './types';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';

/**
 * regionDayMap 확정 후, 전환일의 availableHours.start를 이동 시간만큼 늦춘다.
 * 기존 buildDayContexts()의 결과를 사후 보정.
 *
 * 예: Day 3→4 후쿠오카→벳푸 (150분) → Day 4의 start 09:00 → 11:30
 */
export function adjustForRegionTransit(
  dayContexts: DayContext[],
  regionDayMap: RegionDayAssignment[],
  travelTimes: RegionTravelTime[],
): DayContext[] {
  const adjusted = dayContexts.map(dc => ({ ...dc })); // shallow copy

  for (let i = 1; i < adjusted.length; i++) {
    const prevRegion = regionDayMap.find(r => r.dayNumber === i)?.region;
    const currRegion = regionDayMap.find(r => r.dayNumber === i + 1)?.region;

    if (!prevRegion || !currRegion) continue;
    if (prevRegion.id === currRegion.id) continue; // 같은 region이면 전환 아님

    // 이동 시간 조회 (DB → 역방향 → haversine fallback)
    const travelMin = findTravelTime(prevRegion, currRegion, travelTimes);

    const travelHours = travelMin / 60;
    adjusted[i].availableHours = {
      ...adjusted[i].availableHours,
      start: Math.min(adjusted[i].availableHours.start + travelHours, adjusted[i].availableHours.end - 2),
    };
    adjusted[i].isTransitDay = true;
    adjusted[i].transitFromRegion = prevRegion.regionNameKo;
    adjusted[i].transitDurationMin = travelMin;
  }

  return adjusted;
}

/**
 * region 간 이동 시간 조회.
 * 1. DB 정확 매칭
 * 2. 역방향 (A→B 없으면 B→A)
 * 3. haversine × 1.5 fallback
 */
function findTravelTime(
  from: { id: string; centerLat: number; centerLon: number },
  to: { id: string; centerLat: number; centerLon: number },
  travelTimes: RegionTravelTime[],
): number {
  // 정확 매칭
  const exact = travelTimes.find(t => t.fromRegionId === from.id && t.toRegionId === to.id);
  if (exact) return exact.durationMinutes;

  // 역방향
  const reverse = travelTimes.find(t => t.fromRegionId === to.id && t.toRegionId === from.id);
  if (reverse) return reverse.durationMinutes;

  // haversine fallback (직선거리 km × 1.5 ≈ 분)
  const km = haversineKm(from.centerLat, from.centerLon, to.centerLat, to.centerLon);
  return Math.round(km * 1.5);
}
