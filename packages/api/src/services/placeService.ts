import { Place, PlaceCategory } from '@tripwise/shared';
import { AppError } from '../middlewares/errorHandler';
import * as placeCacheRepo from '../repositories/placeCacheRepository';
import * as googlePlacesService from './googlePlacesService';
import type { PlaceSearchQuery } from '../types/validations';

// ===== 장소 상세 조회 =====

/**
 * 장소 상세 조회 (캐시 우선 전략)
 *
 * 조회 순서:
 * 1. PlaceCache에서 조회
 * 2. Google API 가용 + (캐시 미스 또는 만료 또는 AI 데이터) → Google 호출 → 캐시 갱신
 * 3. Google 불가/실패 + 캐시 있음 → 캐시 데이터로 제한된 Place 반환
 * 4. 둘 다 없음 → 404
 */
export async function getPlaceDetail(googlePlaceId: string): Promise<Place> {
  // 1. 캐시 조회
  const cached = await placeCacheRepo.findByGooglePlaceId(googlePlaceId);
  const cachedData = cached?.cachedData as Record<string, unknown> | undefined;

  // 2. Google API 가용 시 → 풍부한 데이터 시도
  if (googlePlacesService.isAvailable()) {
    // 캐시가 유효하고 Google에서 가져온 완전한 데이터인지 확인
    const isGoogleCacheValid =
      cached &&
      cachedData &&
      cached.expiresAt > new Date() &&
      cachedData.source === 'google';

    if (isGoogleCacheValid && cachedData) {
      return buildPlaceFromCache(googlePlaceId, cachedData);
    }

    try {
      const place = await googlePlacesService.fetchPlaceDetails(googlePlaceId);

      // 캐시에 저장 (7일 만료 — Google 데이터는 주기적 갱신)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await placeCacheRepo.upsert(
        googlePlaceId,
        { ...place, source: 'google' } as unknown as object,
        expiresAt
      );

      return place;
    } catch (err) {
      console.error('[PLACE_SERVICE] Google Places API 호출 실패, 캐시 폴백:', err instanceof Error ? err.message : err);
      // Google 실패 시 캐시 폴백으로 계속 진행
    }
  }

  // 3. 캐시 폴백 (AI 생성 메타데이터 또는 이전 Google 데이터)
  if (cachedData) {
    return buildPlaceFromCache(googlePlaceId, cachedData);
  }

  // 4. 어디에도 없음
  throw new AppError('PLACE_NOT_FOUND', 404, '장소를 찾을 수 없습니다.');
}

// ===== 장소 검색 =====

/** 검색 결과 타입 — source 필드로 데이터 품질 표시 */
export interface PlaceSearchResult {
  places: Place[];
  source: 'google' | 'cache';
  count: number;
}

/**
 * 장소 검색
 *
 * Google API 가용 → Google Text Search 사용 → 결과 캐싱
 * Google 불가/실패 → PlaceCache에서 텍스트 검색 (제한적)
 */
export async function searchPlaces(input: PlaceSearchQuery): Promise<PlaceSearchResult> {
  // Google API 가용 시
  if (googlePlacesService.isAvailable()) {
    try {
      // 목적지가 있으면 검색어에 포함하여 맥락 제공
      const searchQuery = input.destination
        ? `${input.query} in ${input.destination}`
        : input.query;

      const places = await googlePlacesService.searchPlaces(searchQuery, input.limit);

      // 카테고리 필터 (Google에는 직접 매핑이 안 되므로 결과에서 필터)
      const filtered = input.category
        ? places.filter((p) => p.category === input.category)
        : places;

      // 검색 결과를 캐시에 비동기 저장 (실패해도 검색 결과에 영향 없음)
      cacheSearchResults(filtered).catch((err) => {
        console.error('[PLACE_SERVICE] 검색 결과 캐싱 실패 (무시):', err instanceof Error ? err.message : 'Unknown error');
      });

      return {
        places: filtered,
        source: 'google',
        count: filtered.length,
      };
    } catch (err) {
      console.error('[PLACE_SERVICE] Google 검색 실패, 캐시 폴백:', err instanceof Error ? err.message : err);
      // 폴백으로 계속
    }
  }

  // 캐시 폴백 검색
  const cachedResults = await placeCacheRepo.searchByText(
    input.query,
    input.destination,
    input.category,
    input.limit
  );

  const places = cachedResults.map((row) =>
    buildPlaceFromCache(
      row.google_place_id,
      row.cached_data as Record<string, unknown>
    )
  );

  return {
    places,
    source: 'cache',
    count: places.length,
  };
}

// ===== 내부 유틸리티 =====

/**
 * PlaceCache 데이터 → Place 타입 변환
 * - source: 'google' → 풍부한 데이터 (rating, address, photos 등)
 * - source 없음 → AI 생성 메타데이터 (name, category, lat, lng만)
 */
function buildPlaceFromCache(
  googlePlaceId: string,
  data: Record<string, unknown>
): Place {
  // Google에서 캐시된 완전한 데이터인 경우
  if (data.source === 'google') {
    return {
      googlePlaceId: (data.googlePlaceId as string) ?? googlePlaceId,
      name: (data.name as string) ?? googlePlaceId,
      category: (data.category as PlaceCategory) ?? 'attraction',
      rating: data.rating as number | undefined,
      priceLevel: data.priceLevel as 1 | 2 | 3 | 4 | undefined,
      address: data.address as string | undefined,
      openingHours: data.openingHours as string[] | undefined,
      lat: Number(data.lat) || 0,
      lng: Number(data.lng) || 0,
      photoUrl: data.photoUrl as string | undefined,
      website: data.website as string | undefined,
    };
  }

  // AI 생성 메타데이터 (제한된 필드만 존재)
  return {
    googlePlaceId,
    name: (data.name as string) ?? googlePlaceId,
    category: (data.category as PlaceCategory) ?? 'attraction',
    lat: Number(data.lat) || 0,
    lng: Number(data.lng) || 0,
    // AI 메타데이터에는 아래 필드들이 없음 → undefined
  };
}

/**
 * 검색 결과를 PlaceCache에 일괄 저장
 * - 7일 만료 (Google 데이터 기준)
 */
async function cacheSearchResults(places: Place[]): Promise<void> {
  if (places.length === 0) return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 순차 처리: Supabase Session Pooler 커넥션 풀 한도 방지
  for (const place of places) {
    await placeCacheRepo.upsert(
      place.googlePlaceId,
      { ...place, source: 'google' } as unknown as object,
      expiresAt
    );
  }
}
