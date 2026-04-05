/**
 * v4 ScheduledPlace → TripItem 변환
 *
 * v3 toTripItem()과 입력 타입이 다르므로 별도 작성.
 * ScheduledPlace에는 이미 시간/이동/좌표 정보가 포함되어 있음.
 */

import type { TripItem } from '@/types/database';
import type { ScheduledPlace } from './types';

let _idCounter = 0;
function generatePlannerId(): string {
  _idCounter++;
  return `v4-${Date.now()}-${_idCounter}`;
}

/** ScheduledPlace → TripItem 변환 (DB 저장 가능 형태) */
export function toTripItem(sp: ScheduledPlace, tripId: string, currency: string): TripItem {
  return {
    id: generatePlannerId(),
    tripId,
    dayNumber: sp.dayNumber,
    orderIndex: sp.orderIndex,
    placeId: '',
    placeNameSnapshot: sp.placeNameSnapshot,
    category: sp.category,
    startTime: sp.startTime,
    endTime: sp.endTime,
    estimatedCost: Math.max(0, sp.estimatedCost || 0),
    currency,
    priceConfidence: sp.verified ? 'confirmed' : 'estimated',
    notes: sp.reasonTags.join(', '),
    latitude: sp.latitude != null && Math.abs(sp.latitude) <= 90 ? sp.latitude : null,
    longitude: sp.longitude != null && Math.abs(sp.longitude) <= 180 ? sp.longitude : null,
    reasonTags: sp.reasonTags || [],
    address: sp.address,
    businessHours: sp.businessHours,
    closedDays: sp.closedDays,
    transitMode: sp.transitMode || null,
    transitDurationMin: sp.transitDurationMin || null,
    transitSummary: sp.transitSummary || null,
    verified: sp.verified,
    googlePlaceId: sp.googlePlaceId,
    subActivities: null,
    createdAt: new Date().toISOString(),
  };
}

/** ScheduledPlace[] → TripItem[] 일괄 변환 */
export function toTripItems(
  scheduled: ScheduledPlace[],
  tripId: string,
  currency: string,
): TripItem[] {
  return scheduled.map(sp => toTripItem(sp, tripId, currency));
}
