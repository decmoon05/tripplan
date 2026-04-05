/**
 * Trip photos API
 *
 * NOTE: Supabase Storage bucket 'trip-photos' must be created manually
 * in the Supabase dashboard. Photos are stored in the bucket and referenced
 * by path in the trip_photos table.
 *
 * Upload flow:
 * 1. Client calls POST /photos with { filename, contentType, dayNumber?, caption? }
 * 2. Server returns a signed upload URL
 * 3. Client uploads the file directly to Supabase Storage
 * 4. Client calls POST /photos/confirm with the storage_path to save to DB
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

const BUCKET = 'trip-photos';

async function verifyTripOwnership(
  supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'],
  tripId: string,
  userId: string,
) {
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;
    await verifyTripOwnership(supabase, tripId, user.id);

    const { searchParams } = new URL(request.url);
    const dayNumber = searchParams.get('dayNumber');

    let query = supabase
      .from('trip_photos')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (dayNumber) {
      query = query.eq('day_number', parseInt(dayNumber));
    }

    const { data, error } = await query;
    if (error) throw new AppError('DB_ERROR', error.message, 500);

    // Generate public URLs for each photo
    const photosWithUrls = (data ?? []).map((photo) => {
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(photo.storage_path);
      return {
        id: photo.id,
        tripId: photo.trip_id,
        storagePath: photo.storage_path,
        publicUrl: urlData.publicUrl,
        caption: photo.caption,
        dayNumber: photo.day_number,
        createdAt: photo.created_at,
      };
    });

    return NextResponse.json({ success: true, data: photosWithUrls, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;
    await verifyTripOwnership(supabase, tripId, user.id);

    const body = await request.json();
    const { filename, contentType, dayNumber, caption, action } = body as {
      filename?: string;
      contentType?: string;
      dayNumber?: number;
      caption?: string;
      action?: 'confirm';
      storagePath?: string;
    };

    // Validate caption length
    if (caption !== undefined && caption !== null) {
      if (typeof caption !== 'string' || caption.length > 500) {
        throw new AppError('VALIDATION_ERROR', 'caption은 500자 이하여야 합니다', 400);
      }
    }

    // Action: confirm upload — save to DB
    if (action === 'confirm') {
      const { storagePath } = body as { storagePath: string };
      if (!storagePath || typeof storagePath !== 'string' || storagePath.length > 500) {
        throw new AppError('VALIDATION_ERROR', 'storagePath는 필수입니다', 400);
      }
      // Ensure storagePath starts with user's own directory (prevent path traversal)
      if (!storagePath.startsWith(`${user.id}/`)) {
        throw new AppError('FORBIDDEN', '잘못된 storage 경로입니다', 403);
      }

      const { data, error } = await supabase
        .from('trip_photos')
        .insert({
          trip_id: tripId,
          storage_path: storagePath,
          caption: caption ?? null,
          day_number: dayNumber ?? null,
        })
        .select()
        .single();

      if (error) throw new AppError('DB_ERROR', error.message, 500);
      return NextResponse.json({ success: true, data, error: null }, { status: 201 });
    }

    // Default: create signed upload URL
    if (!filename) throw new AppError('VALIDATION_ERROR', 'filename은 필수입니다', 400);

    // Validate content type against allowed image MIME types
    const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (contentType && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new AppError('VALIDATION_ERROR', 'jpg, png, gif, webp 이미지만 업로드 가능합니다', 400);
    }

    // Validate and sanitize file extension (no double extensions)
    const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const rawExt = (filename.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTS.includes(rawExt)) {
      throw new AppError('VALIDATION_ERROR', 'jpg, png, gif, webp 파일만 업로드 가능합니다', 400);
    }
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const storagePath = `${user.id}/${tripId}/${Date.now()}.${ext}`;

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError) {
      // Bucket may not exist yet
      throw new AppError(
        'STORAGE_ERROR',
        `사진 업로드 URL 생성 실패: ${signedError.message}. Supabase Storage에 '${BUCKET}' 버킷을 먼저 생성해주세요.`,
        500,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: signedData.signedUrl,
        storagePath,
        token: signedData.token,
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
