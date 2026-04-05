import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import type { UserRole } from '@/types/database';

const VALID_ROLES: UserRole[] = ['user', 'developer', 'admin'];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new AppError('CONFIG_ERROR', 'Service role key가 설정되지 않았습니다', 500);
  }
  return createClient(url, key);
}

export async function GET() {
  try {
    const { supabase } = await getAdminUser();
    const serviceClient = getServiceClient();

    // 전체 프로필 조회 (admin RLS로 가능)
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, role, plan, created_at')
      .order('created_at', { ascending: false });

    if (profileError) throw profileError;

    // auth.users에서 이메일 조회 (service role 필요)
    const { data: { users: authUsers }, error: authError } = await serviceClient.auth.admin.listUsers();
    if (authError) throw authError;

    const emailMap = new Map(authUsers.map((u) => [u.id, u.email]));

    // 오늘 사용량 조회
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: usageData } = await supabase
      .from('api_usage_log')
      .select('user_id')
      .gte('created_at', todayStart.toISOString());

    const usageCount = new Map<string, number>();
    usageData?.forEach((row) => {
      usageCount.set(row.user_id, (usageCount.get(row.user_id) ?? 0) + 1);
    });

    // 총 여행 수 조회
    const { data: tripsData } = await supabase
      .from('trips')
      .select('user_id');

    const tripCount = new Map<string, number>();
    tripsData?.forEach((row) => {
      tripCount.set(row.user_id, (tripCount.get(row.user_id) ?? 0) + 1);
    });

    const users = (profiles ?? []).map((p) => ({
      id: p.user_id,
      email: emailMap.get(p.user_id) ?? '(알 수 없음)',
      role: p.role as UserRole,
      plan: (p.plan || 'free') as string,
      todayUsage: usageCount.get(p.user_id) ?? 0,
      totalTrips: tripCount.get(p.user_id) ?? 0,
      createdAt: p.created_at,
    }));

    return NextResponse.json({ success: true, data: { users }, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

const VALID_PLANS = ['free', 'pro', 'team'];

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getAdminUser();

    const body = await request.json();
    const { userId, role, plan } = body as { userId: string; role?: UserRole; plan?: string };

    if (!userId) {
      throw new AppError('VALIDATION_ERROR', 'userId가 필요합니다', 400);
    }
    if (!role && !plan) {
      throw new AppError('VALIDATION_ERROR', 'role 또는 plan이 필요합니다', 400);
    }

    const updates: Record<string, string> = {};

    if (role) {
      if (!VALID_ROLES.includes(role)) {
        throw new AppError('VALIDATION_ERROR', `유효하지 않은 역할: ${role}`, 400);
      }
      if (userId === user.id) {
        throw new AppError('FORBIDDEN', '자기 자신의 역할은 변경할 수 없습니다', 403);
      }
      updates.role = role;
    }

    if (plan) {
      if (!VALID_PLANS.includes(plan)) {
        throw new AppError('VALIDATION_ERROR', `유효하지 않은 요금제: ${plan}`, 400);
      }
      updates.plan = plan;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true, data: { userId, ...updates }, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
