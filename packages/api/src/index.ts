import express from 'express';
import cors from 'cors';
import { env } from './utils/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRouter } from './routes/authRoutes';
import { profileRouter } from './routes/profileRoutes';
import { tripRouter } from './routes/tripRoutes';
import { placeRouter } from './routes/placeRoutes';

const app = express();

// 미들웨어
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

app.listen(env.PORT, () => {
  console.log(`TripWise API running: http://localhost:${env.PORT}`);
  console.log(`  Health: http://localhost:${env.PORT}/health`);
  console.log(`  Environment: ${env.NODE_ENV}`);
});
