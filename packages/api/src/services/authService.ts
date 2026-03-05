import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import * as userRepo from '../repositories/userRepository';
import * as refreshTokenRepo from '../repositories/refreshTokenRepository';
import { generateTokens, verifyRefreshToken, hashToken, REFRESH_TOKEN_EXPIRES_MS } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../types/validations';
import { TokenPair } from '../types/auth';

const SALT_ROUNDS = 12;

// 타이밍 공격 방지용 더미 해시 — 유저가 없을 때도 bcrypt.compare 실행
const DUMMY_HASH = '$2a$12$LJ3m4ys3Lg7E2Mgo93K/heFHMOn/W.VHqWQEpLSnan16II8KmZy0y';

/**
 * 리프레시 토큰 해시를 DB에 저장
 * - 토큰 자체는 저장하지 않음 (해시만 저장)
 */
async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);

  await refreshTokenRepo.create({ userId, tokenHash, expiresAt });
}

/**
 * 회원가입
 * 1. 이메일 중복 체크
 * 2. 비밀번호 bcrypt 해싱
 * 3. 유저 생성
 * 4. 토큰 쌍 반환 + 리프레시 토큰 해시 DB 저장
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
  await saveRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email },
    tokens,
  };
}

/**
 * 로그인
 * - 이메일 미존재 / 비밀번호 불일치 → 동일한 에러 메시지 (이메일 열거 방지)
 * - 유저가 없을 때도 bcrypt.compare 실행 (타이밍 공격 방지)
 * - 성공 시 리프레시 토큰 해시 DB 저장
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
  await saveRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email },
    tokens,
  };
}

/**
 * 토큰 갱신 (회전 방식)
 * 1. JWT 서명 검증
 * 2. DB에서 토큰 해시 조회 (폐기/만료 확인)
 * 3. 기존 토큰 폐기
 * 4. 새 토큰 쌍 발급 + 새 해시 저장
 */
export async function refresh(refreshToken: string): Promise<TokenPair> {
  const payload = verifyRefreshToken(refreshToken);

  // DB에서 해시 검증 (폐기된 토큰인지 확인)
  const tokenHash = hashToken(refreshToken);
  const storedToken = await refreshTokenRepo.findValidByHash(tokenHash);

  if (!storedToken) {
    throw new AppError('REFRESH_TOKEN_REVOKED', 401, '폐기된 리프레시 토큰입니다. 다시 로그인해주세요.');
  }

  const user = await userRepo.findById(payload.userId);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 401, '존재하지 않는 사용자입니다.');
  }

  // 기존 토큰 폐기 + 새 토큰 발급 (회전)
  await refreshTokenRepo.revokeByHash(tokenHash);
  const newTokens = generateTokens({ userId: user.id, email: user.email });
  await saveRefreshToken(user.id, newTokens.refreshToken);

  return newTokens;
}

/**
 * 로그아웃
 * - 사용자의 모든 리프레시 토큰 폐기
 * - Access Token은 15분 후 자연 만료 (무상태 방식 유지)
 */
export async function logout(userId: string): Promise<void> {
  await refreshTokenRepo.revokeAllByUserId(userId);
}
