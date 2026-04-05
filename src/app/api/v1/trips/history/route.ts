import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { AppError } from '@/lib/errors/appError';
import { normalizeCity } from '@/lib/utils/cityNormalize';

const ENDPOINT = '/api/v1/trips/history';

const DESTINATION_RE = /^[\w\s\-,.가-힣]{1,100}$/u;

/**
 * GET /api/v1/trips/history?destination=오사카
 *
 * 같은 대도시의 완료된(completed) 이전 여행과 방문 장소+평가를 반환.
 * AI 일정 생성 시 이전 경험을 참조하기 위한 엔드포인트.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    const destination = request.nextUrl.searchParams.get('destination') ?? '';

    if (!destination || !DESTINATION_RE.test(destination)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid destination', 400);
    }

    await checkRateLimit(supabase, user.id, ENDPOINT);

    const normalizedCity = normalizeCity(destination);

    // 1. 사용자의 completed trip 중 같은 도시 검색
    const { data: allTrips, error: tripErr } = await supabase
      .from('trips')
      .select('id, destination, start_date, end_date, status')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('start_date', { ascending: false });

    if (tripErr) throw new AppError('DB_ERROR', tripErr.message, 500);

    // 도시명 정규화로 매칭
    const matchedTrips = (allTrips ?? []).filter(
      (t) => normalizeCity(t.destination) === normalizedCity,
    );

    if (matchedTrips.length === 0) {
      return NextResponse.json({
        success: true,
        data: { trips: [], visitedPlaces: [] },
        error: null,
      });
    }

    // 2. 해당 trip들의 아이템 + 평가 조회
    const tripIds = matchedTrips.map((t) => t.id);
    const { data: items, error: itemErr } = await supabase
      .from('trip_items')
      .select('id, trip_id, place_name_snapshot, category, google_place_id, latitude, longitude')
      .in('trip_id', tripIds);

    if (itemErr) throw new AppError('DB_ERROR', itemErr.message, 500);

    // 3. 평가 데이터 조회
    const { data: ratings } = await supabase
      .from('trip_ratings')
      .select('item_id, rating, memo')
      .in('trip_id', tripIds)
      .eq('user_id', user.id);

    const ratingMap = new Map<string, { rating: number; memo: string | null }>();
    for (const r of ratings ?? []) {
      ratingMap.set(r.item_id, { rating: r.rating, memo: r.memo });
    }

    // 4. trip별 startDate 매핑
    const tripDateMap = new Map<string, string>();
    for (const t of matchedTrips) {
      tripDateMap.set(t.id, t.start_date);
    }

    const visitedPlaces = (items ?? []).map((item) => {
      const rating = ratingMap.get(item.id);
      return {
        placeNameSnapshot: item.place_name_snapshot,
        category: item.category,
        googlePlaceId: item.google_place_id,
        rating: rating?.rating ?? null,
        memo: rating?.memo ?? null,
        tripId: item.trip_id,
        visitDate: tripDateMap.get(item.trip_id) ?? null,
      };
    });

    // 중복 장소 제거 (같은 googlePlaceId 또는 같은 이름)
    const seen = new Set<string>();
    const dedupedPlaces = visitedPlaces.filter((p) => {
      const key = p.googlePlaceId || p.placeNameSnapshot;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await recordUsage(supabase, user.id, ENDPOINT).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        trips: matchedTrips.map((t) => ({
          tripId: t.id,
          destination: t.destination,
          startDate: t.start_date,
          endDate: t.end_date,
        })),
        visitedPlaces: dedupedPlaces,
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
