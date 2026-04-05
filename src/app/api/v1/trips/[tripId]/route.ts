import { NextRequest, NextResponse } from 'next/server';
import { getTrip, updateTrip, deleteTrip } from '@/lib/services/trip.service';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { updateTripSchema } from '@/lib/validators/tripItem';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    const trip = await getTrip(supabase, tripId, user.id);
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    return NextResponse.json({ success: true, data: trip, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    const body = await request.json();
    const validated = updateTripSchema.parse(body);
    const trip = await updateTrip(supabase, tripId, user.id, validated);

    return NextResponse.json({ success: true, data: trip, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    await deleteTrip(supabase, tripId, user.id);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
