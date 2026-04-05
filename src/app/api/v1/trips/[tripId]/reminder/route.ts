/**
 * Trip reminder preference endpoint.
 *
 * NOTE: This stores user preferences only. Actual email sending requires
 * Supabase Edge Functions + Resend integration. To implement email sending:
 * 1. Create a Supabase Edge Function that queries notification_preferences
 * 2. Integrate with Resend (https://resend.com) for email delivery
 * 3. Schedule the Edge Function via pg_cron or Supabase Cron
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/handler';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw new AppError('DB_ERROR', error.message, 500);

    return NextResponse.json({
      success: true,
      data: data
        ? {
            id: data.id,
            tripId: data.trip_id,
            userId: data.user_id,
            enabled: data.enabled,
            reminderDaysBefore: data.reminder_days_before,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }
        : null,
      error: null,
    });
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

    // Verify trip ownership
    const { data: trip } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

    const body = await request.json();
    const { enabled = true, reminderDaysBefore = 3 } = body as {
      enabled?: boolean;
      reminderDaysBefore?: number;
    };

    if (typeof enabled !== 'boolean') {
      throw new AppError('VALIDATION_ERROR', 'enabled는 boolean이어야 합니다', 400);
    }
    if (
      typeof reminderDaysBefore !== 'number' ||
      reminderDaysBefore < 1 ||
      reminderDaysBefore > 30
    ) {
      throw new AppError('VALIDATION_ERROR', 'reminderDaysBefore는 1~30 사이여야 합니다', 400);
    }

    // Upsert preference
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          trip_id: tripId,
          user_id: user.id,
          enabled,
          reminder_days_before: reminderDaysBefore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'trip_id,user_id' },
      )
      .select()
      .single();

    if (error) throw new AppError('DB_ERROR', error.message, 500);

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        tripId: data.trip_id,
        userId: data.user_id,
        enabled: data.enabled,
        reminderDaysBefore: data.reminder_days_before,
        note: 'Email delivery requires Supabase Edge Functions + Resend integration',
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
