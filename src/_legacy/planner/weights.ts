/**
 * v4 가중치 상수
 *
 * 초기값은 경험적 설정. Phase 4(페르소나 시뮬레이션) 후 조정 예정.
 * 논문 5장 실험에서 민감도 분석으로 검증.
 * 변경 시 이 파일만 수정하면 전체 반영됨.
 */

/** soft score 가중치 (장소 개별 점수, 합계 1.00) */
export const SCORER_WEIGHTS = {
  interest: 0.30,     // Jaccard(reasonTags, userInterests ∪ wishedActivities)
  quality: 0.20,      // rating + verified + aiConfidence
  temporal: 0.15,     // timeVector × 배정 시간대 × nightComfort
  proximity: 0.15,    // 기존 배정 장소와의 거리 보너스
  diversity: 0.10,    // 카테고리 다양성 패널티
  cost: 0.10,         // 예산 적합도 (budgetRange vs estimatedCost)
} as const;

/** Day 배정 가중치 (dayAssigner의 scoreAreaForDay, 합계 1.00) */
export const DAY_ASSIGNER_WEIGHTS = {
  interestMatch: 0.25,          // 관심사 매칭 (interests ∪ wishedActivities)
  repeatPenalty: 0.25,          // 중복 패널티 (풀 고갈 방지)
  timeFit: 0.15,                // 시간대 적합 + nightComfort
  accommodationDistance: 0.10,  // 숙소 거리 (낮춤, 외곽 허용)
  fatigue: 0.10,                // 피로도
  transportFit: 0.10,           // 이동수단 × 접근성
  closedDayPenalty: 0.05,       // 휴무 영향
} as const;

/** 피로도 모델 기울기 (stamina별) */
export const FATIGUE_SLOPES = {
  high: 0.3,
  moderate: 0.6,
  low: 1.0,
} as const;

/** stamina별 Day당 아이템 수 범위 */
export const ITEMS_PER_DAY = {
  low: { min: 3, max: 4 },
  moderate: { min: 4, max: 6 },
  high: { min: 5, max: 8 },
} as const;

/** 시간대 적합도 행렬 (timePreference × 배정 슬롯) */
export const TEMPORAL_FIT_MATRIX: Record<string, Record<string, number>> = {
  morning:   { morning: 1.0, afternoon: 0.3, evening: 0.0 },
  afternoon: { morning: 0.2, afternoon: 1.0, evening: 0.4 },
  evening:   { morning: 0.0, afternoon: 0.2, evening: 1.0 },
  anytime:   { morning: 0.7, afternoon: 0.8, evening: 0.7 },
};

/** 카테고리별 AI 추천 기본 수 (1일 기준) */
export const BASE_PLACES_PER_CATEGORY: Record<string, number> = {
  restaurant: 15,
  attraction: 15,
  cafe: 10,
  shopping: 10,
};

/** 검증 기본 수 (1일 기준) */
export const BASE_VERIFY_TOP_N = 15;

/**
 * region 체류일 기반 스케일 팩터.
 * 로그 스케일 — 정비례가 아님. 체감 수확 감소.
 *
 * 1일: 1.00 (기본)
 * 2일: 1.35
 * 3일: 1.55
 * 5일: 1.80
 */
export function placeScaleFactor(regionDays: number): number {
  return 1 + Math.log(Math.max(1, regionDays)) * 0.5;
}

/** 보조 군집 추가 임계값 (메인 점수 대비 비율, 0~1) */
export const SUB_AREA_SCORE_THRESHOLD = 0.6;

/** 보조 군집 추가 최소 가용시간 (시간) */
export const SUB_AREA_MIN_HOURS = 6;

/** 평균 이동시간 추정 (placeAssigner 시간 체크용, 분) */
export const AVG_TRANSIT_MINUTES = 15;
