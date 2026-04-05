/**
 * v3 식사 보장 — 점심/저녁 부족 시 AI에 보충 요청
 *
 * v2의 augmentMissingMeals("현지 저녁 식당 Day3") 대신
 * AI에게 실제 식당 이름을 추천받는다.
 */

import type { AIPlaceRecommendation } from './types';

export interface MealShortage {
  lunch: number;   // 부족한 점심 수
  dinner: number;  // 부족한 저녁 수
}

/**
 * 식사 수량 부족 여부 확인
 */
export function checkMealShortage(
  places: AIPlaceRecommendation[],
  totalDays: number,
  arrivalTime: string,
): MealShortage {
  const lunches = places.filter(p =>
    p.mealSlot === 'lunch' && (p.category === 'restaurant' || p.category === 'cafe'),
  ).length;

  const dinners = places.filter(p =>
    p.mealSlot === 'dinner' && (p.category === 'restaurant' || p.category === 'cafe'),
  ).length;

  // Day 1 evening 도착이면 점심 1개 덜 필요
  const requiredLunches = arrivalTime === 'evening' ? totalDays - 1 : totalDays;
  // 마지막 날은 저녁 선택적이지만 일단 필수로 계산
  const requiredDinners = totalDays;

  return {
    lunch: Math.max(0, requiredLunches - lunches),
    dinner: Math.max(0, requiredDinners - dinners),
  };
}

/**
 * 보충된 식당을 기존 리스트에 병합
 */
export function mergeSupplement(
  existing: AIPlaceRecommendation[],
  supplement: AIPlaceRecommendation[],
): AIPlaceRecommendation[] {
  // 이름 중복 제거
  const existingNames = new Set(existing.map(p => p.placeNameSnapshot.toLowerCase()));
  const unique = supplement.filter(p => !existingNames.has(p.placeNameSnapshot.toLowerCase()));
  return [...existing, ...unique];
}
