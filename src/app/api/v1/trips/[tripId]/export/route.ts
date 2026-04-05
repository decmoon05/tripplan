import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { getTrip, getTripItems } from '@/lib/services/trip.service';
import { generateICS } from '@/lib/utils/ics';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    const trip = await getTrip(supabase, tripId, user.id);
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'ics';

    if (format !== 'ics') {
      throw new AppError('VALIDATION_ERROR', '지원하지 않는 형식입니다. format=ics만 지원합니다', 400);
    }

    const items = await getTripItems(supabase, tripId);
    const icsContent = generateICS(trip, items);

    // Sanitize filename: keep alphanumeric, Korean chars, hyphens only, limit length
    const safeDest = (trip.destination || 'trip')
      .replace(/[^\w\s가-힣-]/g, '')  // strip special chars except Korean/alphanumeric
      .replace(/\s+/g, '-')
      .substring(0, 40);
    const filename = `tripplan-${safeDest}-${trip.startDate}.ics`;

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
