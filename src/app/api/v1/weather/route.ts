import { NextRequest, NextResponse } from 'next/server';
import { getWeatherForecast } from '@/lib/services/weather.service';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { AppError } from '@/lib/errors/appError';

const ENDPOINT = '/api/v1/weather';
// 목적지: 영문/한글/공백/하이픈/쉼표, 최대 100자
const DESTINATION_RE = /^[\w\s\-,.가-힣]{1,100}$/u;
// 날짜: YYYY-MM-DD
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/v1/weather?destination=Tokyo&startDate=2026-04-01&days=5
 *
 * 인증 필요 (로그인 사용자만)
 * 하루 최대 20회 (캐시 덕분에 실제 API 호출은 훨씬 적음)
 * Open-Meteo API 사용 (무료, 키 불필요)
 */
export async function GET(request: NextRequest) {
  // 인증 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const destination = searchParams.get('destination') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const daysRaw = Number(searchParams.get('days') ?? '5');

  // 입력값 검증
  if (!destination || !DESTINATION_RE.test(destination)) {
    return NextResponse.json({ error: 'Invalid destination' }, { status: 400 });
  }
  if (startDate && !DATE_RE.test(startDate)) {
    return NextResponse.json({ error: 'Invalid startDate format (YYYY-MM-DD)' }, { status: 400 });
  }
  const days = Math.max(1, Math.min(16, isNaN(daysRaw) ? 5 : daysRaw));

  // 레이트 리밋
  try {
    await checkRateLimit(supabase, user.id, ENDPOINT);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 429) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  const effectiveDate = startDate || new Date().toISOString().split('T')[0];
  const forecast = await getWeatherForecast(destination, effectiveDate, days);

  if (!forecast) {
    return NextResponse.json({ error: 'Weather data unavailable' }, { status: 503 });
  }

  // 성공 시 사용량 기록
  await recordUsage(supabase, user.id, ENDPOINT).catch(() => {/* 기록 실패는 무시 */});

  return NextResponse.json(forecast);
}
