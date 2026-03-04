import { prisma } from '../utils/prisma';

/**
 * 장소 캐시 저장/갱신
 * - googlePlaceId로 upsert (중복 시 덮어쓰기)
 */
export function upsert(
  googlePlaceId: string,
  cachedData: object,
  expiresAt: Date
) {
  return prisma.placeCache.upsert({
    where: { googlePlaceId },
    create: { googlePlaceId, cachedData, expiresAt },
    update: { cachedData, expiresAt },
  });
}

/**
 * 단일 장소 캐시 조회
 * - 만료된 캐시도 반환 (호출측에서 만료 체크)
 */
export function findByGooglePlaceId(googlePlaceId: string) {
  return prisma.placeCache.findUnique({
    where: { googlePlaceId },
  });
}

/**
 * 여러 장소 캐시 일괄 조회
 * - 일정 상세에서 장소 메타데이터 조인용
 */
export function findManyByGooglePlaceIds(googlePlaceIds: string[]) {
  return prisma.placeCache.findMany({
    where: { googlePlaceId: { in: googlePlaceIds } },
  });
}

/**
 * 캐시된 장소 텍스트 검색 (Google API 미가용 시 폴백)
 * - PostgreSQL jsonb 연산자로 cached_data 내부 필드 검색
 * - 대소문자 무시 (ILIKE)
 * - destination, category 필터 지원
 */
export function searchByText(
  query: string,
  destination?: string,
  category?: string,
  limit: number = 20
) {
  // SQL Injection 방지: Prisma.$queryRaw는 tagged template으로 파라미터 바인딩
  // ILIKE 와일드카드 이스케이프: %, _, \ 를 리터럴로 처리
  const escapeLike = (str: string) => str.replace(/[%_\\]/g, '\\$&');
  const searchPattern = `%${escapeLike(query)}%`;

  if (destination && category) {
    const destPattern = `%${escapeLike(destination)}%`;
    return prisma.$queryRaw<Array<{ id: string; google_place_id: string; cached_data: unknown; expires_at: Date; updated_at: Date }>>`
      SELECT id, google_place_id, cached_data, expires_at, updated_at
      FROM place_cache
      WHERE cached_data->>'name' ILIKE ${searchPattern}
        AND cached_data->>'destination' ILIKE ${destPattern}
        AND cached_data->>'category' = ${category}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  }

  if (destination) {
    const destPattern = `%${escapeLike(destination)}%`;
    return prisma.$queryRaw<Array<{ id: string; google_place_id: string; cached_data: unknown; expires_at: Date; updated_at: Date }>>`
      SELECT id, google_place_id, cached_data, expires_at, updated_at
      FROM place_cache
      WHERE cached_data->>'name' ILIKE ${searchPattern}
        AND cached_data->>'destination' ILIKE ${destPattern}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  }

  if (category) {
    return prisma.$queryRaw<Array<{ id: string; google_place_id: string; cached_data: unknown; expires_at: Date; updated_at: Date }>>`
      SELECT id, google_place_id, cached_data, expires_at, updated_at
      FROM place_cache
      WHERE cached_data->>'name' ILIKE ${searchPattern}
        AND cached_data->>'category' = ${category}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw<Array<{ id: string; google_place_id: string; cached_data: unknown; expires_at: Date; updated_at: Date }>>`
    SELECT id, google_place_id, cached_data, expires_at, updated_at
    FROM place_cache
    WHERE cached_data->>'name' ILIKE ${searchPattern}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
}
