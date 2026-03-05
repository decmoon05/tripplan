import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './utils/env';
import { prisma } from './utils/prisma';
import { errorHandler } from './middlewares/errorHandler';
import { globalLimiter } from './middlewares/rateLimiter';
import { authRouter } from './routes/authRoutes';
import { profileRouter } from './routes/profileRoutes';
import { tripRouter } from './routes/tripRoutes';
import { placeRouter } from './routes/placeRoutes';

const app = express();

// 보안 헤더 (X-Powered-By 제거, XSS/Clickjacking 방어 등)
app.use(helmet());

// Rate Limiting (IP당 15분 100회)
app.use(globalLimiter);

// CORS
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? ['https://tripwise.app']
    : true,  // dev에서 모든 origin 허용하되 credentials 호환
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
  });
});

// API 라우터
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/trips', tripRouter);
app.use('/api/v1/places', placeRouter);

// 에러 핸들러 (반드시 마지막 미들웨어)
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`TripWise API running: http://localhost:${env.PORT}`);
  console.log(`  Health: http://localhost:${env.PORT}/health`);
  console.log(`  Environment: ${env.NODE_ENV}`);
});

// --- Graceful Shutdown ---
const SHUTDOWN_TIMEOUT_MS = 10_000; // 10초 타임아웃

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] 서버 종료 시작...`);

  // 1. 새 요청 거부
  server.close(() => {
    console.log('[SHUTDOWN] HTTP 서버 종료 완료');
  });

  // 2. Prisma 연결 종료
  try {
    await prisma.$disconnect();
    console.log('[SHUTDOWN] DB 연결 종료 완료');
  } catch (err) {
    console.error('[SHUTDOWN] DB 연결 종료 실패:', err instanceof Error ? err.message : 'Unknown error');
  }

  console.log('[SHUTDOWN] 서버 종료 완료');
  process.exit(0);
}

// 강제 종료 안전장치
function forceShutdown(): void {
  console.error(`[SHUTDOWN] ${SHUTDOWN_TIMEOUT_MS}ms 타임아웃 — 강제 종료`);
  process.exit(1);
}

process.on('SIGTERM', () => {
  setTimeout(forceShutdown, SHUTDOWN_TIMEOUT_MS);
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  setTimeout(forceShutdown, SHUTDOWN_TIMEOUT_MS);
  gracefulShutdown('SIGINT');
});
