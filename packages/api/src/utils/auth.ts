import { Request } from 'express';
import { AppError } from '../middlewares/errorHandler';

/**
 * 인증된 사용자 ID를 안전하게 추출
 * - authenticate 미들웨어를 거친 뒤 사용
 * - req.user가 없으면 401 에러
 */
export function getUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('AUTH_REQUIRED', 401, '인증이 필요합니다.');
  }
  return req.user.userId;
}
