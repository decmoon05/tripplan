import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { checkFeasibility } from '@/lib/services/ai/feasibilityCheck';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { handleApiError } from '@/lib/errors/handler';

const feasibilitySchema = z.object({
  destination: z.string().min(1, 'destination은 필수입니다').max(100).transform((v) => v.replace(/[<>]/g, '').trim()),
  specialNote: z.string().max(500).transform((v) => v.replace(/[<>]/g, '').trim()).default(''),
  interests: z.array(z.string()).optional(),
  customInterests: z.string().max(200).transform((v) => v.replace(/[<>]/g, '').trim()).optional(),
  companion: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    await checkRateLimit(supabase, user.id, '/api/v1/ai/feasibility-check');

    const body = await request.json();
    const { destination, specialNote, interests, customInterests, companion } = feasibilitySchema.parse(body);

    const result = await checkFeasibility({
      destination,
      specialNote,
      interests,
      customInterests,
      companion,
    });

    await recordUsage(supabase, user.id, '/api/v1/ai/feasibility-check');

    return NextResponse.json({ success: true, data: result, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
