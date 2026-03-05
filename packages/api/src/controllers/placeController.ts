import { Request, Response } from 'express';
import { z } from 'zod';
import * as placeService from '../services/placeService';
import * as googlePlacesService from '../services/googlePlacesService';
import { placeIdParamSchema, placeSearchQuerySchema } from '../types/validations';
import { AppError } from '../middlewares/errorHandler';
import { getUserId } from '../utils/auth';

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

const photoRefSchema = z.object({
  ref: z.string().min(1, '사진 참조가 필요합니다.').max(500),
});

/**
 * GET /api/v1/places/photo?ref=...
 * Google Places 사진 프록시 (API 키를 클라이언트에 노출하지 않음)
 */
export async function getPlacePhoto(req: Request, res: Response): Promise<void> {
  getUserId(req); // 인증 확인

  const { ref } = photoRefSchema.parse(req.query);

  // ref 형식 검증: "places/ChIJ.../photos/AUc7..." 패턴만 허용
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(ref)) {
    throw new AppError('INVALID_PHOTO_REF', 400, '유효하지 않은 사진 참조입니다.');
  }

  const googleUrl = googlePlacesService.buildGooglePhotoUrl(ref);
  const response = await fetch(googleUrl, { redirect: 'follow' });

  if (!response.ok) {
    throw new AppError('PHOTO_FETCH_FAILED', 502, '사진을 가져올 수 없습니다.');
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24시간 브라우저 캐시

  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}
