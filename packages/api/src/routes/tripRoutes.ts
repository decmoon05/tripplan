import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { asyncWrapper } from '../utils/asyncWrapper';
import * as tripController from '../controllers/tripController';

const router = Router();

// 모든 여행 API는 인증 필수
router.use(authenticate);

// POST   /api/v1/trips            → 여행 생성 + AI 일정 생성
router.post('/', asyncWrapper(tripController.createTrip));

// GET    /api/v1/trips            → 내 여행 목록
router.get('/', asyncWrapper(tripController.listTrips));

// GET    /api/v1/trips/:id        → 여행 상세
router.get('/:id', asyncWrapper(tripController.getTripDetail));

// PATCH  /api/v1/trips/:id/places → 일정 수정 (날짜별 장소 교체)
router.patch('/:id/places', asyncWrapper(tripController.updateTripPlaces));

export { router as tripRouter };
