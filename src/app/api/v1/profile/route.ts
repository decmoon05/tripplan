import { NextRequest, NextResponse } from 'next/server';
import { getProfile, upsertProfile } from '@/lib/services/profile.service';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { profileSchema } from '@/lib/validators/profile';

export async function GET() {
  try {
    const { supabase, user } = await getAuthUser();
    const profile = await getProfile(supabase, user.id);

    return NextResponse.json({ success: true, data: profile, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    const body = await request.json();
    const validated = profileSchema.parse(body);
    const profile = await upsertProfile(supabase, user.id, validated);

    return NextResponse.json({ success: true, data: profile, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
