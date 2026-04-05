/**
 * v4 Planner — 3단 군집 트리 아키텍처
 *
 * AI는 장소 추천만, 나머지는 코드가 처리.
 *
 * Phase 1: 군집 데이터 구축 (1차 지역 + 2차 동네)
 * Phase 2: 3차 장소 추천 + 필터링 + 검증
 * Phase 3: 가중치 스코어링 + 동선 최적화
 * Phase 4: 사용자 UX
 *
 * 참조: docs/v4_architecture_design.md
 */

export * from './types';
export * from './weights';
export { buildPlaceRecommendationPrompt, buildPlaceSystemPrompt } from './promptPlanner';
export { callGeminiForPlaces } from './aiAdapter';
export { applyHardFilters, applyDayIndependentFilters, applyDayDependentFilters, isChainRestaurant, isNonMealPlace, filterHallucinations } from './filter';
export { scoreCandidate, rankCandidates, interestScore, qualityScore, costFitScore, lightScore } from './scorer';
export { verifyTopPlaces, postVerifyFilter } from './verifier';
export { buildDayContexts, adjustForRegionTransit } from './dayContext';
export { allocateRegions, allocateFromUserPlan, matchDestinationToRegions } from './regionAllocator';
export { assignAreasToDays, fatiguePenalty } from './dayAssigner';
export { assignPlacesToDay } from './placeAssigner';
export { optimizeDayRoute, edgeCost, twoOptImprove } from './routeOptimizer';
export { calculateTimes, estimateTransitTime, getOsrmStats } from './timeCalculator';
export { toTripItem, toTripItems } from './tripItemMapper';
export { generateItinerary, generateItineraryStream } from './pipeline';
