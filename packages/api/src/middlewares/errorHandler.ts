import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../utils/env';

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod 유효성 검증 에러 → 400
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: messages.join(', '),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // 예상치 못한 에러는 항상 서버 로그에 기록
  console.error('[INTERNAL_ERROR]', err);

  // 운영 환경에서는 내부 에러 상세 숨김
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'development' ? err.message : '서버 오류가 발생했습니다.',
    },
  });
}
