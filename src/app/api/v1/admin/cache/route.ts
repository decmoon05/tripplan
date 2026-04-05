import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { getWeatherCacheStatus, clearWeatherCache } from '@/lib/services/weather.service';
import { getExchangeCacheStatus, clearExchangeCache } from '@/lib/services/exchange.service';
import { getPlacesCacheStatus, clearPlacesCache } from '@/lib/services/ai/popularPlaces';

async function checkDevOrAdmin(supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'], userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'developer')) {
    throw new AppError('FORBIDDEN', '관리자 또는 개발자 권한이 필요합니다', 403);
  }
}

/** GET /api/v1/admin/cache — 캐시 상태 조회 */
export async function GET() {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);

    return NextResponse.json({
      success: true,
      data: {
        weather: getWeatherCacheStatus(),
        exchange: getExchangeCacheStatus(),
        places: getPlacesCacheStatus(),
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/v1/admin/cache?type=weather|exchange|places|all — 캐시 플러시 */
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);

    const type = request.nextUrl.searchParams.get('type') || 'all';
    const cleared: string[] = [];

    if (type === 'weather' || type === 'all') { clearWeatherCache(); cleared.push('weather'); }
    if (type === 'exchange' || type === 'all') { clearExchangeCache(); cleared.push('exchange'); }
    if (type === 'places' || type === 'all') { clearPlacesCache(); cleared.push('places'); }

    if (cleared.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'type: weather|exchange|places|all', 400);
    }

    console.log(`[Cache] 플러시 by ${user.id}: ${cleared.join(', ')}`);

    return NextResponse.json({ success: true, data: { cleared }, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
