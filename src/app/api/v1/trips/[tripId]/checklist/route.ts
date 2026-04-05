import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';

const WRITE_ENDPOINT = '/api/v1/trips/checklist/write';

async function verifyTripOwnership(supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'], tripId: string, userId: string) {
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;
    await verifyTripOwnership(supabase, tripId, user.id);

    const { data, error } = await supabase
      .from('trip_checklists')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data: data ?? [], error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;
    await verifyTripOwnership(supabase, tripId, user.id);

    const body = await request.json();
    const { item, category = '기타' } = body as { item: string; category?: string };

    await checkRateLimit(supabase, user.id, WRITE_ENDPOINT);

    if (!item || typeof item !== 'string' || !item.trim()) {
      throw new AppError('VALIDATION_ERROR', 'item은 필수입니다', 400);
    }
    if (item.length > 200) {
      throw new AppError('VALIDATION_ERROR', '준비물 이름은 200자 이하여야 합니다', 400);
    }

    const validCategories = ['서류', '의류', '전자기기', '의약품', '기타'];
    if (!validCategories.includes(category)) {
      throw new AppError('VALIDATION_ERROR', '유효하지 않은 카테고리입니다', 400);
    }

    const { data, error } = await supabase
      .from('trip_checklists')
      .insert({ trip_id: tripId, item: item.trim(), category, checked: false })
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    await recordUsage(supabase, user.id, WRITE_ENDPOINT).catch(() => {});
    return NextResponse.json({ success: true, data, error: null }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
