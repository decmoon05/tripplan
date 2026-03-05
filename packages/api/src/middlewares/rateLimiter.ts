import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter 미들웨어 모음
 *
 * 전역:  15분 100회 (IP당)
 * 인증:  15분 10회 (브루트포스 방어)
 * AI:   1시간 5회 (Claude API 비용 보호)
 */

/** 전역 Rate Limiter — 모든 엔드포인트 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 100,
  standardHeaders: true,     // RateLimit-* 헤더 반환
  legacyHeaders: false,      // X-RateLimit-* 헤더 비활성
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    },
  },
});

/** 인증 Rate Limiter — 로그인/회원가입/토큰갱신 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: '인증 요청이 너무 많습니다. 15분 후 다시 시도해주세요.',
    },
  },
});

/** AI Rate Limiter — 여행 생성 (Claude API 호출) */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1시간
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI 일정 생성 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.',
    },
  },
});
