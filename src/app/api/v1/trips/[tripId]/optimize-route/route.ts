import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { getTrip, getTripItems, updateTripItem } from '@/lib/services/trip.service';
import { optimizeRoute, calculateRouteDistance } from '@/lib/utils/routeOptimizer';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    const trip = await getTrip(supabase, tripId, user.id);
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    const body = await request.json().catch(() => ({})) as { dayNumber?: unknown };
    const dayNumberRaw = body.dayNumber;
    // Type-safe dayNumber: must be a positive integer if provided
    if (dayNumberRaw !== undefined && dayNumberRaw !== null) {
      if (typeof dayNumberRaw !== 'number' || !Number.isInteger(dayNumberRaw) || dayNumberRaw < 1) {
        throw new AppError('VALIDATION_ERROR', 'dayNumber는 1 이상의 정수여야 합니다', 400);
      }
    }
    const dayNumber = dayNumberRaw as number | undefined;

    // Get items - filtered by day if specified
    const allItems = await getTripItems(supabase, tripId);
    const dayItems = dayNumber
      ? allItems.filter((i) => i.dayNumber === dayNumber)
      : allItems;

    if (dayItems.length < 2) {
      return NextResponse.json({
        success: true,
        data: { message: '최적화할 장소가 부족합니다 (최소 2개 필요)', changed: false },
        error: null,
      });
    }

    const originalDistance = calculateRouteDistance(dayItems);
    const optimized = optimizeRoute(dayItems);
    const newDistance = calculateRouteDistance(optimized);

    // Update orderIndex for changed items
    const updates = optimized.filter((item, i) => item.orderIndex !== dayItems[i]?.orderIndex);
    for (const item of updates) {
      await updateTripItem(supabase, item.id, { orderIndex: item.orderIndex }, tripId);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `동선 최적화 완료. 총 이동 거리: ${newDistance}km (이전: ${originalDistance}km)`,
        originalDistance,
        newDistance,
        saved: Math.max(0, originalDistance - newDistance),
        changed: updates.length > 0,
        dayNumber: dayNumber ?? 'all',
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
