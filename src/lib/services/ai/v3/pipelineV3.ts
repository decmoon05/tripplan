/**
 * v3 파이프라인 오케스트레이션
 *
 * Phase 1: AI 장소 추천 (Gemini 1회)
 * Phase 2: Google Places 보강 (Pro만)
 * Phase 3: 식사 보장
 * Phase 4: 슬롯 배정 (결정적)
 * Phase 5: 시간 계산 (결정적)
 * Phase 6: TripItem 변환
 */

import type { TripItem, TripAdvisories } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { PlacePreferenceInput, VerifiedPlace, PreviousVisit } from '../types';
import type { AIPlaceRecommendation, AIV3Response, V3Config, V3StreamEvent, AssignedItem, V3CostTracker } from './types';
import { buildV3SystemPrompt, buildV3UserPrompt, buildV3MealSupplementPrompt } from './promptV3';
import { enrichPlaces, toUnverifiedPlaces } from './placeEnricher';
// restaurantResolver 비활성화 — Overpass 추가 호출로 속도 저하 + 429 위험
// import { resolveNullCoordRestaurants } from './restaurantResolver';
import { checkMealShortage, mergeSupplement } from './mealGuarantee';
import { assignSlots } from './slotAssigner';
import { calculateTimes } from './timeCalculator';
// v2 후처리 함수 제거 — v3에서는 slotAssigner + placeEnricher가 처리
// import { validateGeoBoundary, validateClosedDays } from '../itineraryValidation';
import { enrichItemsWithDirections } from '@/lib/services/googleDirections.service';
import { generateId } from '@/utils/id';
import { getDayCount } from '@/utils/date';

// Gemini 호출용 — gemini.provider.ts에서 export
import { callGeminiForV3, callGeminiForV3Supplement } from './geminiV3Adapter';

interface V3Input {
  destination: string;
  startDate: string;
  endDate: string;
}

interface V3Result {
  items: TripItem[];
  tripSummary?: string;
  advisories?: TripAdvisories;
  cost?: V3CostTracker;
}

/**
 * v3 비스트리밍 파이프라인 (test-generate용)
 */
export async function generateItineraryV3(
  profile: FullProfileInput,
  input: V3Input,
  config: V3Config,
  placePreferences?: PlacePreferenceInput[],
  verifiedPlaces?: VerifiedPlace[],
  previousVisits?: PreviousVisit[],
): Promise<V3Result> {
  const totalDays = config.totalDays;
  const systemPrompt = buildV3SystemPrompt();
  const userPrompt = buildV3UserPrompt(
    profile, input, totalDays, config.itemsPerDay,
    placePreferences, verifiedPlaces, previousVisits,
  );

  // Phase 1: AI 장소 추천
  console.log(`[v3] Phase 1: AI 장소 추천 요청 (${totalDays}일, ${config.itemsPerDay}개/일)`);
  const aiResponse = await callGeminiForV3(systemPrompt, userPrompt);
  let places = aiResponse.places;
  console.log(`[v3] Phase 1 완료: ${places.length}개 장소 수신`);

  // Phase 2: 장소 보강 (Nominatim + Overpass + Google Places)
  // Free: Layer 1(Nominatim 좌표) + Layer 2(Overpass 영업시간) → $0
  // Pro: Layer 1~2 + Layer 3(Google Places 정밀 데이터) → ~$0.16/일
  console.log(`[v3] Phase 2: 장소 데이터 보강 시작`);
  let enrichResult = await enrichPlaces(places, input.destination, config);
  let enrichedPlaces = enrichResult.enriched;
  console.log(`[v3] Phase 2 완료: ${enrichedPlaces.length - enrichResult.failedCount}/${enrichedPlaces.length}개 좌표 확보`);

  // Phase 2.5: restaurantResolver 비활성화 (속도/429 문제)
  // coords null은 검증 임계값 완화로 해결 (3건 이하 허용)

  // Phase 3: 식사 보장
  const shortage = checkMealShortage(places, totalDays, config.arrivalTime);
  if (shortage.lunch > 0 || shortage.dinner > 0) {
    console.log(`[v3] Phase 3: 식사 부족 — 점심 ${shortage.lunch}개, 저녁 ${shortage.dinner}개 보충 요청`);
    try {
      const supplementPrompt = buildV3MealSupplementPrompt(
        input.destination, shortage,
        (profile.foodPreference || []) as string[],
        profile.budgetRange || 'moderate',
      );
      const supplementResult = await callGeminiForV3Supplement(supplementPrompt);
      places = mergeSupplement(places, supplementResult.places);

      // 보충분도 보강
      const { enriched: supplementEnriched } = await enrichPlaces(supplementResult.places, input.destination, config);
      enrichedPlaces = [...enrichedPlaces, ...supplementEnriched];
      console.log(`[v3] Phase 3 완료: ${supplementResult.places.length}개 식당 보충 ($${supplementResult.costUSD})`);
    } catch (err) {
      console.warn(`[v3] Phase 3 보충 실패:`, err instanceof Error ? err.message : err);
    }
  } else {
    console.log(`[v3] Phase 3: 식사 충분 (점심 ${places.filter(p => p.mealSlot === 'lunch').length}, 저녁 ${places.filter(p => p.mealSlot === 'dinner').length})`);
  }

  // Phase 4: 슬롯 배정
  console.log(`[v3] Phase 4: 슬롯 배정`);
  const daySchedules = assignSlots(enrichedPlaces, config);

  // Phase 5: 시간 계산
  console.log(`[v3] Phase 5: 시간 계산`);
  const allItems: AssignedItem[] = [];
  for (const day of daySchedules) {
    const dayItems = calculateTimes(day.items, day.dayNumber, config);
    allItems.push(...dayItems);
  }

  // Phase 6: TripItem 변환
  let tripItems = allItems.map(item => toTripItem(item));

  // v2 후처리 제거 — slotAssigner(Phase 4)가 이미 처리
  // validateClosedDays: slotAssigner의 isOpenOnDay()에서 처리됨
  // validateGeoBoundary: placeEnricher(Phase 2)에서 처리됨
  // v2 함수를 여기서 호출하면 v3가 배치한 식당을 삭제함

  // Pro: Directions API
  if (config.useDirections) {
    try {
      console.log(`[v3] Directions API로 이동시간 보정`);
      tripItems = await enrichItemsWithDirections(tripItems);
    } catch (err) {
      console.warn(`[v3] Directions 실패 (graceful skip):`, err instanceof Error ? err.message : err);
    }
  }

  // Phase 6.5: 검증 + AI 재요청 (논문 핵심: validate → re-request)
  const issueItems = tripItems.filter(item => {
    // 좌표가 목적지에서 100km+ 벗어난 장소
    if (item.latitude && item.longitude) {
      const otherCoords = tripItems.filter(t => t.latitude && t !== item);
      if (otherCoords.length > 2) {
        const medLat = otherCoords.reduce((s, t) => s + t.latitude!, 0) / otherCoords.length;
        const medLon = otherCoords.reduce((s, t) => s + t.longitude!, 0) / otherCoords.length;
        const dist = Math.sqrt((item.latitude - medLat) ** 2 + (item.longitude - medLon) ** 2) * 111;
        if (dist > 100) return true;
      }
    }
    return false;
  });

  if (issueItems.length > 0 && config.maxRepairs > 0) {
    console.log(`[v3] Phase 6.5: ${issueItems.length}개 문제 장소 발견 → AI 재요청`);
    try {
      const problemNames = issueItems.map(i => i.placeNameSnapshot).join(', ');
      const repairPrompt = `다음 장소들의 좌표가 잘못되었습니다: ${problemNames}. ${input.destination}에 있는 실제 장소로 대체해주세요. 같은 카테고리로.`;
      const repairResult = await callGeminiForV3Supplement(repairPrompt);
      if (repairResult.places.length > 0) {
        // 문제 장소 교체
        for (let ri = 0; ri < Math.min(repairResult.places.length, issueItems.length); ri++) {
          const issue = issueItems[ri];
          const replacement = repairResult.places[ri];
          const idx = tripItems.findIndex(t => t.placeNameSnapshot === issue.placeNameSnapshot);
          if (idx >= 0) {
            tripItems[idx].placeNameSnapshot = replacement.placeNameSnapshot;
            tripItems[idx].notes = replacement.notes;
            tripItems[idx].reasonTags = replacement.reasonTags;
            console.log(`[v3] Phase 6.5: "${issue.placeNameSnapshot}" → "${replacement.placeNameSnapshot}"`);
          }
        }
      }
    } catch (err) {
      console.warn(`[v3] Phase 6.5 재요청 실패 (graceful skip):`, err instanceof Error ? err.message : err);
    }
  }

  // 비용 계산
  const geminiUsage = aiResponse._usage;
  const cost: V3CostTracker = {
    gemini: {
      calls: 1 + (shortage.lunch > 0 || shortage.dinner > 0 ? 1 : 0),
      inputTokens: geminiUsage?.inputTokens ?? 0,
      outputTokens: geminiUsage?.outputTokens ?? 0,
      model: geminiUsage?.model ?? 'unknown',
      costUSD: geminiUsage?.costUSD ?? 0,
    },
    nominatim: { calls: enrichedPlaces.length, costUSD: 0 },
    overpass: { calls: enrichedPlaces.filter(p => p.latitude).length, costUSD: 0 },
    osrm: { calls: 0, costUSD: 0 },
    googlePlaces: {
      // 좌표/영업시간 없는 장소만 Places 호출 (Layer 3 최적화)
      calls: config.usePlaces ? enrichedPlaces.filter(p => !p.latitude || !p.businessHours).length : 0,
      // Pro FieldMask (photos 포함): $0.032/건
      costUSD: config.usePlaces ? enrichedPlaces.filter(p => !p.latitude || !p.businessHours).length * 0.032 : 0,
    },
    googleDirections: { calls: 0, costUSD: 0 },
    totalCostUSD: 0,
  };
  cost.totalCostUSD = cost.gemini.costUSD + cost.googlePlaces.costUSD + cost.googleDirections.costUSD;

  console.log(`[v3] 완료: ${tripItems.length}개 아이템 | 비용: $${cost.totalCostUSD.toFixed(4)}`);

  return {
    items: tripItems,
    tripSummary: aiResponse.tripSummary,
    advisories: aiResponse.advisories as TripAdvisories | undefined,
    cost,
  };
}

/**
 * v3 스트리밍 파이프라인 (프로덕션용)
 */
export async function* generateItineraryV3Stream(
  profile: FullProfileInput,
  input: V3Input,
  config: V3Config,
  placePreferences?: PlacePreferenceInput[],
  verifiedPlaces?: VerifiedPlace[],
  previousVisits?: PreviousVisit[],
): AsyncGenerator<V3StreamEvent> {
  yield { type: 'progress', message: '🤖 AI가 맞춤 장소를 추천하고 있습니다...' };

  const totalDays = config.totalDays;
  const systemPrompt = buildV3SystemPrompt();
  const userPrompt = buildV3UserPrompt(
    profile, input, totalDays, config.itemsPerDay,
    placePreferences, verifiedPlaces, previousVisits,
  );

  // Phase 1
  const aiResponse = await callGeminiForV3(systemPrompt, userPrompt);
  let places = aiResponse.places;
  yield { type: 'places_received', count: places.length };

  // Phase 2: 장소 보강 (Nominatim + Overpass + Google Places)
  yield { type: 'progress', message: '📍 장소 좌표와 정보를 확인하고 있습니다...' };
  const enrichResult2 = await enrichPlaces(places, input.destination, config);
  let enrichedPlaces = enrichResult2.enriched;

  // Phase 2.5: restaurantResolver 비활성화 (속도/429 문제)

  // Phase 3
  const shortage = checkMealShortage(places, totalDays, config.arrivalTime);
  if (shortage.lunch > 0 || shortage.dinner > 0) {
    yield { type: 'progress', message: '🍽️ 식사 장소를 보충하고 있습니다...' };
    try {
      const supplementPrompt = buildV3MealSupplementPrompt(
        input.destination, shortage,
        (profile.foodPreference || []) as string[],
        profile.budgetRange || 'moderate',
      );
      const supplementResult = await callGeminiForV3Supplement(supplementPrompt);
      places = mergeSupplement(places, supplementResult.places);
      const { enriched: supplementEnriched } = await enrichPlaces(supplementResult.places, input.destination, config);
      enrichedPlaces = [...enrichedPlaces, ...supplementEnriched];
      yield { type: 'meal_supplement', count: supplementResult.places.length };
    } catch {
      // 보충 실패 시 무시
    }
  }

  // Phase 4
  yield { type: 'progress', message: '📋 일정을 배치하고 있습니다...' };
  const daySchedules = assignSlots(enrichedPlaces, config);
  for (const day of daySchedules) {
    yield { type: 'slot_assigned', day: day.dayNumber, itemCount: day.items.length };
  }

  // Phase 5
  yield { type: 'progress', message: '🚶 이동 시간을 계산하고 있습니다...' };
  const allItems: AssignedItem[] = [];
  for (const day of daySchedules) {
    const dayItems = calculateTimes(day.items, day.dayNumber, config);
    allItems.push(...dayItems);
  }

  // Phase 6
  let tripItems = allItems.map(item => toTripItem(item));
  // v2 후처리 제거 — slotAssigner + placeEnricher에서 이미 처리됨

  if (config.useDirections) {
    yield { type: 'progress', message: '🗺️ 실제 이동시간을 계산하고 있습니다...' };
    try {
      tripItems = await enrichItemsWithDirections(tripItems);
    } catch {
      // graceful skip
    }
  }

  yield {
    type: 'complete' as const,
    items: tripItems as any, // TripItem[] — DB 저장 가능
    tripSummary: aiResponse.tripSummary,
    advisories: aiResponse.advisories,
  };
}

// ---------------------------------------------------------------------------
// AssignedItem → TripItem 변환
// ---------------------------------------------------------------------------

function toTripItem(item: AssignedItem): TripItem {
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
