/**
 * v4 Region 배분 로직
 *
 * pipeline 바깥에서 "destination → Day별 region 배정"을 결정.
 * 결과: RegionDayAssignment[] → pipeline에 입력.
 *
 * MVP: 1순위(사용자 직접 지정)만 구현.
 * 2순위(숙소 좌표 매칭), 3순위(자동 배분)는 Phase 4 이후.
 */

import type { Region, Area, DayContext, RegionDayAssignment, RegionGroup } from './types';

// ─── 입력 타입 ───────────────────────────────────────────────────────────────

export interface UserRegionPlan {
  regionId: string;
  days: number;
}

export interface RegionAllocatorInput {
  /** 사용자 destination 자유 텍스트 ("후쿠오카", "규슈", etc.) */
  destination: string;
  /** 총 여행일 수 */
  totalDays: number;
  /** 사용자 직접 지정 (1순위) */
  userRegionPlan?: UserRegionPlan[];
  /** Day별 컨텍스트 (숙소 정보 등) */
  dayContexts: DayContext[];
  /** DB에서 로드한 전체 region 목록 */
  allRegions: Region[];
  /** DB에서 로드한 전체 area 목록 */
  allAreas: Area[];
  /** DB에서 로드한 광역 그룹 목록 */
  regionGroups: RegionGroup[];
}

// ─── 메인 함수 ───────────────────────────────────────────────────────────────

/**
 * Day별 region 배정을 결정.
 *
 * 우선순위:
 * 1순위: userRegionPlan 있으면 → allocateFromUserPlan
 * 2순위: 숙소 좌표 기반 (Phase 4)
 * 3순위: 자동 배분 (Phase 4)
 * fallback: destination에서 단일 region 매칭 → 전 Day 동일 region
 */
export function allocateRegions(input: RegionAllocatorInput): RegionDayAssignment[] {
  // 1순위: 사용자 직접 지정
  if (input.userRegionPlan && input.userRegionPlan.length > 0) {
    return allocateFromUserPlan(input);
  }

  // fallback: destination에서 단일 region 매칭
  const matched = matchDestinationToRegions(input.destination, input.allRegions, input.regionGroups);

  if (matched.length === 1) {
    // 단일 region → 전 Day 동일 region
    const region = matched[0];
    const areas = input.allAreas.filter(a => a.parentRegionId === region.id);
    return input.dayContexts.map(dc => ({
      dayNumber: dc.dayNumber,
      region,
      areas,
    }));
  }

  if (matched.length > 1) {
    // 광역 매칭 ("규슈" → 5개 region) — MVP에서는 UI가 선택을 요청하므로 여기 도달하면 안 됨.
    // 안전 fallback: 첫 번째 region만 사용
    console.warn(`[regionAllocator] 광역 매칭 ${matched.length}개 — MVP에서는 UI에서 선택 필요. 첫 번째 region 사용.`);
    const region = matched[0];
    const areas = input.allAreas.filter(a => a.parentRegionId === region.id);
    return input.dayContexts.map(dc => ({
      dayNumber: dc.dayNumber,
      region,
      areas,
    }));
  }

  // 매칭 실패 — 빈 결과
  console.error(`[regionAllocator] destination "${input.destination}" 매칭 실패`);
  return [];
}

// ─── 1순위: 사용자 직접 지정 ─────────────────────────────────────────────────

/**
 * userRegionPlan → RegionDayAssignment[] 변환.
 * 입력 순서대로 Day 배분.
 *
 * 예: [{ regionId: 'fukuoka-id', days: 3 }, { regionId: 'nagasaki-id', days: 2 }]
 * → Day 1~3: 후쿠오카, Day 4~5: 나가사키
 */
export function allocateFromUserPlan(input: RegionAllocatorInput): RegionDayAssignment[] {
  const { userRegionPlan, allRegions, allAreas, dayContexts } = input;
  if (!userRegionPlan || userRegionPlan.length === 0) return [];

  const result: RegionDayAssignment[] = [];
  let dayOffset = 0;

  for (const plan of userRegionPlan) {
    const region = allRegions.find(r => r.id === plan.regionId);
    if (!region) {
      console.warn(`[regionAllocator] region ID "${plan.regionId}" 미발견, 스킵`);
      continue;
    }

    const areas = allAreas.filter(a => a.parentRegionId === region.id);

    for (let d = 0; d < plan.days; d++) {
      const dayNumber = dayOffset + d + 1;
      if (dayNumber > dayContexts.length) break;

      result.push({
        dayNumber,
        region,
        areas,
      });
    }

    dayOffset += plan.days;
  }

  // 남은 Day가 있으면 마지막 region으로 채움
  while (result.length < dayContexts.length) {
    const last = result[result.length - 1];
    if (!last) break;
    result.push({
      dayNumber: result.length + 1,
      region: last.region,
      areas: last.areas,
    });
  }

  return result;
}

// ─── destination → region 매칭 ──────────────────────────────────────────────

/**
 * destination 자유 텍스트 → region 목록 매칭.
 *
 * Case A: 정확히 1개 region 매칭 ("후쿠오카" → Fukuoka)
 * Case B: 광역 키워드 → 여러 region ("규슈" → 5개)
 * Case C: 매칭 실패 → 빈 배열
 */
export function matchDestinationToRegions(
  destination: string,
  allRegions: Region[],
  regionGroups: RegionGroup[],
): Region[] {
  const dest = destination.toLowerCase().trim();

  // 1) region_name_ko 정확 매칭
  const exactKo = allRegions.find(r => r.regionNameKo === destination.trim());
  if (exactKo) return [exactKo];

  // 2) region_name 영문 매칭 (대소문자 무시)
  const exactEn = allRegions.find(r => r.regionName.toLowerCase() === dest);
  if (exactEn) return [exactEn];

  // 3) region_name_ko 부분 매칭
  const partialKo = allRegions.find(r => dest.includes(r.regionNameKo) || r.regionNameKo.includes(dest));
  if (partialKo) return [partialKo];

  // 4) region_groups 광역 매칭 ("규슈" → group_name_ko)
  const group = regionGroups.find(g =>
    g.groupNameKo === destination.trim() ||
    g.groupName.toLowerCase() === dest ||
    dest.includes(g.groupNameKo)
  );
  if (group) {
    const regionIdSet = new Set(group.regionIds);
    return allRegions.filter(r => regionIdSet.has(r.id));
  }

  // 5) 매칭 실패
  return [];
}
