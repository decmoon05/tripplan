import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';

const MSG_WRITE_ENDPOINT = '/api/v1/rooms/messages/write';

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
  if (!data) throw new AppError('FORBIDDEN', '방 멤버만 메시지를 볼 수 있습니다', 403);
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
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const before = searchParams.get('before'); // cursor-based pagination

    let query = supabase
      .from('room_messages')
      .select('*, travel_room_members!inner(display_name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      // Validate ISO 8601 timestamp to prevent injection / unexpected DB behavior
      if (!/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/.test(before) || isNaN(new Date(before).getTime())) {
        throw new AppError('VALIDATION_ERROR', 'before must be a valid ISO 8601 timestamp', 400);
      }
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw new AppError('DB_ERROR', error.message, 500);

    const messages = (data ?? []).reverse().map((msg) => ({
      id: msg.id,
      roomId: msg.room_id,
      userId: msg.user_id,
      content: msg.content,
      displayName: (msg.travel_room_members as unknown as { display_name: string })?.display_name ?? '알 수 없음',
      createdAt: msg.created_at,
    }));

    return NextResponse.json({ success: true, data: messages, error: null });
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
    await checkRateLimit(supabase, user.id, MSG_WRITE_ENDPOINT);

    const body = await request.json();
    const { content } = body as { content: string };

    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new AppError('VALIDATION_ERROR', 'content는 필수입니다', 400);
    }
    if (content.length > 1000) {
      throw new AppError('VALIDATION_ERROR', '메시지는 1000자 이하여야 합니다', 400);
    }

    const { data, error } = await supabase
      .from('room_messages')
      .insert({ room_id: roomId, user_id: user.id, content: content.trim() })
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    await recordUsage(supabase, user.id, MSG_WRITE_ENDPOINT).catch(() => {});
    return NextResponse.json({ success: true, data, error: null }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
