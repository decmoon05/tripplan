import { NextResponse } from 'next/server';
import { ZodError } from 'zod/v4';
import { AppError } from './appError';
import { logger } from './logger';
import { logError } from './errorStore';

export function handleApiError(error: unknown, endpoint?: string): NextResponse {
  if (error instanceof AppError) {
    // 4xx 에러도 기록 (429, 403 등 운영에 유의미)
    if (error.statusCode >= 400) {
      logError({
        endpoint: endpoint ?? 'unknown',
        statusCode: error.statusCode,
        errorCode: error.code,
        message: error.message,
      });
    }
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: error.code, message: error.message },
      },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    logError({
      endpoint: endpoint ?? 'unknown',
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: error.issues.map((i) => i.message).join(', '),
    });
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((i) => i.message).join(', '),
        },
      },
      { status: 400 },
    );
  }

  logger.error('Unexpected error', error);
  logError({
    endpoint: endpoint ?? 'unknown',
    statusCode: 500,
    errorCode: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : '서버 오류',
  });

  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
    },
    { status: 500 },
  );
}
