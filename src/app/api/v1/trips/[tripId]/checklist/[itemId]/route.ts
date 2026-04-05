import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

async function verifyItemOwnership(
  supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'],
  tripId: string,
  itemId: string,
  userId: string,
) {
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

  const { data: checklistItem } = await supabase
    .from('trip_checklists')
    .select('id')
    .eq('id', itemId)
    .eq('trip_id', tripId)
    .maybeSingle();
  if (!checklistItem) throw new AppError('NOT_FOUND', '체크리스트 항목을 찾을 수 없습니다', 404);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; itemId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId, itemId } = await params;
    await verifyItemOwnership(supabase, tripId, itemId, user.id);

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.checked === 'boolean') updates.checked = body.checked;
    if (typeof body.item === 'string' && body.item.trim()) updates.item = body.item.trim();
    if (typeof body.category === 'string') {
      const validCategories = ['서류', '의류', '전자기기', '의약품', '기타'];
      if (!validCategories.includes(body.category)) {
        throw new AppError('VALIDATION_ERROR', '유효하지 않은 카테고리입니다', 400);
      }
      updates.category = body.category;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('VALIDATION_ERROR', '업데이트할 내용이 없습니다', 400);
    }

    const { data, error } = await supabase
      .from('trip_checklists')
      .update(updates)
      .eq('id', itemId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string; itemId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId, itemId } = await params;
    await verifyItemOwnership(supabase, tripId, itemId, user.id);

    const { error } = await supabase
      .from('trip_checklists')
      .delete()
      .eq('id', itemId)
      .eq('trip_id', tripId);

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
