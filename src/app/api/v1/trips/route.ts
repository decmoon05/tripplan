import { NextRequest, NextResponse } from 'next/server';
import { createTripSchema } from '@/lib/validators/trip';
import { createTrip, getTrips } from '@/lib/services/trip.service';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export async function GET() {
  try {
    const { supabase, user } = await getAuthUser();
    const trips = await getTrips(supabase, user.id);

    return NextResponse.json({ success: true, data: trips, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    const body = await request.json();
    const validated = createTripSchema.parse(body);
    const trip = await createTrip(supabase, user.id, validated);

    return NextResponse.json(
      { success: true, data: trip, error: null },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
