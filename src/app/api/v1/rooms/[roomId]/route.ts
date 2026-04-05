import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { supabase } = await getAuthUser();
    const { roomId } = await params;

    const { data: room, error: roomError } = await supabase
      .from('travel_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) throw new AppError('NOT_FOUND', '방을 찾을 수 없습니다', 404);

    const { data: members, error: membersError } = await supabase
      .from('travel_room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at');

    if (membersError) throw membersError;

    return NextResponse.json({
      success: true,
      data: { ...room, members: members || [] },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
