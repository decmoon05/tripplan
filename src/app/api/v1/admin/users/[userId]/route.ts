import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';

/** GET /api/v1/admin/users/{userId} — 유저 상세 + 여행 목록 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { supabase } = await getAdminUser();
    const { userId } = await params;

    if (!userId || userId.length < 10) {
      throw new AppError('VALIDATION_ERROR', 'Invalid userId', 400);
    }

    // 프로필
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id, role, mbti_style, travel_pace, budget_range, companion, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) throw new AppError('NOT_FOUND', '사용자를 찾을 수 없습니다', 404);

    // 여행 목록 (최근 20개)
    const { data: trips } = await supabase
      .from('trips')
      .select('id, destination, start_date, end_date, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // 아이템 수 집계
    const tripIds = (trips ?? []).map((t) => t.id);
    let itemCounts: Record<string, number> = {};
    if (tripIds.length > 0) {
      const { data: items } = await supabase
        .from('trip_items')
        .select('trip_id')
        .in('trip_id', tripIds);
      for (const item of items ?? []) {
        itemCounts[item.trip_id] = (itemCounts[item.trip_id] || 0) + 1;
      }
    }

    // AI 사용량 (오늘/이번 주)
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: todayCount } = await supabase
      .from('api_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('used_at', today);

    const { count: weekCount } = await supabase
      .from('api_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('used_at', weekAgo);

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          userId: profile.user_id,
          role: profile.role,
          mbti: profile.mbti_style,
          pace: profile.travel_pace,
          budget: profile.budget_range,
          companion: profile.companion,
          createdAt: profile.created_at,
        },
        trips: (trips ?? []).map((t) => ({
          id: t.id,
          destination: t.destination,
          startDate: t.start_date,
          endDate: t.end_date,
          status: t.status,
          itemCount: itemCounts[t.id] || 0,
          createdAt: t.created_at,
        })),
        usage: {
          today: todayCount ?? 0,
          week: weekCount ?? 0,
        },
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
