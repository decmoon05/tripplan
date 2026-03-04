import { prisma } from '../utils/prisma';

/**
 * User DB 접근 레이어
 * - 순수 Prisma 쿼리만 담당
 * - 비즈니스 로직 없음
 */

/** 이메일로 사용자 조회 (로그인용 — password 포함) */
export function findByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

/** ID로 사용자 조회 (토큰 갱신 시 존재 확인용) */
export function findById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
}

/** 사용자 생성 (password는 해시된 값이어야 함) */
export function create(data: { email: string; password: string }) {
  return prisma.user.create({
    data,
    select: { id: true, email: true, createdAt: true },
  });
}
