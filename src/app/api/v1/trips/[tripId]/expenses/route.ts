import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

const VALID_CATEGORIES = ['숙박', '교통', '식비', '관광', '쇼핑', '기타'];
const VALID_CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'TWD', 'HKD', 'THB', 'VND', 'SGD', 'MYR', 'IDR', 'PHP', 'AUD', 'CAD'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function verifyTripOwnership(
  supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'],
  tripId: string,
  userId: string,
) {
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
      .from('trip_expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

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
    const { category = '기타', amount, currency = 'KRW', memo = null, date = null } = body as {
      category?: string;
      amount: number;
      currency?: string;
      memo?: string | null;
      date?: string | null;
    };

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
      throw new AppError('VALIDATION_ERROR', 'amount는 0 이상 10억 이하의 숫자여야 합니다', 400);
    }
    if (!VALID_CATEGORIES.includes(category)) {
      throw new AppError('VALIDATION_ERROR', '유효하지 않은 카테고리입니다', 400);
    }
    if (!VALID_CURRENCIES.includes(currency)) {
      throw new AppError('VALIDATION_ERROR', '지원하지 않는 통화입니다', 400);
    }
    if (memo !== null && memo !== undefined) {
      if (typeof memo !== 'string' || memo.length > 500) {
        throw new AppError('VALIDATION_ERROR', 'memo는 500자 이하여야 합니다', 400);
      }
    }
    if (date !== null && date !== undefined) {
      if (typeof date !== 'string' || !DATE_RE.test(date) || isNaN(new Date(date).getTime())) {
        throw new AppError('VALIDATION_ERROR', '날짜는 YYYY-MM-DD 형식이어야 합니다', 400);
      }
    }

    const { data, error } = await supabase
      .from('trip_expenses')
      .insert({ trip_id: tripId, category, amount, currency, memo: memo?.trim() ?? null, date: date ?? null })
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data, error: null }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
