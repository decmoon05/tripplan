import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { handleApiError } from '@/lib/errors/handler';
import { generateRequestSchema } from '@/lib/validators/aiGenerate';
import { getTrip, deleteTripItemsByTripId, bulkInsertTripItems, updateTrip } from '@/lib/services/trip.service';
import { getVerifiedPlacesForDestination } from '@/lib/services/ai/popularPlaces';
import type { CachedPlace } from '@/lib/services/googlePlaces.service';
import { postValidateItems } from '@/lib/services/ai/postValidate';
import { validateGeoBoundary, optimizeRouteOrder, validateTransitFeasibility, augmentMissingMeals, validateClosedDays } from '@/lib/services/ai/itineraryValidation';
import { generateItineraryStream } from '@/lib/services/ai.service';
import { AppError } from '@/lib/errors/appError';
import type { VerifiedPlace, PreviousVisit } from '@/lib/services/ai/types';
import { normalizeCity } from '@/lib/utils/cityNormalize';
import { getCurrentModelName, getActiveProvider } from '@/lib/services/ai/models';
import { logAICall, estimateCostUSD, debugId } from '@/lib/services/ai/debugLog';
import { getPlanFeatures } from '@/lib/services/rateLimit.service';
import { enrichItemsWithDirections } from '@/lib/services/googleDirections.service';
import { getDayCount } from '@/utils/date';

const ENDPOINT = '/api/v1/ai/generate/stream';

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    await checkRateLimit(supabase, user.id, ENDPOINT);

    const body = await request.json();
    const { tripId, profile, tripInput, placePreferences } = generateRequestSchema.parse(body);

    // 소유권 확인
    const trip = await getTrip(supabase, tripId, user.id);
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    // Google Places 캐시 로드 — v3에서는 placeEnricher가 처리하므로 스킵
    let verifiedPlaces: VerifiedPlace[] = [];
    const cachedPlaceIds = new Set<string>();
    const useV3Pipeline = process.env.PIPELINE_VERSION === 'v3';
    if (!useV3Pipeline) try {
      const cached = await getVerifiedPlacesForDestination(supabase, tripInput.destination);
      verifiedPlaces = cached.map((c: CachedPlace) => ({
        googlePlaceId: c.googlePlaceId,
        displayName: c.displayName,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        rating: c.rating,
        businessHours: c.businessHours,
        closedDays: c.closedDays,
        category: c.category,
      }));
      for (const vp of verifiedPlaces) cachedPlaceIds.add(vp.googlePlaceId);
    } catch (err) {
      console.warn('[Stream] Google Places 캐시 로드 실패:', err instanceof Error ? err.message : err);
    }

    // 이전 여행 경험 조회 (같은 도시 completed trip)
    let previousVisits: PreviousVisit[] = [];
    try {
      const normalizedCity = normalizeCity(tripInput.destination);
      const { data: allTrips } = await supabase
        .from('trips')
        .select('id, destination')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      const matchedTripIds = (allTrips ?? [])
        .filter((t) => normalizeCity(t.destination) === normalizedCity)
        .map((t) => t.id);

      if (matchedTripIds.length > 0) {
        const { data: prevItems } = await supabase
          .from('trip_items')
          .select('id, place_name_snapshot, category, google_place_id')
          .in('trip_id', matchedTripIds);

        const { data: ratings } = await supabase
          .from('trip_ratings')
          .select('item_id, rating, memo')
          .in('trip_id', matchedTripIds)
          .eq('user_id', user.id);

        const ratingMap = new Map<string, { rating: number; memo: string | null }>();
        for (const r of ratings ?? []) {
          ratingMap.set(r.item_id, { rating: r.rating, memo: r.memo });
        }

        const seen = new Set<string>();
        for (const item of prevItems ?? []) {
          const key = item.google_place_id || item.place_name_snapshot;
          if (seen.has(key)) continue;
          seen.add(key);
          const r = ratingMap.get(item.id);
          previousVisits.push({
            placeNameSnapshot: item.place_name_snapshot,
            category: item.category,
            googlePlaceId: item.google_place_id,
            rating: r?.rating ?? null,
            memo: r?.memo ?? null,
          });
        }
      }
    } catch (err) {
      console.warn('[Stream] 이전 여행 조회 실패:', err instanceof Error ? err.message : err);
    }

    // 플랜별 기능 차등 조회
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle();
    const planFeatures = getPlanFeatures(userProfile?.plan || 'free');
    const totalDays = getDayCount(tripInput.startDate, tripInput.endDate);

    // 최대 여행일 제한 체크
    if (planFeatures.maxDays > 0 && totalDays > planFeatures.maxDays) {
      throw new AppError(
        'PLAN_LIMIT',
        `무료 플랜은 최대 ${planFeatures.maxDays}일까지 지원합니다. Pro로 업그레이드하면 더 긴 여행을 계획할 수 있습니다.`,
        403,
      );
    }

    const encoder = new TextEncoder();
    const aiStartTime = Date.now();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const useV3 = process.env.PIPELINE_VERSION === 'v3';

          if (useV3) {
            // ─── v3 파이프라인 (식사 보장, 좌표 보강, 시간 계산 전부 포함) ───
            const { generateItineraryV3Stream } = await import('@/lib/services/ai/v3/pipelineV3');
            const detectCurrency = (dest: string) => {
              if (/일본|도쿄|오사카|교토|규슈|홋카이도|오키나와|나라|후쿠오카/.test(dest)) return 'JPY';
              if (/한국|서울|부산|제주|대전|인천/.test(dest)) return 'KRW';
              if (/미국|뉴욕|하와이|LA/.test(dest)) return 'USD';
              if (/유럽|파리|런던|로마|바르셀로나/.test(dest)) return 'EUR';
              if (/태국|방콕/.test(dest)) return 'THB';
              if (/베트남|하노이|호치민|다낭/.test(dest)) return 'VND';
              if (/대만|타이베이/.test(dest)) return 'TWD';
              return 'USD';
            };

            send('progress', { message: '🔍 AI가 장소를 추천하고 있습니다...' });

            const paceToItems: Record<string, number> = { relaxed: 4, moderate: 5, active: 7 };
            const v3Config = {
              totalDays,
              startDate: tripInput.startDate,
              destination: tripInput.destination,
              endDate: tripInput.endDate,
              itemsPerDay: paceToItems[profile.travelPace || 'moderate'] || 5,
              stamina: (profile.lifestyle?.stamina as 'low' | 'moderate' | 'high') || 'moderate',
              arrivalTime: (profile.arrivalTime as 'morning' | 'afternoon' | 'evening') || 'morning',
              morningType: (profile.lifestyle?.morningType as 'early' | 'moderate' | 'late') || 'moderate',
              isRentalCar: !!((profile.specialNote || '') + ' ' + (profile.customInterests || '')).match(/렌터카|렌트카|rental|rent.*car/i),
              currency: detectCurrency(tripInput.destination),
              usePlaces: planFeatures.places,
              useDirections: planFeatures.directions,
              maxRepairs: planFeatures.repairs,
            };

            const v3Generator = generateItineraryV3Stream(
              profile,
              { destination: tripInput.destination, startDate: tripInput.startDate, endDate: tripInput.endDate },
              v3Config,
              placePreferences?.map(p => ({ placeName: p.placeName, preference: p.preference as 'exclude' | 'revisit' | 'new' | 'hidden' })),
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let v3Items: any[] = [];
            let v3Summary: string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let v3Advisories: any;

            for await (const event of v3Generator) {
              switch (event.type) {
                case 'progress':
                  send('progress', { message: event.message });
                  break;
                case 'places_received':
                  send('progress', { message: `📋 ${event.count}개 장소 추천 완료, 정보 확인 중...` });
                  break;
                case 'meal_supplement':
                  send('progress', { message: `🍽️ 식사 ${event.count}곳 추가 완료` });
                  break;
                case 'slot_assigned':
                  send('progress', { message: `📅 Day ${event.day}: ${event.itemCount}개 일정 배치` });
                  break;
                case 'complete':
                  v3Items = event.items;
                  v3Summary = event.tripSummary;
                  v3Advisories = event.advisories;
                  break;
              }
            }

            if (v3Items.length === 0) throw new Error('v3 파이프라인: 일정 생성 실패');

            // v3는 후처리 불필요 — 파이프라인 내부에서 전부 처리됨

            // DB 저장
            send('progress', { message: '💾 일정을 저장하고 있습니다...' });
            const itemsWithTripId = v3Items.map((item) => ({ ...item, tripId }));
            await deleteTripItemsByTripId(supabase, tripId);
            const inserted = await bulkInsertTripItems(supabase, itemsWithTripId);

            await updateTrip(supabase, tripId, user.id, {
              status: 'generated',
              tripSummary: v3Summary || null,
              advisories: v3Advisories || null,
            });

            await recordUsage(supabase, user.id, ENDPOINT);

            send('complete', {
              items: inserted,
              tripSummary: v3Summary,
              advisories: v3Advisories,
            });

            // 디버그 로그
            const durationMs = Date.now() - aiStartTime;
            logAICall({
              id: debugId(),
              timestamp: new Date().toISOString(),
              provider: getActiveProvider(),
              model: getCurrentModelName(),
              endpoint: 'generate-v3',
              userId: user.id,
              destination: tripInput.destination,
              systemPromptLength: 0,
              userPromptPreview: `[v3] ${tripInput.destination} ${tripInput.startDate}~${tripInput.endDate}`,
              userPromptLength: 0,
              inputTokens: null,
              outputTokens: null,
              totalTokens: null,
              estimatedCostUSD: null,
              durationMs,
              success: true,
              error: null,
              itemCount: inserted.length,
            });

          } else {
            // ─── v2 파이프라인 (레거시) ───
            const generator = generateItineraryStream(
              profile,
              { destination: tripInput.destination, startDate: tripInput.startDate, endDate: tripInput.endDate },
              placePreferences,
              verifiedPlaces.length > 0 ? verifiedPlaces : undefined,
              previousVisits.length > 0 ? previousVisits : undefined,
            );

            for await (const chunk of generator) {
              switch (chunk.type) {
                case 'progress':
                  send('progress', { message: chunk.message });
                  break;
                case 'grounding':
                  send('grounding', { sources: chunk.sources });
                  break;
                case 'partial_item':
                  send('item', { placeNameSnapshot: chunk.item.placeNameSnapshot, dayNumber: chunk.item.dayNumber });
                  break;
                case 'complete': {
                  send('progress', { message: '🔍 일정 검증 및 최적화 중...' });
                  let validatedItems = chunk.result.items;
                  if (planFeatures.places) {
                    try {
                      validatedItems = await postValidateItems(validatedItems, tripInput.destination, cachedPlaceIds);
                    } catch (err) {
                      console.warn('[Stream v2] 사후 검증 실패:', err instanceof Error ? err.message : err);
                    }
                  }
                  validatedItems = validateClosedDays(validatedItems, tripInput.startDate);
                  validatedItems = validateGeoBoundary(validatedItems);
                  validatedItems = optimizeRouteOrder(validatedItems);
                  validatedItems = validateTransitFeasibility(validatedItems);
                  validatedItems = augmentMissingMeals(validatedItems, profile.arrivalTime, totalDays);

                  const v2ItemsWithTripId = validatedItems.map((item) => ({ ...item, tripId }));
                  await deleteTripItemsByTripId(supabase, tripId);
                  const v2Inserted = await bulkInsertTripItems(supabase, v2ItemsWithTripId);
                  await updateTrip(supabase, tripId, user.id, {
                    status: 'generated',
                    tripSummary: chunk.result.tripSummary || null,
                    advisories: chunk.result.advisories || null,
                  });
                  await recordUsage(supabase, user.id, ENDPOINT);
                  send('complete', { items: v2Inserted, tripSummary: chunk.result.tripSummary, advisories: chunk.result.advisories });
                  break;
                }
              }
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '일정 생성 실패';
          send('error', { message });

          // 실패 로그
          logAICall({
            id: debugId(),
            timestamp: new Date().toISOString(),
            provider: process.env.AI_PROVIDER || 'mock',
            model: 'unknown',
            endpoint: 'generate',
            userId: user.id,
            destination: tripInput.destination,
            systemPromptLength: 0,
            userPromptPreview: `${tripInput.destination} (실패)`,
            userPromptLength: 0,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            estimatedCostUSD: null,
            durationMs: Date.now() - aiStartTime,
            success: false,
            error: message,
            itemCount: null,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
