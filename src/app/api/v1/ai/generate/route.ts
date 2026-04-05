import { NextRequest, NextResponse } from 'next/server';
import { generateTripItems } from '@/lib/services/trip.service';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { generateRequestSchema } from '@/lib/validators/aiGenerate';

const ENDPOINT = '/api/v1/ai/generate';

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    await checkRateLimit(supabase, user.id, ENDPOINT);

    const body = await request.json();
    const { tripId, profile, tripInput, placePreferences } = generateRequestSchema.parse(body);
    const items = await generateTripItems(supabase, tripId, user.id, profile, tripInput, placePreferences);

    await recordUsage(supabase, user.id, ENDPOINT);

    return NextResponse.json(
      { success: true, data: items, error: null },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
