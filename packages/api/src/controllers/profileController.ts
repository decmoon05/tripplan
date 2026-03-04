import { Request, Response } from 'express';
import * as profileService from '../services/profileService';
import { updateProfileSchema, profileCompleteSchema } from '../types/validations';
import { AppError } from '../middlewares/errorHandler';

/** 인증된 사용자 ID를 안전하게 추출 */
function getUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('AUTH_REQUIRED', 401, '인증이 필요합니다.');
  }
  return req.user.userId;
}

/** GET /api/v1/profile */
export async function getProfile(req: Request, res: Response): Promise<void> {
  const profile = await profileService.getProfile(getUserId(req));

  res.status(200).json({
    success: true,
    data: profile,
  });
}

/** PUT /api/v1/profile */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateProfile(getUserId(req), input);

  res.status(200).json({
    success: true,
    data: profile,
  });
}

/** GET /api/v1/profile/questions */
export async function getQuestions(_req: Request, res: Response): Promise<void> {
  const questions = profileService.getQuestions();

  res.status(200).json({
    success: true,
    data: questions,
  });
}

/** POST /api/v1/profile/complete */
export async function completeProfile(req: Request, res: Response): Promise<void> {
  const input = profileCompleteSchema.parse(req.body);
  const result = await profileService.completeProfile(getUserId(req), input);

  res.status(200).json({
    success: true,
    data: result,
    message: '프로파일링이 완료되었습니다.',
  });
}
