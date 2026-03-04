import { Router } from 'express';
import { asyncWrapper } from '../utils/asyncWrapper';
import { authenticate } from '../middlewares/auth';
import * as profileController from '../controllers/profileController';

const router = Router();

// 모든 프로필 라우트는 인증 필수
router.use(authenticate);

// GET /api/v1/profile — 내 프로필 조회
router.get('/', asyncWrapper(profileController.getProfile));

// PUT /api/v1/profile — 프로필 수정
router.put('/', asyncWrapper(profileController.updateProfile));

// GET /api/v1/profile/questions — 프로파일링 질문 목록
router.get('/questions', asyncWrapper(profileController.getQuestions));

// POST /api/v1/profile/complete — 프로파일링 답변 저장
router.post('/complete', asyncWrapper(profileController.completeProfile));

export { router as profileRouter };
