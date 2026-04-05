import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

const BUCKET = 'trip-photos';

/**
 * DELETE /api/v1/trips/[tripId]/photos/[photoId]
 * 사진 삭제: DB 레코드 + Storage 파일 동시 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string; photoId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId, photoId } = await params;

    // 사진 조회 + 소유권 확인 (trip 소유자 본인만)
    const { data: photo, error: fetchError } = await supabase
      .from('trip_photos')
      .select('id, storage_path, trip_id')
      .eq('id', photoId)
      .eq('trip_id', tripId)
      .maybeSingle();

    if (fetchError) throw new AppError('DB_ERROR', fetchError.message, 500);
    if (!photo) throw new AppError('NOT_FOUND', '사진을 찾을 수 없습니다', 404);

    // 여행 소유권 확인
    const { data: trip } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!trip) throw new AppError('FORBIDDEN', '삭제 권한이 없습니다', 403);

    // Storage 파일 삭제 (실패해도 DB는 삭제 — orphan 파일보다 broken link가 낫다)
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([photo.storage_path]);

    if (storageError) {
      // Storage 오류는 경고만 — bucket 미생성 등의 경우
      console.warn('[photos] Storage delete failed:', storageError.message);
    }

    // DB 레코드 삭제
    const { error: deleteError } = await supabase
      .from('trip_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) throw new AppError('DB_ERROR', deleteError.message, 500);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/trips/[tripId]/photos/[photoId]
 * 사진 캡션/날짜 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; photoId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId, photoId } = await params;

    // 여행 소유권 확인
    const { data: trip } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!trip) throw new AppError('FORBIDDEN', '수정 권한이 없습니다', 403);

    const body = await request.json();
    const { caption, dayNumber } = body as { caption?: string; dayNumber?: number };

    if (caption !== undefined && typeof caption === 'string' && caption.length > 500) {
      throw new AppError('VALIDATION_ERROR', 'caption은 500자 이하여야 합니다', 400);
    }

    const updates: Record<string, unknown> = {};
    if (caption !== undefined) updates.caption = caption?.trim() ?? null;
    if (dayNumber !== undefined) updates.day_number = dayNumber;

    const { data, error } = await supabase
      .from('trip_photos')
      .update(updates)
      .eq('id', photoId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
