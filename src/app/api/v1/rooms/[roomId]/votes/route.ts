import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

async function verifyRoomMembership(
  supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'],
  roomId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('travel_room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) throw new AppError('FORBIDDEN', '방 멤버만 투표할 수 있습니다', 403);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { roomId } = await params;
    await verifyRoomMembership(supabase, roomId, user.id);

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');

    let query = supabase
      .from('room_votes')
      .select('*')
      .eq('room_id', roomId);

    if (topic) query = query.eq('topic', topic);

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new AppError('DB_ERROR', error.message, 500);

    // Group by topic + value for summary
    const summary: Record<string, Record<string, number>> = {};
    for (const vote of data ?? []) {
      if (!summary[vote.topic]) summary[vote.topic] = {};
      summary[vote.topic][vote.value] = (summary[vote.topic][vote.value] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: { votes: data ?? [], summary },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { roomId } = await params;
    await verifyRoomMembership(supabase, roomId, user.id);

    const body = await request.json();
    const { topic, value } = body as { topic: string; value: string };

    if (!topic || typeof topic !== 'string' || !topic.trim() || topic.length > 100) {
      throw new AppError('VALIDATION_ERROR', 'topic은 1~100자 문자열이어야 합니다', 400);
    }
    if (!value || typeof value !== 'string' || !value.trim() || value.length > 100) {
      throw new AppError('VALIDATION_ERROR', 'value는 1~100자 문자열이어야 합니다', 400);
    }

    // Upsert vote (one vote per user per topic)
    const { data, error } = await supabase
      .from('room_votes')
      .upsert(
        { room_id: roomId, user_id: user.id, topic, value },
        { onConflict: 'room_id,user_id,topic' },
      )
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
