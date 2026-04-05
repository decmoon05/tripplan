import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/appError';
import type { UserRole } from '@/types/database';

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AppError('UNAUTHORIZED', '로그인이 필요합니다', 401);
  return { supabase, user };
}

export async function getAdminUser() {
  const { supabase, user } = await getAuthUser();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    throw new AppError('FORBIDDEN', '관리자 권한이 필요합니다', 403);
  }

  return { supabase, user, role: profile.role as UserRole };
}
