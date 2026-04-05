import { NextResponse } from 'next/server';

const startTime = Date.now();

/** GET /api/health — 공개 헬스체크 (인증 불필요) */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeMs: Date.now() - startTime,
  });
}
