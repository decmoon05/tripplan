// Phase 1: 간단한 로거 래퍼. Phase 2에서 pino/winston 또는 Sentry로 교체
export const logger = {
  error: (message: string, error?: unknown) => {
    // 에러는 모든 환경에서 기록 (프로덕션 사고 추적 필수)
    // TODO: Phase 2 - Sentry 등 외부 로깅 서비스 연동
    console.error(`[ERROR] ${message}`, error instanceof Error ? error.message : error);
  },
  warn: (message: string, data?: unknown) => {
    // 경고도 모든 환경에서 기록
    console.warn(`[WARN] ${message}`, data);
  },
  info: (message: string, data?: unknown) => {
    // 정보성 로그는 개발 환경에서만
    if (process.env.NODE_ENV === 'development') {
      console.info(`[INFO] ${message}`, data);
    }
  },
};
