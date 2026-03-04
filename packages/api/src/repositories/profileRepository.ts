import { prisma } from '../utils/prisma';

/**
 * UserProfile DB 접근 레이어
 * - personalityData는 Prisma Json 타입으로 저장
 * - 조회 시 JSON → 타입 변환은 Service에서 처리
 */

/** userId로 프로필 조회 */
export function findByUserId(userId: string) {
  return prisma.userProfile.findUnique({
    where: { userId },
  });
}

/** 프로필 생성 또는 수정 (upsert) */
export function upsert(
  userId: string,
  data: {
    personalityData: object;
    interests: string[];
  }
) {
  return prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      personalityData: data.personalityData,
      interests: data.interests,
    },
    update: {
      personalityData: data.personalityData,
      interests: data.interests,
    },
  });
}
