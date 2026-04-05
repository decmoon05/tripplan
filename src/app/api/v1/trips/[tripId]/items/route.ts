import { NextRequest, NextResponse } from 'next/server';
import {
  getTrip,
  getTripItems,
  createTripItem,
  updateTripItem,
  deleteTripItem,
} from '@/lib/services/trip.service';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { createTripItemSchema, updateTripItemSchema } from '@/lib/validators/tripItem';

async function verifyTripOwnership(tripId: string) {
  const { supabase, user } = await getAuthUser();
  const trip = await getTrip(supabase, tripId, user.id);
  if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);
  return { supabase, user, trip };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase } = await verifyTripOwnership(tripId);

    const items = await getTripItems(supabase, tripId);
    return NextResponse.json({ success: true, data: items, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase } = await verifyTripOwnership(tripId);

    const body = await request.json();
    const validated = createTripItemSchema.parse(body);
    const item = await createTripItem(supabase, {
      ...validated,
      tripId,
      latitude: null,
      longitude: null,
      currency: (body.currency as string) || 'KRW',
      priceConfidence: (body.priceConfidence as 'confirmed' | 'estimated') || 'estimated',
      reasonTags: [],
      address: (body.address as string) || null,
      businessHours: (body.businessHours as string) || null,
      closedDays: (body.closedDays as string) || null,
      transitMode: (body.transitMode as string) || null,
      transitDurationMin: typeof body.transitDurationMin === 'number' ? body.transitDurationMin : null,
      transitSummary: (body.transitSummary as string) || null,
      verified: true,
      googlePlaceId: (body.googlePlaceId as string) || null,
      subActivities: null,
    });

    return NextResponse.json(
      { success: true, data: item, error: null },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase } = await verifyTripOwnership(tripId);

    const body = await request.json();
    const { itemId, ...updates } = updateTripItemSchema.parse(body);

    const item = await updateTripItem(supabase, itemId, updates, tripId);

    return NextResponse.json({ success: true, data: item, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { supabase } = await verifyTripOwnership(tripId);

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) throw new AppError('VALIDATION_ERROR', 'itemId는 필수입니다', 400);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(itemId)) throw new AppError('VALIDATION_ERROR', 'itemId 형식이 올바르지 않습니다', 400);

    await deleteTripItem(supabase, itemId, tripId);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
