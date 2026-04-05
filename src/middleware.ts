import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Auth Rate Limiting (메모리 기반, 프로덕션에서는 Redis 권장)
const AUTH_RATE_LIMIT = 10; // 15분당 최대 시도 횟수
const AUTH_RATE_WINDOW = 15 * 60 * 1000; // 15분
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = authAttempts.get(ip);

  // 만료된 항목 정리 (1000개 초과 시)
  if (authAttempts.size > 1000) {
    for (const [key, val] of authAttempts) {
      if (now > val.resetAt) authAttempts.delete(key);
    }
  }

  if (!record || now > record.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
    return true;
  }

  if (record.count >= AUTH_RATE_LIMIT) return false;
  record.count++;
  return true;
}

const PROTECTED_PATHS = ['/trips', '/admin', '/dashboard', '/mypage', '/onboarding', '/rooms'];
const PUBLIC_SUBPATHS = ['/rooms/join']; // 초대 링크는 비로그인 접근 허용

function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_SUBPATHS.some((p) => pathname.startsWith(p))) return false;
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase 환경변수 없는 경우
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'CONFIG_ERROR', message: '서버 설정 오류' } },
        { status: 500 },
      );
    }
    // 개발 환경에서 Supabase 없이 동작 허용 (Mock 모드)
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { pathname } = request.nextUrl;

  // Auth Rate Limiting: 로그인/회원가입 경로 POST 요청 제한
  if (pathname.startsWith('/auth') && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkAuthRateLimit(ip)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'RATE_LIMITED', message: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요.' } },
        { status: 429 },
      );
    }
  }

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase 연결 실패 (로컬 Docker 미실행 등) — 개발 환경에서는 통과 허용
    if (process.env.NODE_ENV === 'development') {
      return supabaseResponse;
    }
  }

  // 보호 경로: 미인증 시 로그인 리다이렉트
  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 인증 페이지: 이미 로그인된 경우 대시보드로
  if (pathname.startsWith('/auth') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
