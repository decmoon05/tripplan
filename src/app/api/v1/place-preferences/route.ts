import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getPreferences, upsertPreferences } from '@/lib/services/placePreference.service';
import { handleApiError } from '@/lib/errors/handler';

const upsertSchema = z.object({
  destination: z.string().min(1),
  preferences: z.array(z.object({
    placeName: z.string().min(1),
    preference: z.enum(['exclude', 'revisit', 'new', 'hidden']),
  })),
});

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    const destination = request.nextUrl.searchParams.get('destination');
    if (!destination) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'destination은 필수입니다' } },
        { status: 400 },
      );
    }

    const data = await getPreferences(supabase, user.id, destination);
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    const body = await request.json();
    const { destination, preferences } = upsertSchema.parse(body);

    await upsertPreferences(supabase, user.id, destination, preferences);

    return NextResponse.json(
      { success: true, data: null, error: null },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
