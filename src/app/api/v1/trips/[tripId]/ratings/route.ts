import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    const { data, error } = await supabase
      .from('trip_ratings')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', user.id);

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

    // Verify trip ownership
    const { data: trip } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    const body = await request.json();
    const { itemId, rating, memo } = body as { itemId: string; rating: number; memo?: string };

    if (!itemId) throw new AppError('VALIDATION_ERROR', 'itemId는 필수입니다', 400);
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      throw new AppError('VALIDATION_ERROR', 'rating은 1~5 사이여야 합니다', 400);
    }

    // 메모 새니타이징 (선택, 최대 200자)
    const safeMemo = memo
      ? memo.replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 200) || null
      : null;

    // Upsert rating
    const { data, error } = await supabase
      .from('trip_ratings')
      .upsert(
        { trip_id: tripId, item_id: itemId, user_id: user.id, rating, memo: safeMemo },
        { onConflict: 'trip_id,item_id,user_id' },
      )
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
