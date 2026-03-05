import { prisma } from '../utils/prisma';

/**
 * RefreshToken DB 접근 레이어
 * - 토큰 해시 저장/조회/폐기
 * - 순수 Prisma 쿼리만 담당
 */

/** 리프레시 토큰 저장 */
export function create(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.refreshToken.create({ data });
}

/** 토큰 해시로 유효한(미폐기 + 미만료) 토큰 조회 */
export function findValidByHash(tokenHash: string) {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

/** 특정 토큰 폐기 (회전 시) */
export function revokeByHash(tokenHash: string) {
  return prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** 사용자의 모든 리프레시 토큰 폐기 (로그아웃 시) */
export function revokeAllByUserId(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** 만료된 토큰 정리 (주기적 실행용) */
export function deleteExpired() {
  return prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  });
}
