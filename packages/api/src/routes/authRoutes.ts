import { Router } from 'express';
import { asyncWrapper } from '../utils/asyncWrapper';
import * as authController from '../controllers/authController';

const router = Router();

// POST /api/v1/auth/register — 회원가입
router.post('/register', asyncWrapper(authController.register));

// POST /api/v1/auth/login — 로그인
router.post('/login', asyncWrapper(authController.login));

// POST /api/v1/auth/refresh — 토큰 갱신
router.post('/refresh', asyncWrapper(authController.refresh));

export { router as authRouter };
