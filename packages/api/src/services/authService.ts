import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import * as userRepo from '../repositories/userRepository';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../types/validations';
import { TokenPair } from '../types/auth';

const SALT_ROUNDS = 12;

// 타이밍 공격 방지용 더미 해시 — 유저가 없을 때도 bcrypt.compare 실행
const DUMMY_HASH = '$2a$12$LJ3m4ys3Lg7E2Mgo93K/heFHMOn/W.VHqWQEpLSnan16II8KmZy0y';

/**
 * 회원가입
 * 1. 이메일 중복 체크
 * 2. 비밀번호 bcrypt 해싱
 * 3. 유저 생성
 * 4. 토큰 쌍 반환
 */
export async function register(input: RegisterInput): Promise<{
  user: { id: string; email: string };
  tokens: TokenPair;
}> {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) {
    throw new AppError('EMAIL_ALREADY_EXISTS', 409, '이미 사용 중인 이메일입니다.');
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await userRepo.create({
    email: input.email,
    password: hashedPassword,
  });

  const tokens = generateTokens({ userId: user.id, email: user.email });

  return {
    user: { id: user.id, email: user.email },
    tokens,
  };
}

/**
 * 로그인
 * - 이메일 미존재 / 비밀번호 불일치 → 동일한 에러 메시지 (이메일 열거 방지)
 * - 유저가 없을 때도 bcrypt.compare 실행 (타이밍 공격 방지)
 */
export async function login(input: LoginInput): Promise<{
  user: { id: string; email: string };
  tokens: TokenPair;
}> {
  const user = await userRepo.findByEmail(input.email);

  // 타이밍 공격 방지: 유저 존재 여부와 무관하게 항상 bcrypt.compare 실행
  const passwordToCompare = user?.password ?? DUMMY_HASH;
  const isPasswordValid = await bcrypt.compare(input.password, passwordToCompare);

  if (!user || !isPasswordValid) {
    throw new AppError('INVALID_CREDENTIALS', 401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const tokens = generateTokens({ userId: user.id, email: user.email });

  return {
    user: { id: user.id, email: user.email },
    tokens,
  };
}

/**
 * 토큰 갱신
 * 1. 리프레시 토큰 검증
 * 2. 유저 존재 확인 (삭제된 계정 방지)
 * 3. 새 토큰 쌍 발급
 */
export async function refresh(refreshToken: string): Promise<TokenPair> {
  const payload = verifyRefreshToken(refreshToken);

  const user = await userRepo.findById(payload.userId);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 401, '존재하지 않는 사용자입니다.');
  }

  return generateTokens({ userId: user.id, email: user.email });
}
