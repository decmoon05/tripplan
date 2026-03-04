import jwt from 'jsonwebtoken';
import { env } from './env';
import { JwtPayload, TokenPair } from '../types/auth';
import { AppError } from '../middlewares/errorHandler';

const JWT_ALGORITHM = 'HS256' as const;
const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';

export function generateTokens(payload: JwtPayload): TokenPair {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as jwt.JwtPayload & JwtPayload;
    return { userId: decoded.userId, email: decoded.email };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 401, '토큰이 만료되었습니다.');
    }
    throw new AppError('INVALID_TOKEN', 401, '유효하지 않은 토큰입니다.');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as jwt.JwtPayload & JwtPayload;
    return { userId: decoded.userId, email: decoded.email };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('REFRESH_TOKEN_EXPIRED', 401, '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.');
    }
    throw new AppError('INVALID_REFRESH_TOKEN', 401, '유효하지 않은 리프레시 토큰입니다.');
  }
}
