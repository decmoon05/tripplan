import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { getRuntimeConfig, updateRuntimeConfig, resetRuntimeConfig } from '@/lib/services/runtimeConfig';

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

/** GET /api/v1/admin/config — 현재 설정 조회 */
export async function GET() {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);
    return NextResponse.json({ success: true, data: getRuntimeConfig(), error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/v1/admin/config — 설정 변경 */
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);

    const body = await request.json();

    // 유효성 검증
    if (body.aiProvider && !['gemini', 'claude', 'openai', 'mock'].includes(body.aiProvider)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid aiProvider', 400);
    }
    if (body.dailyLimitPerUser !== undefined) {
      const limit = Number(body.dailyLimitPerUser);
      if (isNaN(limit) || limit < 0 || limit > 1000) {
        throw new AppError('VALIDATION_ERROR', 'dailyLimitPerUser: 0~1000', 400);
      }
      body.dailyLimitPerUser = limit;
    }
    if (body.monthlySpendCapUSD !== undefined) {
      const cap = Number(body.monthlySpendCapUSD);
      if (isNaN(cap) || cap < 0 || cap > 10000) {
        throw new AppError('VALIDATION_ERROR', 'monthlySpendCapUSD: 0~10000', 400);
      }
      body.monthlySpendCapUSD = cap;
    }

    const updated = updateRuntimeConfig(body);
    console.log(`[Config] 설정 변경 by ${user.id}:`, JSON.stringify(body));

    return NextResponse.json({ success: true, data: updated, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/v1/admin/config — 기본값으로 초기화 */
export async function DELETE() {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);
    const reset = resetRuntimeConfig();
    return NextResponse.json({ success: true, data: reset, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
