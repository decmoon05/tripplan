import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';

export async function GET() {
  try {
    const { supabase } = await getAdminUser();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    weekStart.setUTCHours(0, 0, 0, 0);

    // 병렬 조회
    const [usageResult, profileResult, tripResult] = await Promise.all([
      supabase
        .from('api_usage_log')
        .select('created_at')
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('user_profiles')
        .select('user_id', { count: 'exact', head: true }),
      supabase
        .from('trips')
        .select('id', { count: 'exact', head: true }),
    ]);

    const usageLogs = usageResult.data ?? [];
    const totalUsers = profileResult.count ?? 0;
    const totalTrips = tripResult.count ?? 0;

    // 일별 사용량 계산 (최근 7일)
    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, 0);
    }

    let todayUsage = 0;
    const todayKey = todayStart.toISOString().slice(0, 10);

    usageLogs.forEach((log) => {
      const key = log.created_at.slice(0, 10);
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
      }
      if (key === todayKey) todayUsage++;
    });

    const dailyUsage = Array.from(dailyMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    const weekUsage = usageLogs.length;
    const dailyLimit = parseInt(process.env.AI_DAILY_LIMIT || '10', 10) || 10;

    return NextResponse.json({
      success: true,
      data: { todayUsage, weekUsage, totalUsers, totalTrips, dailyUsage, dailyLimit },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
