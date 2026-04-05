import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/services/exchange.service';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, recordUsage } from '@/lib/services/rateLimit.service';
import { AppError } from '@/lib/errors/appError';

const ENDPOINT = '/api/v1/exchange';
// ISO 4217 통화 코드: 3~4자 대문자 알파벳
const CURRENCY_RE = /^[A-Z]{3,4}$/;

/**
 * GET /api/v1/exchange?from=KRW&to=JPY
 *
 * 인증 필요 (로그인 사용자만)
 * 하루 최대 20회 (6시간 캐시로 실제 호출은 훨씬 적음)
 */
export async function GET(request: NextRequest) {
  // 인증 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const from = (searchParams.get('from') ?? 'KRW').toUpperCase();
  const to = (searchParams.get('to') ?? 'USD').toUpperCase();

  // 통화 코드 검증 (ISO 4217 형식 — 인젝션 방지)
  if (!CURRENCY_RE.test(from) || !CURRENCY_RE.test(to)) {
    return NextResponse.json({ error: 'Invalid currency code (use ISO 4217, e.g. KRW, JPY)' }, { status: 400 });
  }

  // 레이트 리밋
  try {
    await checkRateLimit(supabase, user.id, ENDPOINT);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 429) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  const result = await getExchangeRate(from, to);

  // 성공 시 사용량 기록
  await recordUsage(supabase, user.id, ENDPOINT).catch(() => {/* 기록 실패는 무시 */});

  return NextResponse.json(result);
}
