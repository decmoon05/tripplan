import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 헬스체크 (서버가 살아있는지 확인)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: 라우터 추가 예정
// app.use('/api/v1/auth', authRouter);
// app.use('/api/v1/profile', profileRouter);
// app.use('/api/v1/trips', tripRouter);

app.listen(PORT, () => {
  console.log(`✅ TripWise API 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   헬스체크: http://localhost:${PORT}/health`);
});
