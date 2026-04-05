import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getTrip, setShareToken, removeShareToken } from '@/lib/services/trip.service';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { randomBytes } from 'crypto';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase, user } = await getAuthUser();

    const trip = await getTrip(supabase, tripId, user.id);
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    // 이미 공유 토큰이 있으면 반환
    if (trip.shareToken) {
      return NextResponse.json({
        success: true,
        data: { shareToken: trip.shareToken },
        error: null,
      });
    }

    // 새 토큰 생성
    const shareToken = randomBytes(16).toString('hex');
    await setShareToken(supabase, tripId, user.id, shareToken);

    return NextResponse.json({
      success: true,
      data: { shareToken },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase, user } = await getAuthUser();

    const trip = await getTrip(supabase, tripId, user.id);
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    await removeShareToken(supabase, tripId, user.id);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
