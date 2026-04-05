/**
 * AI 응답 → TripItem 변환 유틸리티.
 *
 * v2 (AIGeneratedItem) 및 v3 (AssignedItem) 양쪽에서 사용.
 * Gemini의 clamping 로직을 모든 provider에 동일 적용.
 */

import type { TripItem } from '@/types/database';
import type { AIGeneratedItem } from '../types';
import type { AssignedItem } from '../v3/types';
import { filterByStamina } from '../parseResponse';
import { toHHMM, toMinutes } from '../itineraryValidation';
import { generateId } from '@/utils/id';

/**
 * v2용: AIGeneratedItem[] → TripItem[] 변환 (stamina 필터 + 필드 clamping)
 */
export function toTripItems(rawItems: AIGeneratedItem[], stamina: string): TripItem[] {
  const items = filterByStamina(rawItems, stamina as 'high' | 'moderate' | 'low');
  return items.map((item: AIGeneratedItem) => ({
    id: generateId('item'),
    tripId: '',
    placeId: '',
    createdAt: new Date().toISOString(),
    ...item,
    // 필드 clamping — AI가 비정상 값 반환해도 안전하게 보정
    startTime: toHHMM(toMinutes(item.startTime || '09:00')),
    endTime: toHHMM(toMinutes(item.endTime || '10:00')),
    estimatedCost: Math.max(0, item.estimatedCost ?? 0),
    dayNumber: Math.max(1, item.dayNumber ?? 1),
    orderIndex: Math.max(0, item.orderIndex ?? 0),
    transitDurationMin: item.transitDurationMin != null
      ? Math.min(480, Math.max(0, item.transitDurationMin))
      : null,
    latitude: item.latitude != null && Math.abs(item.latitude) <= 90 ? item.latitude : null,
    longitude: item.longitude != null && Math.abs(item.longitude) <= 180 ? item.longitude : null,
    reasonTags: item.reasonTags || [],
    verified: item.verified ?? true,
    googlePlaceId: item.googlePlaceId ?? null,
    subActivities: null,
  }));
}

/**
 * v3용: AssignedItem → TripItem 변환 (이미 slotAssigner + timeCalculator에서 정규화됨)
 */
export function toTripItem(item: AssignedItem): TripItem {
  return {
    id: generateId('item'),
    tripId: '',
    placeId: '',
    createdAt: new Date().toISOString(),
    dayNumber: item.dayNumber,
    orderIndex: item.orderIndex,
    placeNameSnapshot: item.placeNameSnapshot,
    category: item.category,
    startTime: item.startTime,
    endTime: item.endTime,
    estimatedCost: Math.max(0, item.estimatedCost || 0),
    currency: item.currency,
    priceConfidence: item.priceConfidence,
    notes: item.notes,
    latitude: item.latitude,
    longitude: item.longitude,
    activityLevel: item.activityLevel,
    reasonTags: item.reasonTags || [],
    address: item.address,
    businessHours: item.businessHours,
    closedDays: item.closedDays,
    transitMode: item.transitMode,
    transitDurationMin: item.transitDurationMin,
    transitSummary: item.transitSummary,
    verified: item.verified,
    googlePlaceId: item.googlePlaceId,
    subActivities: null,
  } as TripItem;
}
