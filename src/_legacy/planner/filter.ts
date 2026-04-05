/**
 * v4 Hard Constraint 필터
 *
 * 설계서 §4.1: filter(hard) → score(soft) 2단계.
 * hard는 통과 못하면 후보에서 완전 제거.
 * 닫힌 가게가 "낮은 점수"로 남아있으면 추천될 수 있으므로 soft에 섞지 않음.
 *
 * ※ filterByWalkingLimit(장소 간 도보)는 Phase 3(동선 최적화)에서 처리.
 *   이 시점에서는 장소 간 순서가 미확정이므로 장소 간 도보 시간 계산 불가.
 */

import type { PlaceCandidate, DayContext, PlannerUserProfile, Area } from './types';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';
import { KNOWN_CHAINS, KNOWN_NON_MEAL } from '@/lib/services/ai/itineraryValidation';

// ─── 식이제한 태그 매핑 ─────────────────────────────────────────────────────
// v3 교훈: 이름이 아닌 reasonTags로 필터. "no-seafood"일 때 이자카야 태그가 있으면 제거.

const DIETARY_TAG_MAP: Record<string, string[]> = {
  'no-seafood': ['해산물', '이자카야', '소바', 'seafood', 'sashimi', 'sushi', '회', '생선', '어패류'],
  'no-spicy': ['매운', 'spicy', '고추', '辛'],
  'no-pork': ['돈카츠', '돈코츠', '豚', 'pork', '삼겹살', '족발'],
  'vegetarian': ['야키토리', 'BBQ', '바베큐', '고기', 'meat', '焼肉', '스테이크', 'steak'],
  'vegan': ['야키토리', 'BBQ', '바베큐', '고기', 'meat', '焼肉', '유제품', 'dairy', '계란', 'egg'],
  'halal': ['돈카츠', '돈코츠', '豚', 'pork', '이자카야', '주류', 'alcohol', 'bar', '居酒屋'],
  'no-dairy': ['유제품', 'dairy', '치즈', 'cheese', '우유', 'milk'],
  'no-gluten': ['라멘', 'ramen', '우동', 'udon', '소바', 'soba', '빵', 'bread', 'pasta'],
};

// ─── 메인 필터 (2단계 분리) ──────────────────────────────────────────────────

/**
 * Day 무관 필터 — pipeline Step 4에서 군집 풀 정제 시 사용.
 * 식이제한, 이동수단 접근성 등 Day에 의존하지 않는 항목만.
 * businessHours, closedDay는 Day별로 다르므로 여기서 적용하면 안 됨.
 */
export function applyDayIndependentFilters(
  candidates: PlaceCandidate[],
  userProfile: PlannerUserProfile,
  area: Area,
  transportMode: string,
): PlaceCandidate[] {
  let filtered = candidates;
  filtered = filterHallucinations(filtered);
  filtered = filterByDietaryRestrictions(filtered, userProfile.foodPreference);
  filtered = filterByTransportAccess(filtered, transportMode, area);
  return filtered;
}

/**
 * Day 의존 필터 — placeAssigner Step 9에서 Day별 장소 선택 시 사용.
 * businessHours, closedDay는 해당 Day의 context에 따라 다름.
 */
export function applyDayDependentFilters(
  candidates: PlaceCandidate[],
  dayContext: DayContext,
): PlaceCandidate[] {
  let filtered = candidates;
  filtered = filterByClosedDay(filtered, dayContext.dayOfWeek);
  filtered = filterByBusinessHours(filtered, dayContext.availableHours);
  return filtered;
}

/**
 * 전체 필터 (Day 무관 + Day 의존 통합) — 단일 Day 테스트용 편의 함수.
 */
export function applyHardFilters(
  candidates: PlaceCandidate[],
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
  area: Area,
): PlaceCandidate[] {
  let filtered = applyDayIndependentFilters(candidates, userProfile, area, dayContext.transportMode);
  filtered = applyDayDependentFilters(filtered, dayContext);
  return filtered;
}

// ─── 개별 필터 (단위 테스트 가능) ───────────────────────────────────────────

/** 군집 중심에서 장소까지 거리가 area.radiusKm을 초과하면 제거 */
export function filterByClusterRadius(
  candidates: PlaceCandidate[],
  area: Area,
): PlaceCandidate[] {
  return candidates.filter((c) => {
    if (c.latitude == null || c.longitude == null) return true; // 좌표 없으면 통과 (검증 단계에서 처리)
    const dist = haversineKm(area.centerLat, area.centerLon, c.latitude, c.longitude);
    return dist <= area.radiusKm * 1.5; // 여유 50% (경계 장소 허용)
  });
}

/** 해당 요일 휴무율 60% 이상이면 제거 */
export function filterByClosedDay(
  candidates: PlaceCandidate[],
  dayOfWeek: string,
): PlaceCandidate[] {
  const dayKey = dayOfWeek.toLowerCase();
  return candidates.filter((c) => {
    if (!c.closedDays) return true;
    // closedDays: "월요일" 또는 "Monday" 형태 — 요일 포함 여부 체크
    const closed = c.closedDays.toLowerCase();
    return !closed.includes(dayKey);
  });
}

/** 영업시간이 가용시간과 겹치지 않으면 제거 */
export function filterByBusinessHours(
  candidates: PlaceCandidate[],
  hours: { start: number; end: number },
): PlaceCandidate[] {
  return candidates.filter((c) => {
    if (!c.businessHours) return true; // 영업시간 불명 → 통과
    // businessHours: "09:00-21:00" 형태 파싱
    const match = c.businessHours.match(/(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})/);
    if (!match) return true; // 파싱 불가 → 통과
    const openHour = parseInt(match[1]);
    const closeHour = parseInt(match[3]);
    // 가용시간과 겹치는지 확인
    return openHour < hours.end && closeHour > hours.start;
  });
}

/** 식이제한에 위배되는 장소 제거 (reasonTags + 이름 기반) */
export function filterByDietaryRestrictions(
  candidates: PlaceCandidate[],
  restrictions: string[],
): PlaceCandidate[] {
  if (restrictions.length === 0) return candidates;

  const forbiddenTags = new Set<string>();
  for (const restriction of restrictions) {
    const tags = DIETARY_TAG_MAP[restriction];
    if (tags) tags.forEach((t) => forbiddenTags.add(t.toLowerCase()));
  }

  if (forbiddenTags.size === 0) return candidates;

  return candidates.filter((c) => {
    // reasonTags 체크
    for (const tag of c.reasonTags) {
      if (forbiddenTags.has(tag.toLowerCase())) return false;
    }
    // 이름 체크 (보조)
    const nameLower = c.placeNameSnapshot.toLowerCase();
    for (const forbidden of forbiddenTags) {
      if (nameLower.includes(forbidden)) return false;
    }
    return true;
  });
}

/** 대중교통인데 차량만 접근 가능한 동네면 제거 (area 수준 필터) */
export function filterByTransportAccess(
  candidates: PlaceCandidate[],
  mode: string,
  area: Area,
): PlaceCandidate[] {
  // 대중교통 모드인데 동네 대중교통 접근성이 극히 낮으면 경고만 (장소 수준 필터는 데이터 부족)
  // Phase 2에서는 area 수준 체크만 — 개별 장소의 접근성 데이터는 검증 레이어에서 보강
  if (mode === 'public' && area.transportAccessibility < 0.2) {
    console.warn(`[filter] ${area.areaNameKo}: 대중교통 접근성 ${area.transportAccessibility} — 장소 수 제한 가능`);
  }
  return candidates; // 개별 장소 데이터 부족으로 통과
}

// ─── 할루시네이션 감지 (이름에 장소가 아닌 패턴 포함) ────────────────────────

/** AI가 도로명/역명/주소를 장소 이름으로 뱉은 경우 감지 */
const HALLUCINATION_PATTERNS = [
  // 일본 도로/교통
  '幹線道路', '国道', '県道', '高速道路', '通り', '大通り',
  '駅前', '駅ビル', '駅構内',
  // 일반 시설
  'ローソン', 'セブン', 'ファミリーマート', 'コンビニ',
  // 주소 패턴
  '丁目', '番地', '号室',
];

export function filterHallucinations(candidates: PlaceCandidate[]): PlaceCandidate[] {
  return candidates.filter((c) => {
    const name = c.placeNameSnapshot;
    // 현지어(괄호 안) 추출
    const localMatch = name.match(/[（(]([^)）]+)[)）]/);
    const localName = localMatch ? localMatch[1] : name;

    for (const pattern of HALLUCINATION_PATTERNS) {
      if (localName.includes(pattern)) {
        console.warn(`[filter] 할루시네이션 감지: "${name}" (패턴: ${pattern})`);
        return false;
      }
    }
    return true;
  });
}

// ─── 체인/비식사 감지 (soft score용 유틸, hard filter에서는 정보만 추가) ────

/** 체인점 여부 감지 */
export function isChainRestaurant(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_CHAINS.some((chain) => lower.includes(chain.toLowerCase()));
}

/** 비식사 장소 여부 감지 (디저트/빵/커피전문점) */
export function isNonMealPlace(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_NON_MEAL.some((item) => lower.includes(item.toLowerCase()));
}
