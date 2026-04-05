import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { getAILogs, clearAILogs } from '@/lib/services/ai/debugLog';

/**
 * GET /api/v1/admin/ai-logs?limit=50
 * 최근 AI 호출 로그 조회 (admin/developer만)
 *
 * DELETE /api/v1/admin/ai-logs
 * 로그 초기화
 */

async function checkDevOrAdmin(supabase: ReturnType<typeof Object>, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'developer')) {
    throw new AppError('FORBIDDEN', '관리자 또는 개발자 권한이 필요합니다', 403);
  }
  return profile.role as string;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);

    const limit = Math.min(
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? '50')),
      100,
    );

    const logs = getAILogs(limit);

    // 집계 데이터
    const totalCost = logs.reduce((sum, l) => sum + (l.estimatedCostUSD ?? 0), 0);
    const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens ?? 0), 0);
    const successRate = logs.length > 0
      ? Math.round((logs.filter((l) => l.success).length / logs.length) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        logs,
        summary: {
          totalEntries: logs.length,
          totalCostUSD: Math.round(totalCost * 10000) / 10000,
          totalTokens,
          successRate,
        },
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);

    clearAILogs();

    return NextResponse.json({ success: true, data: { cleared: true }, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
