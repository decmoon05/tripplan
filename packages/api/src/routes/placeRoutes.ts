import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { asyncWrapper } from '../utils/asyncWrapper';
import * as placeController from '../controllers/placeController';

const router = Router();

// 모든 장소 API는 인증 필수
router.use(authenticate);

// GET    /api/v1/places/search   → 장소 검색 (반드시 /:id보다 위에 정의)
router.get('/search', asyncWrapper(placeController.searchPlaces));

// GET    /api/v1/places/photo    → 사진 프록시 (API 키 보호, /:id보다 위에 정의)
router.get('/photo', asyncWrapper(placeController.getPlacePhoto));

// GET    /api/v1/places/:id      → 장소 상세
router.get('/:id', asyncWrapper(placeController.getPlaceDetail));

export { router as placeRouter };
