/**
 * v3 슬롯 배정 알고리즘 — 결정적 (코드가 모든 배치를 결정)
 *
 * 1. 휴무일 필터링
 * 2. 식사 슬롯 고정 (점심 12:00, 저녁 18:30)
 * 3. 관광지 배정 (timePreference 기반)
 * 4. 경로 최적화 (Greedy NN, 좌표 있는 경우)
 */

import type { EnrichedPlace, V3Config } from './types';
import { haversineKm } from '../itineraryValidation';

/** 하루 일정 */
interface DaySchedule {
  dayNumber: number;
  items: EnrichedPlace[];
}

/** 요일 한국어 매핑 */
const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 장소 리스트를 날짜별로 배정한다.
 */
export function assignSlots(
  places: EnrichedPlace[],
  config: V3Config,
): DaySchedule[] {
  const { totalDays, itemsPerDay, startDate, arrivalTime, stamina } = config;

  // Phase 0: mealSlot=none인 restaurant/cafe를 시간대 기반으로 자동 분류
  // AI가 mealSlot을 안 줘도 코드가 보장한다
  let lunchCount = places.filter(p => p.mealSlot === 'lunch').length;
  let dinnerCount = places.filter(p => p.mealSlot === 'dinner').length;

  for (const place of places) {
    if ((place.category === 'restaurant' || place.category === 'cafe') && place.mealSlot === 'none') {
      if (place.timePreference === 'morning' || place.timePreference === 'afternoon') {
        place.mealSlot = 'lunch';
      } else if (place.timePreference === 'evening') {
        place.mealSlot = 'dinner';
      } else {
        // anytime → 부족한 쪽에 할당
        if (lunchCount <= dinnerCount) {
          place.mealSlot = 'lunch';
          lunchCount++;
        } else {
          place.mealSlot = 'dinner';
          dinnerCount++;
        }
      }
    }
  }

  // Phase 1: 식사와 비식사 분리
  const lunches = places.filter(p => p.mealSlot === 'lunch' && (p.category === 'restaurant' || p.category === 'cafe'));
  const dinners = places.filter(p => p.mealSlot === 'dinner' && (p.category === 'restaurant' || p.category === 'cafe'));
  const others = places.filter(p => p.mealSlot !== 'lunch' && p.mealSlot !== 'dinner');

  console.log(`[SlotAssigner] 입력: ${places.length}개 (lunch: ${lunches.length}, dinner: ${dinners.length}, others: ${others.length})`);

  // Phase 2: 날짜별 요일 계산
  const dayOfWeek: string[] = [];
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    dayOfWeek.push(DAY_NAMES_KO[date.getDay()]);
  }

  // Phase 3: 휴무일 필터링 헬퍼
  function isOpenOnDay(place: EnrichedPlace, dayIndex: number): boolean {
    if (!place.closedDays) return true;
    const closed = place.closedDays.toLowerCase();
    if (closed.includes('연중무휴') || closed.includes('없음')) return true;
    const dow = dayOfWeek[dayIndex];
    return !closed.includes(dow + '요일');
  }

  // Phase 4: 날짜별 일정 구성
  const days: DaySchedule[] = [];
  const usedPlaces = new Set<string>();

  // stamina별 상한
  const maxItems: Record<string, number> = { low: 5, moderate: 7, high: 9 };
  const dayMax = maxItems[stamina] || 7;

  // Day 1 특수 처리
  const day1MaxItems = arrivalTime === 'evening' ? 3 : arrivalTime === 'afternoon' ? Math.ceil(dayMax * 0.6) : dayMax;

  for (let d = 0; d < totalDays; d++) {
    const dayNum = d + 1;
    const isDay1 = dayNum === 1;
    const currentMax = isDay1 ? day1MaxItems : dayMax;
    const dayItems: EnrichedPlace[] = [];

    // 식사 배정: 점심
    const skipLunch = isDay1 && arrivalTime === 'evening';
    if (!skipLunch) {
      let lunch = findBestMeal(lunches, d, usedPlaces, (p) => isOpenOnDay(p, d));
      // lunch 전용 식당이 없으면 아무 restaurant/cafe를 lunch로 전환
      if (!lunch) {
        // 1차: 영업일인 식당
        const openRestaurants = places.filter(p =>
          (p.category === 'restaurant' || p.category === 'cafe') &&
          !usedPlaces.has(p.placeNameSnapshot) && isOpenOnDay(p, d),
        );
        if (openRestaurants.length > 0) {
          lunch = { ...openRestaurants[0], mealSlot: 'lunch' as const };
        } else {
          // 2차: 휴무일 무시 (식사는 반드시 배정)
          const anyRestaurants = places.filter(p =>
            (p.category === 'restaurant' || p.category === 'cafe') &&
            !usedPlaces.has(p.placeNameSnapshot),
          );
          if (anyRestaurants.length > 0) {
            lunch = { ...anyRestaurants[0], mealSlot: 'lunch' as const };
          }
        }
      }
      if (lunch) {
        dayItems.push(lunch);
        usedPlaces.add(lunch.placeNameSnapshot);
        console.log(`[SlotAssigner] Day${dayNum} 점심: ${lunch.placeNameSnapshot}`);
      } else {
        console.warn(`[SlotAssigner] Day${dayNum} 점심 배정 실패! lunches=${lunches.length}, used=${usedPlaces.size}`);
      }
    }

    // 식사 배정: 저녁
    let dinner = findBestMeal(dinners, d, usedPlaces, (p) => isOpenOnDay(p, d));
    // dinner 전용 식당이 없으면 아무 restaurant를 dinner로 전환
    if (!dinner) {
      const openRestaurants = places.filter(p =>
        (p.category === 'restaurant' || p.category === 'cafe') &&
        !usedPlaces.has(p.placeNameSnapshot) && isOpenOnDay(p, d),
      );
      if (openRestaurants.length > 0) {
        dinner = { ...openRestaurants[0], mealSlot: 'dinner' as const };
      } else {
        // 휴무일 무시 (식사는 반드시 배정)
        const anyRestaurants = places.filter(p =>
          (p.category === 'restaurant' || p.category === 'cafe') &&
          !usedPlaces.has(p.placeNameSnapshot),
        );
        if (anyRestaurants.length > 0) {
          dinner = { ...anyRestaurants[0], mealSlot: 'dinner' as const };
        }
      }
    }
    if (dinner) {
      dayItems.push(dinner);
      usedPlaces.add(dinner.placeNameSnapshot);
      console.log(`[SlotAssigner] Day${dayNum} 저녁: ${dinner.placeNameSnapshot}`);
    } else {
      console.warn(`[SlotAssigner] Day${dayNum} 저녁 배정 실패! dinners=${dinners.length}, used=${usedPlaces.size}`);
    }

    // 관광지 배정: timePreference 기반
    const remaining = currentMax - dayItems.length;
    const timeBlocks = isDay1 && arrivalTime === 'evening'
      ? ['evening']
      : isDay1 && arrivalTime === 'afternoon'
        ? ['afternoon', 'evening']
        : ['morning', 'afternoon', 'evening'];

    const available = others.filter(p =>
      !usedPlaces.has(p.placeNameSnapshot) && isOpenOnDay(p, d),
    );

    let filled = 0;
    // 우선: timePreference가 현재 블록에 맞는 것
    for (const block of timeBlocks) {
      if (filled >= remaining) break;
      const matching = available.filter(p =>
        p.timePreference === block && !usedPlaces.has(p.placeNameSnapshot),
      );
      for (const place of matching) {
        if (filled >= remaining) break;
        dayItems.push(place);
        usedPlaces.add(place.placeNameSnapshot);
        filled++;
      }
    }

    // 부족하면: anytime으로 채움
    if (filled < remaining) {
      const anytime = available.filter(p =>
        p.timePreference === 'anytime' && !usedPlaces.has(p.placeNameSnapshot),
      );
      for (const place of anytime) {
        if (filled >= remaining) break;
        dayItems.push(place);
        usedPlaces.add(place.placeNameSnapshot);
        filled++;
      }
    }

    // 그래도 부족하면: 아무거나
    if (filled < remaining) {
      const any = available.filter(p => !usedPlaces.has(p.placeNameSnapshot));
      for (const place of any) {
        if (filled >= remaining) break;
        dayItems.push(place);
        usedPlaces.add(place.placeNameSnapshot);
        filled++;
      }
    }

    // Phase 5: 하루 내 정렬 (식사 슬롯 기준 + 경로 최적화)
    const sorted = sortDayItems(dayItems, config);

    days.push({ dayNumber: dayNum, items: sorted });
  }

  return days;
}

/**
 * 사용되지 않은 최적의 식사 장소를 찾는다.
 */
function findBestMeal(
  meals: EnrichedPlace[],
  dayIndex: number,
  used: Set<string>,
  isOpen: (p: EnrichedPlace) => boolean,
): EnrichedPlace | null {
  // 라운드로빈: dayIndex % available.length
  const available = meals.filter(m => !used.has(m.placeNameSnapshot) && isOpen(m));
  if (available.length === 0) return null;
  return available[dayIndex % available.length];
}

/**
 * 하루 내 아이템을 시간순으로 정렬한다.
 * 식사를 고정 슬롯에 배치하고, 나머지를 timePreference/경로로 정렬.
 */
function sortDayItems(items: EnrichedPlace[], config: V3Config): EnrichedPlace[] {
  const lunch = items.find(i => i.mealSlot === 'lunch');
  const dinner = items.find(i => i.mealSlot === 'dinner');
  const others = items.filter(i => i.mealSlot !== 'lunch' && i.mealSlot !== 'dinner');

  // timePreference 기반 정렬
  const order: Record<string, number> = { morning: 0, anytime: 1, afternoon: 2, evening: 3 };
  others.sort((a, b) => (order[a.timePreference] ?? 1) - (order[b.timePreference] ?? 1));

  // 오전 블록을 2개로 제한 (점심 전에 너무 많은 관광지 방지)
  const allMorning = others.filter(o => order[o.timePreference] <= 1);
  const morningBlock = allMorning.slice(0, 2);
  const overflowToAfternoon = allMorning.slice(2); // 오전에 못 넣은 건 오후로
  const afternoonBlock = [...overflowToAfternoon, ...others.filter(o => order[o.timePreference] >= 2)];

  const optimizedMorning = optimizeBlock(morningBlock);
  const optimizedAfternoon = optimizeBlock(afternoonBlock);

  // 조합: 오전 → 점심 → 오후(2~3개) → 저녁 → 야간 관광
  const maxBeforeDinner = Math.min(3, optimizedAfternoon.length);
  const beforeDinner = optimizedAfternoon.slice(0, maxBeforeDinner);
  const afterDinner = optimizedAfternoon.slice(maxBeforeDinner);

  const result: EnrichedPlace[] = [];
  result.push(...optimizedMorning);
  if (lunch) result.push(lunch);
  result.push(...beforeDinner);
  if (dinner) result.push(dinner);
  result.push(...afterDinner);

  // 3연속 같은 카테고리 방지 — 순서만 재배치 (장소 삭제 안 함)
  for (let i = 2; i < result.length; i++) {
    const a = result[i - 2].category;
    const b = result[i - 1].category;
    const c = result[i].category;
    if (a === b && b === c && a !== 'restaurant' && a !== 'cafe') {
      // 뒤에서 다른 카테고리 아이템 찾아서 교체
      for (let j = i + 1; j < result.length; j++) {
        if (result[j].category !== a) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }

  // 아이템 유실 검증
  if (result.length !== items.length) {
    console.error(`[SlotAssigner] 아이템 유실! 입력 ${items.length} → 출력 ${result.length}`);
    // 유실된 아이템 복구 — 결과에 없는 아이템을 끝에 추가
    for (const item of items) {
      if (!result.includes(item)) {
        result.push(item);
      }
    }
  }

  return result;
}

/**
 * 좌표 기반 Greedy Nearest Neighbor 최적화
 */
function optimizeBlock(items: EnrichedPlace[]): EnrichedPlace[] {
  if (items.length <= 1) return items;

  // 좌표가 있는 아이템만 최적화
  const withCoords = items.filter(i => i.latitude != null && i.longitude != null);
  const withoutCoords = items.filter(i => i.latitude == null || i.longitude == null);

  if (withCoords.length <= 1) return items;

  const ordered: EnrichedPlace[] = [];
  const remaining = [...withCoords];

  // 첫 아이템부터 시작, 가장 가까운 다음 아이템 선택
  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(
        current.latitude!, current.longitude!,
        remaining[i].latitude!, remaining[i].longitude!,
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  // 좌표 없는 아이템은 뒤에 추가
  return [...ordered, ...withoutCoords];
}
