import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';

const createRoomSchema = z.object({
  destination: z.string().min(1).max(100).transform((v) => v.replace(/[<>]/g, '').trim()),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();
    const body = await request.json();
    const { destination, startDate, endDate } = createRoomSchema.parse(body);

    // 방 생성
    const { data: room, error: roomError } = await supabase
      .from('travel_rooms')
      .insert({
        host_id: user.id,
        destination,
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // 호스트를 첫 번째 멤버로 추가
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('mbti_style, travel_pace, budget_range, stamina')
      .eq('user_id', user.id)
      .single();

    await supabase.from('travel_room_members').insert({
      room_id: room.id,
      user_id: user.id,
      display_name: user.email?.split('@')[0] || 'Host',
      mbti_style: profile?.mbti_style || '',
      travel_pace: profile?.travel_pace || 'moderate',
      budget_range: profile?.budget_range || 'moderate',
      stamina: profile?.stamina || 'moderate',
    });

    return NextResponse.json({ success: true, data: room, error: null }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthUser();

    const { data: rooms, error } = await supabase
      .from('travel_rooms')
      .select('*, travel_room_members(count)')
      .or(`host_id.eq.${user.id},id.in.(select room_id from travel_room_members where user_id = '${user.id}')`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: rooms, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
