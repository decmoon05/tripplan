import { Request, Response } from 'express';
import * as tripService from '../services/tripService';
import { createTripSchema, updateTripPlacesSchema, tripIdParamSchema } from '../types/validations';
import { AppError } from '../middlewares/errorHandler';

/** 인증된 사용자 ID를 안전하게 추출 */
function getUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('AUTH_REQUIRED', 401, '인증이 필요합니다.');
  }
  return req.user.userId;
}

/** POST /api/v1/trips — 여행 생성 + AI 일정 자동 생성 */
export async function createTrip(req: Request, res: Response): Promise<void> {
  const input = createTripSchema.parse(req.body);
  const trip = await tripService.createTrip(getUserId(req), input);

  res.status(201).json({
    success: true,
    data: trip,
    message: 'AI가 일정을 생성했습니다.',
  });
}

/** GET /api/v1/trips — 내 여행 목록 */
export async function listTrips(req: Request, res: Response): Promise<void> {
  const trips = await tripService.listTrips(getUserId(req));

  res.status(200).json({
    success: true,
    data: trips,
  });
}

/** GET /api/v1/trips/:id — 여행 상세 */
export async function getTripDetail(req: Request, res: Response): Promise<void> {
  const { id } = tripIdParamSchema.parse(req.params);
  const trip = await tripService.getTripDetail(getUserId(req), id);

  res.status(200).json({
    success: true,
    data: trip,
  });
}

/** PATCH /api/v1/trips/:id/places — 일정 수정 (날짜별 장소 교체) */
export async function updateTripPlaces(req: Request, res: Response): Promise<void> {
  const { id } = tripIdParamSchema.parse(req.params);
  const input = updateTripPlacesSchema.parse(req.body);
  const updatedDay = await tripService.updateTripPlaces(getUserId(req), id, input);

  res.status(200).json({
    success: true,
    data: updatedDay,
    message: '일정이 수정되었습니다.',
  });
}
