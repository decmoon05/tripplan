/**
 * v4 Soft Weight 스코어링
 *
 * 6개 항목 (합계 1.00):
 * interest 0.30, quality 0.20, temporal 0.15, proximity 0.15, diversity 0.10, cost 0.10
 */

import { haversineKm } from '@/lib/services/ai/itineraryValidation';
import type { PlaceCandidate, DayContext, PlannerUserProfile } from './types';
import { SCORER_WEIGHTS, TEMPORAL_FIT_MATRIX } from './weights';

// ─── 메인 스코어 함수 ───────────────────────────────────────────────────────

export function scoreCandidate(
  candidate: PlaceCandidate,
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
  existingItems: PlaceCandidate[],
): number {
  const W = SCORER_WEIGHTS;

  const interest = interestScore(candidate.reasonTags, userProfile.interests);
  const quality = qualityScore(candidate.rating, candidate.verified, candidate.aiConfidence);
  const temporal = temporalFitScore(candidate.timePreference, dayContext, userProfile.nightComfort);
  const proximity = proximityBonus(candidate, existingItems);
  const diversity = diversityPenalty(candidate, existingItems);
  const cost = costFitScore(candidate.estimatedCost, userProfile.budgetRange, candidate.category);

  return (
    W.interest * interest +
    W.quality * quality +
    W.temporal * temporal +
    W.proximity * proximity +
    W.diversity * (1 - diversity) +
    W.cost * cost
  );
}

// ─── 개별 스코어 함수 ───────────────────────────────────────────────────────

/** Jaccard: reasonTags ∩ interests / union. wishedActivities는 별개 (Phase 4 B분기에서 AI로 처리). */
export function interestScore(
  tags: string[],
  userInterests: string[],
): number {
  const allUserTags = new Set(userInterests.map(t => t.toLowerCase()));
  if (tags.length === 0 || allUserTags.size === 0) return 0;
  const setA = new Set(tags.map(t => t.toLowerCase()));
  let intersection = 0;
  for (const a of setA) { if (allUserTags.has(a)) intersection++; }
  const union = new Set([...setA, ...allUserTags]).size;
  return union === 0 ? 0 : intersection / union;
}

/** 품질: rating + verified + aiConfidence */
export function qualityScore(
  rating: number | null,
  verified: boolean,
  aiConfidence: number,
): number {
  const ratingComponent = rating != null ? (rating / 5.0) : 0.5;
  const verifiedComponent = verified ? 1.0 : 0.3;
  const confidenceComponent = aiConfidence;
  return ratingComponent * 0.4 + verifiedComponent * 0.3 + confidenceComponent * 0.3;
}

/** 시간대 적합도 + nightComfort 반영 */
export function temporalFitScore(
  timePreference: string,
  dayContext: DayContext,
  nightComfort?: number,
): number {
  const midHour = (dayContext.availableHours.start + dayContext.availableHours.end) / 2;
  const slot = midHour < 12 ? 'morning' : midHour < 18 ? 'afternoon' : 'evening';

  const row = TEMPORAL_FIT_MATRIX[timePreference] || TEMPORAL_FIT_MATRIX['anytime'];
  let fit = row[slot] ?? 0.5;

  // evening 슬롯이면 nightComfort 반영
  if (slot === 'evening' && nightComfort != null) {
    fit *= nightComfort;
  }

  return fit;
}

/** 기존 배정 장소와의 거리 보너스 */
export function proximityBonus(
  candidate: PlaceCandidate,
  existingItems: PlaceCandidate[],
): number {
  if (existingItems.length === 0) return 0.5;
  if (candidate.latitude == null || candidate.longitude == null) return 0.3;

  const distances = existingItems
    .filter(e => e.latitude != null && e.longitude != null)
    .map(e => haversineKm(candidate.latitude!, candidate.longitude!, e.latitude!, e.longitude!));

  if (distances.length === 0) return 0.3;
  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
  return Math.max(0, 1 - avgDist / 10);
}

/** 카테고리 다양성 패널티 */
export function diversityPenalty(
  candidate: PlaceCandidate,
  existingItems: PlaceCandidate[],
): number {
  if (existingItems.length === 0) return 0;
  const sameCategoryCount = existingItems.filter(e => e.category === candidate.category).length;
  return Math.min(0.6, sameCategoryCount * 0.2);
}

/**
 * 비용 적합도 (budgetRange vs estimatedCost)
 * budget: 저가 가산, 고가 감산
 * moderate: 중간
 * luxury: 고가 가산, 저가 감산
 */
export function costFitScore(
  estimatedCost: number,
  budgetRange: string,
  category: string,
): number {
  if (estimatedCost === 0) return 0.7; // 무료 장소 → 대부분 적합

  // 카테고리별 기대 비용 (JPY 기준 대략)
  const categoryAvg: Record<string, number> = {
    restaurant: 1500,
    cafe: 800,
    attraction: 1000,
    shopping: 3000,
  };
  const avg = categoryAvg[category] || 1500;
  const ratio = estimatedCost / avg; // 1.0 = 평균

  switch (budgetRange) {
    case 'budget':
      // 저가(ratio < 0.7) → 1.0, 평균 → 0.5, 고가(ratio > 2) → 0.0
      return Math.max(0, Math.min(1, 1.5 - ratio * 0.75));
    case 'luxury':
      // 고가(ratio > 1.5) → 1.0, 평균 → 0.5, 저가(ratio < 0.3) → 0.2
      return Math.max(0.2, Math.min(1, ratio * 0.5));
    default: // moderate
      // 평균 근처 → 높음, 극단 → 낮음
      return Math.max(0, 1 - Math.abs(ratio - 1) * 0.5);
  }
}

/** 경량 정렬 (pipeline Step 5용): interest + quality만 */
export function lightScore(
  candidate: PlaceCandidate,
  userInterests: string[],
): number {
  return (
    interestScore(candidate.reasonTags, userInterests) * 0.6 +
    qualityScore(candidate.rating, candidate.verified, candidate.aiConfidence) * 0.4
  );
}

/** 후보 배열에 점수를 부여하고 정렬 */
export function rankCandidates(
  candidates: PlaceCandidate[],
  dayContext: DayContext,
  userProfile: PlannerUserProfile,
): PlaceCandidate[] {
  const scored = candidates.map(c => ({
    ...c,
    totalScore: scoreCandidate(c, dayContext, userProfile, []),
  }));
  return scored.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
}
