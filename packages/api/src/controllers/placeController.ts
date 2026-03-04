import { Request, Response } from 'express';
import * as placeService from '../services/placeService';
import { placeIdParamSchema, placeSearchQuerySchema } from '../types/validations';
import { AppError } from '../middlewares/errorHandler';

/** 인증된 사용자 ID를 안전하게 추출 */
function getUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('AUTH_REQUIRED', 401, '인증이 필요합니다.');
  }
  return req.user.userId;
}

/**
 * GET /api/v1/places/search
 * 장소 검색 (Google Text Search 또는 캐시 폴백)
 */
export async function searchPlaces(req: Request, res: Response): Promise<void> {
  getUserId(req); // 인증 확인 (userId 자체는 검색에 불필요하나 인증은 필수)

  const input = placeSearchQuerySchema.parse(req.query);
  const result = await placeService.searchPlaces(input);

  res.status(200).json({
    success: true,
    data: {
      places: result.places,
      source: result.source,
      count: result.count,
    },
  });
}

/**
 * GET /api/v1/places/:id
 * 장소 상세 조회 (Google Details 또는 캐시 폴백)
 */
export async function getPlaceDetail(req: Request, res: Response): Promise<void> {
  getUserId(req); // 인증 확인

  const { id } = placeIdParamSchema.parse(req.params);
  const place = await placeService.getPlaceDetail(id);

  res.status(200).json({
    success: true,
    data: place,
  });
}
