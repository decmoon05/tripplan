import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

const VALID_CATEGORIES = ['숙박', '교통', '식비', '관광', '쇼핑', '기타'];

async function verifyExpenseOwnership(
  supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'],
  tripId: string,
  expenseId: string,
  userId: string,
) {
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

  const { data: expense } = await supabase
    .from('trip_expenses')
    .select('id')
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .maybeSingle();
  if (!expense) throw new AppError('NOT_FOUND', '지출 항목을 찾을 수 없습니다', 404);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId, expenseId } = await params;
    await verifyExpenseOwnership(supabase, tripId, expenseId, user.id);

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(body.category)) {
        throw new AppError('VALIDATION_ERROR', '유효하지 않은 카테고리입니다', 400);
      }
      updates.category = body.category;
    }
    if (body.amount !== undefined) {
      if (typeof body.amount !== 'number' || body.amount < 0) {
        throw new AppError('VALIDATION_ERROR', 'amount는 0 이상의 숫자여야 합니다', 400);
      }
      updates.amount = body.amount;
    }
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.memo !== undefined) updates.memo = body.memo;
    if (body.date !== undefined) updates.date = body.date;

    if (Object.keys(updates).length === 0) {
      throw new AppError('VALIDATION_ERROR', '업데이트할 내용이 없습니다', 400);
    }

    const { data, error } = await supabase
      .from('trip_expenses')
      .update(updates)
      .eq('id', expenseId)
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
  { params }: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId, expenseId } = await params;
    await verifyExpenseOwnership(supabase, tripId, expenseId, user.id);

    const { error } = await supabase
      .from('trip_expenses')
      .delete()
      .eq('id', expenseId)
      .eq('trip_id', tripId);

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
