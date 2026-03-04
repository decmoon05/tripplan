import { Place, PlaceCategory } from '@tripwise/shared';
import { env } from '../utils/env';

// ===== Google Places API 가용성 체크 =====

/** Google Places API 키가 설정되어 있는지 확인 */
export function isAvailable(): boolean {
  return env.GOOGLE_PLACES_API_KEY.length > 0;
}

// ===== Google API 응답 타입 =====

interface GooglePlaceDetailsResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  price_level?: number;
  geometry: {
    location: { lat: number; lng: number };
  };
  opening_hours?: {
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
  }>;
  website?: string;
  types?: string[];
}

interface GoogleTextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  price_level?: number;
  geometry: {
    location: { lat: number; lng: number };
  };
  types?: string[];
  photos?: Array<{
    photo_reference: string;
  }>;
}

interface GoogleDetailsApiResponse {
  status: string;
  result?: GooglePlaceDetailsResult;
  error_message?: string;
}

interface GoogleTextSearchApiResponse {
  status: string;
  results?: GoogleTextSearchResult[];
  error_message?: string;
}

// ===== API 호출 =====

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

/** Google API 요청 타임아웃 (10초) */
const FETCH_TIMEOUT_MS = 10_000;

/** 타임아웃이 적용된 fetch 래퍼 */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Google Place Details API 호출
 * - 단일 장소의 상세 정보 조회
 * @throws Error API 호출 실패 또는 결과 없음
 */
export async function fetchPlaceDetails(googlePlaceId: string): Promise<Place> {
  const params = new URLSearchParams({
    place_id: googlePlaceId,
    fields: 'place_id,name,formatted_address,rating,price_level,geometry,opening_hours,photos,website,types',
    key: env.GOOGLE_PLACES_API_KEY,
    language: 'ko',
  });

  const response = await fetchWithTimeout(`${BASE_URL}/details/json?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Google Places API 응답 오류: ${response.status}`);
  }

  const data = (await response.json()) as GoogleDetailsApiResponse;

  if (data.status !== 'OK' || !data.result) {
    throw new Error(`Google Places API 상태: ${data.status} - ${data.error_message ?? '결과 없음'}`);
  }

  return mapDetailToPlace(data.result);
}

/**
 * Google Places Text Search API 호출
 * - 키워드 기반 장소 검색
 * @throws Error API 호출 실패
 */
export async function searchPlaces(
  query: string,
  limit: number = 20
): Promise<Place[]> {
  const params = new URLSearchParams({
    query,
    key: env.GOOGLE_PLACES_API_KEY,
    language: 'ko',
  });

  const response = await fetchWithTimeout(`${BASE_URL}/textsearch/json?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Google Places Search API 응답 오류: ${response.status}`);
  }

  const data = (await response.json()) as GoogleTextSearchApiResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Search API 상태: ${data.status} - ${data.error_message ?? ''}`);
  }

  const results = data.results ?? [];
  return results.slice(0, limit).map(mapSearchToPlace);
}

// ===== 변환 유틸리티 =====

/** Google Place Details → Place 변환 */
function mapDetailToPlace(result: GooglePlaceDetailsResult): Place {
  return {
    googlePlaceId: result.place_id,
    name: result.name,
    category: mapTypesToCategory(result.types ?? []),
    rating: result.rating,
    priceLevel: normalizePriceLevel(result.price_level),
    address: result.formatted_address,
    openingHours: result.opening_hours?.weekday_text,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    photoUrl: buildPhotoUrl(result.photos?.[0]?.photo_reference),
    website: result.website,
  };
}

/** Google Text Search 결과 → Place 변환 */
function mapSearchToPlace(result: GoogleTextSearchResult): Place {
  return {
    googlePlaceId: result.place_id,
    name: result.name,
    category: mapTypesToCategory(result.types ?? []),
    rating: result.rating,
    priceLevel: normalizePriceLevel(result.price_level),
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    photoUrl: buildPhotoUrl(result.photos?.[0]?.photo_reference),
  };
}

/**
 * Google types[] → PlaceCategory 매핑
 * - 가장 구체적인 타입을 우선 매칭
 * - 매칭되지 않으면 기본값 'attraction'
 */
function mapTypesToCategory(types: string[]): PlaceCategory {
  const typeSet = new Set(types);

  if (typeSet.has('restaurant')) return 'restaurant';
  if (typeSet.has('cafe')) return 'cafe';
  if (typeSet.has('bakery')) return 'dessert';
  if (typeSet.has('tourist_attraction') || typeSet.has('museum') || typeSet.has('art_gallery')) return 'attraction';
  if (typeSet.has('shopping_mall') || typeSet.has('store') || typeSet.has('clothing_store')) return 'shopping';
  if (typeSet.has('lodging')) return 'accommodation';
  if (typeSet.has('park') || typeSet.has('natural_feature') || typeSet.has('campground')) return 'nature';
  if (typeSet.has('amusement_park') || typeSet.has('stadium') || typeSet.has('gym')) return 'activity';
  if (typeSet.has('transit_station') || typeSet.has('airport') || typeSet.has('train_station') || typeSet.has('bus_station')) return 'transport';

  return 'attraction'; // 기본값
}

/** Google price_level (0-4) → Place priceLevel (1-4) 정규화 */
function normalizePriceLevel(level?: number): 1 | 2 | 3 | 4 | undefined {
  if (level === undefined || level < 1 || level > 4) return undefined;
  return level as 1 | 2 | 3 | 4;
}

/**
 * Google photo_reference → Photo URL 빌드
 *
 * ⚠️ 보안 주의 (production 전 수정 필요):
 * 현재 Photo URL에 API 키가 포함되어 클라이언트에 노출됨.
 * production에서는 다음 중 하나로 교체해야 함:
 * 1. Google Cloud Console에서 HTTP Referrer 제한 설정
 * 2. 서버 프록시 엔드포인트 (GET /api/v1/places/photo/:ref)
 */
function buildPhotoUrl(photoReference?: string): string | undefined {
  if (!photoReference) return undefined;
  const params = new URLSearchParams({
    maxwidth: '400',
    photo_reference: photoReference,
    key: env.GOOGLE_PLACES_API_KEY,
  });
  return `${BASE_URL}/photo?${params.toString()}`;
}
