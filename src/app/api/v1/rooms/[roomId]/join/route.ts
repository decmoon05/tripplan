import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';

const joinSchema = z.object({
  inviteCode: z.string().min(1),
  displayName: z.string().min(1).max(50),
  mbtiStyle: z.string().default(''),
  travelPace: z.string().default('moderate'),
  budgetRange: z.string().default('moderate'),
  stamina: z.string().default('moderate'),
  specialNote: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { roomId } = await params;
    const body = await request.json();
    const data = joinSchema.parse(body);

    // 방 확인 + 초대 코드 검증
    const { data: room, error: roomError } = await supabase
      .from('travel_rooms')
      .select('id, invite_code, status')
      .eq('id', roomId)
      .single();

    if (roomError || !room) throw new AppError('NOT_FOUND', '방을 찾을 수 없습니다', 404);
    if (room.invite_code !== data.inviteCode) throw new AppError('FORBIDDEN', '초대 코드가 일치하지 않습니다', 403);
    if (room.status !== 'gathering') throw new AppError('VALIDATION_ERROR', '이미 일정이 생성된 방입니다', 400);

    // 멤버 추가 (이미 있으면 업데이트)
    const { error: memberError } = await supabase
      .from('travel_room_members')
      .upsert({
        room_id: roomId,
        user_id: user.id,
        display_name: data.displayName,
        mbti_style: data.mbtiStyle,
        travel_pace: data.travelPace,
        budget_range: data.budgetRange,
        stamina: data.stamina,
        special_note: data.specialNote || null,
      }, { onConflict: 'room_id,user_id' });

    if (memberError) throw memberError;

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
