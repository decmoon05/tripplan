import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { generateItinerary } from '@/lib/services/ai.service';
import { createTrip, bulkInsertTripItems } from '@/lib/services/trip.service';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { TripItem } from '@/types/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { roomId } = await params;

    // 방 확인 + 호스트 검증
    const { data: room, error: roomError } = await supabase
      .from('travel_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) throw new AppError('NOT_FOUND', '방을 찾을 수 없습니다', 404);
    if (room.host_id !== user.id) throw new AppError('FORBIDDEN', '호스트만 일정을 생성할 수 있습니다', 403);
    if (room.status !== 'gathering') throw new AppError('VALIDATION_ERROR', '이미 일정이 생성되었습니다', 400);

    // 상태 업데이트
    await supabase.from('travel_rooms').update({ status: 'generating', updated_at: new Date().toISOString() }).eq('id', roomId);

    // 멤버 프로필 수집
    const { data: members } = await supabase
      .from('travel_room_members')
      .select('*')
      .eq('room_id', roomId);

    if (!members || members.length === 0) throw new AppError('VALIDATION_ERROR', '멤버가 없습니다', 400);

    // 멤버 프로필 종합
    const profile: FullProfileInput = {
      mbtiStyle: members[0].mbti_style || 'ENFP',
      lifestyle: {
        morningType: 'moderate' as const,
        stamina: getMostCommon(members.map((m: { stamina: string }) => m.stamina)) as 'high' | 'moderate' | 'low',
        adventureLevel: 'balanced' as const,
        photoStyle: 'casual' as const,
      },
      foodPreference: [],
      interests: [],
      customFoodPreference: '',
      customInterests: '',
      travelPace: getMostCommon(members.map((m: { travel_pace: string }) => m.travel_pace)) as FullProfileInput['travelPace'],
      budgetRange: getMostCommon(members.map((m: { budget_range: string }) => m.budget_range)) as FullProfileInput['budgetRange'],
      companion: members.length === 2 ? 'couple' : 'friends',
      specialNote: members.map((m: { special_note: string | null }) => m.special_note).filter(Boolean).join('. '),
      arrivalTime: 'undecided' as const,
      hotelArea: '',
    };

    const tripInput = {
      destination: room.destination,
      startDate: room.start_date,
      endDate: room.end_date,
    };

    // Trip 생성
    const trip = await createTrip(supabase, user.id, tripInput);

    // AI 일정 생성
    const result = await generateItinerary(profile, tripInput);

    // 아이템 저장
    const itemsToInsert: Omit<TripItem, 'id' | 'createdAt'>[] = result.items.map((item) => ({
      ...item,
      tripId: trip.id,
    }));
    await bulkInsertTripItems(supabase, itemsToInsert);

    // Trip 메타데이터 업데이트
    if (result.tripSummary || result.advisories) {
      await supabase.from('trips').update({
        trip_summary: result.tripSummary,
        advisories: result.advisories,
        status: 'generated',
      }).eq('id', trip.id);
    }

    // 방 상태 완료
    await supabase.from('travel_rooms').update({
      status: 'completed',
      trip_id: trip.id,
      updated_at: new Date().toISOString(),
    }).eq('id', roomId);

    return NextResponse.json({ success: true, data: { tripId: trip.id }, error: null });
  } catch (error) {
    // 실패 시 상태 복원
    try {
      const { supabase } = await getAuthUser();
      const { roomId } = await params;
      await supabase.from('travel_rooms').update({ status: 'gathering', updated_at: new Date().toISOString() }).eq('id', roomId);
    } catch { /* ignore */ }
    return handleApiError(error);
  }
}

function getMostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'moderate';
}
