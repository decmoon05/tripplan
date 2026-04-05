import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { expandPlace } from '@/lib/services/ai/expandPlace';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { handleApiError } from '@/lib/errors/handler';

const expandSchema = z.object({
  placeName: z.string().min(1),
  category: z.string().min(1),
  destination: z.string().min(1),
  itemId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    await checkRateLimit(supabase, user.id, '/api/v1/ai/expand');

    const body = await request.json();
    const { placeName, category, destination, itemId } = expandSchema.parse(body);

    const subItems = await expandPlace(placeName, category, destination);

    // itemId가 있으면 소유권 검증 후 sub_activities를 DB에 캐시
    if (itemId && subItems.length > 0) {
      const { data: item } = await supabase
        .from('trip_items')
        .select('id, trip_id, trips!inner(user_id)')
        .eq('id', itemId)
        .single();

      if (item) {
        await supabase
          .from('trip_items')
          .update({ sub_activities: subItems })
          .eq('id', itemId);
      }
    }

    await recordUsage(supabase, user.id, '/api/v1/ai/expand');

    return NextResponse.json({ success: true, data: subItems, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
