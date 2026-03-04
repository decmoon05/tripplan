export interface JwtPayload {
  userId: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Express Request에 user 필드 추가
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
