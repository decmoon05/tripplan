import { Router } from 'express';
import { asyncWrapper } from '../utils/asyncWrapper';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import * as authController from '../controllers/authController';

const router = Router();

// 인증 엔드포인트 Rate Limiting (15분 10회)
router.use(authLimiter);

// POST /api/v1/auth/register — 회원가입
router.post('/register', asyncWrapper(authController.register));

// POST /api/v1/auth/login — 로그인
router.post('/login', asyncWrapper(authController.login));

// POST /api/v1/auth/refresh — 토큰 갱신 (회전 방식)
router.post('/refresh', asyncWrapper(authController.refresh));

// POST /api/v1/auth/logout — 로그아웃 (인증 필수, 모든 리프레시 토큰 폐기)
router.post('/logout', authenticate, asyncWrapper(authController.logout));

export { router as authRouter };
