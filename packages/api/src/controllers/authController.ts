import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { registerSchema, loginSchema, refreshSchema } from '../types/validations';
import { getUserId } from '../utils/auth';

/** POST /api/v1/auth/register */
export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);

  res.status(201).json({
    success: true,
    data: result,
    message: '회원가입이 완료되었습니다.',
  });
}

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/** POST /api/v1/auth/refresh */
export async function refresh(req: Request, res: Response): Promise<void> {
  const input = refreshSchema.parse(req.body);
  const tokens = await authService.refresh(input.refreshToken);

  res.status(200).json({
    success: true,
    data: { tokens },
  });
}

/** POST /api/v1/auth/logout (인증 필수) */
export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(getUserId(req));

  res.status(200).json({
    success: true,
    message: '로그아웃 되었습니다.',
  });
}
