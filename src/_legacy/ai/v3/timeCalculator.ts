/**
 * v3 시간 계산기 — 결정적 (코드가 모든 시간을 계산)
 *
 * 입력: 정렬된 하루 아이템 + 좌표
 * 출력: startTime, endTime, transitMode, transitDurationMin, transitSummary
 */

import type { EnrichedPlace, AssignedItem, V3Config } from './types';
import { haversineKm, toHHMM } from '../itineraryValidation';

// ---------------------------------------------------------------------------
// 이동수단 결정 (결정적)
// ---------------------------------------------------------------------------

function pickTransitMode(distanceKm: number, isRentalCar: boolean): string {
  if (isRentalCar) {
    return distanceKm <= 0.5 ? 'walk' : 'drive';
  }
  if (distanceKm <= 1.5) return 'walk';
  if (distanceKm <= 10) return 'subway';
  return 'taxi';
}

function estimateTransitMinutes(distanceKm: number, mode: string): number {
  const roadKm = distanceKm * 1.4; // 직선거리 → 실제 도로 보정
  switch (mode) {
    case 'walk': return Math.ceil(roadKm / 0.083);     // 5km/h
    case 'subway': return Math.ceil(roadKm / 0.5) + 10; // 30km/h + 대기
    case 'drive': return Math.ceil(roadKm / 0.7);       // 42km/h 시내 평균
    case 'taxi': return Math.ceil(roadKm / 0.7);        // taxi ≈ drive
    case 'bus': return Math.ceil(roadKm / 0.33) + 10;   // 20km/h + 대기
    default: return Math.ceil(roadKm / 0.5);            // 기본 30km/h
  }
}

function transitSummaryKo(mode: string, minutes: number): string {
  const modeMap: Record<string, string> = {
    walk: '도보', subway: '지하철', drive: '차량', taxi: '택시', bus: '버스',
  };
  return `${modeMap[mode] || mode} ${minutes}분`;
}

// ---------------------------------------------------------------------------
// 하루 시작 시간 결정
// ---------------------------------------------------------------------------

function getDayStartMinutes(dayNumber: number, config: V3Config): number {
  if (dayNumber === 1) {
    switch (config.arrivalTime) {
      case 'morning': return 10 * 60;      // 10:00
      case 'afternoon': return 14 * 60;    // 14:00
      case 'evening': return 17 * 60 + 30; // 17:30
      default: return 10 * 60;
    }
  }
  switch (config.morningType) {
    case 'early': return 7 * 60;      // 07:00 (범위 06:00-08:00의 중간)
    case 'moderate': return 9 * 60;   // 09:00 (범위 08:00-10:00의 중간)
    case 'late': return 10 * 60 + 30; // 10:30 (범위 10:00-11:00의 중간)
    default: return 9 * 60;
  }
}

// ---------------------------------------------------------------------------
// activityLevel 자동 매핑
// ---------------------------------------------------------------------------

function mapActivityLevel(durationMin: number): 'light' | 'moderate' | 'intense' {
  if (durationMin <= 45) return 'light';
  if (durationMin <= 120) return 'moderate';
  return 'intense';
}

// ---------------------------------------------------------------------------
// 메인: 시간 계산
// ---------------------------------------------------------------------------

/**
 * 정렬된 하루 아이템에 startTime/endTime/transit 정보를 계산한다.
 *
 * @param items - slotAssigner가 정렬한 하루 아이템
 * @param dayNumber - 날짜 번호
 * @param config - 파이프라인 설정
 * @returns AssignedItem[] (TripItem으로 변환 가능한 완전한 데이터)
 */
export function calculateTimes(
  items: EnrichedPlace[],
  dayNumber: number,
  config: V3Config,
): AssignedItem[] {
  const startMinutes = getDayStartMinutes(dayNumber, config);
  let currentTime = startMinutes;
  const result: AssignedItem[] = [];

  // 하루 종료 시간 (23:30) — 이 이후로는 배정하지 않음
  const dayEndLimit = 23 * 60 + 30;

  for (let i = 0; i < items.length; i++) {
    const place = items[i];
    let transitMode: string | null = null;
    let transitMin: number | null = null;
    let transitSummary: string | null = null;

    // 첫 아이템이 아니면 이동시간 계산
    if (i > 0) {
      const prev = items[i - 1];

      if (prev.latitude != null && prev.longitude != null &&
          place.latitude != null && place.longitude != null) {
        // 좌표가 있으면 실제 거리 기반 계산
        const dist = haversineKm(prev.latitude, prev.longitude, place.latitude, place.longitude);
        transitMode = pickTransitMode(dist, config.isRentalCar);
        transitMin = Math.min(estimateTransitMinutes(dist, transitMode), 480);
        transitSummary = transitSummaryKo(transitMode, transitMin);
      } else {
        // 좌표 없으면 기본값
        transitMode = config.isRentalCar ? 'drive' : null;
        transitMin = place.mealSlot !== 'none' ? 15 : 20; // 식사는 가까이, 관광은 조금 멂
        transitSummary = transitMin > 0 ? `이동 약 ${transitMin}분` : null;
      }

      currentTime += transitMin;
    }

    // 식사 시간 강제 제거 — 사용자 의도 존중
    // sortDayItems()가 [오전→점심→오후→저녁→야간] 순서로 정렬하므로
    // 점심은 오전 관광 후, 저녁은 오후 관광 후에 자연스럽게 배치됨
    // 사용자가 "22시 저녁" 요청하면 AI가 해당 시간에 배치 → 코드가 덮어쓰지 않음

    // 시간 범위 클램프 (00:00 ~ 23:59)
    currentTime = Math.max(0, Math.min(currentTime, dayEndLimit));

    const duration = Math.max(30, Math.min(place.estimatedDurationMinutes || 60, 300));
    const endTime = Math.min(currentTime + duration, 1439);

    const assigned: AssignedItem = {
      ...place,
      dayNumber,
      orderIndex: i,
      startTime: toHHMM(currentTime),
      endTime: toHHMM(endTime),
      transitMode: i === 0 ? null : transitMode,
      transitDurationMin: i === 0 ? null : transitMin,
      transitSummary: i === 0 ? null : transitSummary,
      activityLevel: mapActivityLevel(duration),
      currency: config.currency,
      priceConfidence: place.verified ? 'confirmed' : 'estimated',
    };

    result.push(assigned);
    currentTime = endTime;

    // 하루 종료 시간 체크 — 식사는 절대 버리지 않음
    if (currentTime >= dayEndLimit) {
      // 남은 아이템 중 식사가 있으면 강제 포함
      const lastEndTime = result.length > 0 ? Math.max(...result.map(r => {
        const [h, m] = r.endTime.split(':').map(Number);
        return h * 60 + m;
      })) : currentTime;

      for (let j = i + 1; j < items.length; j++) {
        const remaining = items[j];
        if (remaining.mealSlot === 'lunch' || remaining.mealSlot === 'dinner') {
          const mealDuration = 30;
          // 이전 아이템 endTime 이후에 배치 (겹침 방지)
          const mealStart = Math.max(lastEndTime + 1, Math.min(currentTime, 1409));
          result.push({
            ...remaining,
            dayNumber,
            orderIndex: result.length,
            startTime: toHHMM(mealStart),
            endTime: toHHMM(Math.min(mealStart + mealDuration, 1439)),
            transitMode: null,
            transitDurationMin: null,
            transitSummary: null,
            activityLevel: 'light',
            currency: config.currency,
            priceConfidence: 'estimated',
          });
          console.log(`[TimeCalc] Day${dayNumber}: 시간 초과지만 식사 "${remaining.placeNameSnapshot}" 강제 포함`);
        }
      }
      break;
    }
  }

  return result;
}
