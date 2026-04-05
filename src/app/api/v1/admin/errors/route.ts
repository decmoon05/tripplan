import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { getErrors, clearErrors, getErrorStats } from '@/lib/errors/errorStore';

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

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '50'), 200);
    return NextResponse.json({
      success: true,
      data: { errors: getErrors(limit), stats: getErrorStats() },
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
    clearErrors();
    return NextResponse.json({ success: true, data: { cleared: true }, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
