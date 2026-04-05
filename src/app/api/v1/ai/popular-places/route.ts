import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getPopularPlaces } from '@/lib/services/ai/popularPlaces';
import { getVisitedPlaces } from '@/lib/services/trip.service';
import { getProfile } from '@/lib/services/profile.service';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { handleApiError } from '@/lib/errors/handler';

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    // Rate Limiting (Google API 비용 방지)
    await checkRateLimit(supabase, user.id, '/api/v1/ai/popular-places');

    const rawDest = request.nextUrl.searchParams.get('destination');
    if (!rawDest) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'destination은 필수입니다' } },
        { status: 400 },
      );
    }
    const destination = rawDest.replace(/[<>]/g, '').trim().slice(0, 100);
    if (!destination) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'destination이 유효하지 않습니다' } },
        { status: 400 },
      );
    }

    // 사용자 프로필 조회 (개인화 추천용)
    const userProfile = await getProfile(supabase, user.id);

    // 사용자가 이 목적지로 이전에 여행했던 장소 목록
    const visitedPlaces = await getVisitedPlaces(supabase, user.id, destination);

    // 프로필 기반 개인화된 인기 장소 반환 (Google Places 캐시 사용)
    const places = await getPopularPlaces(destination, [], visitedPlaces, userProfile, supabase);

    await recordUsage(supabase, user.id, '/api/v1/ai/popular-places');

    return NextResponse.json({ success: true, data: places, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
