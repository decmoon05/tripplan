import { Place, PlaceCategory } from '@tripwise/shared';
import { env } from '../utils/env';

// ===== Google Places API (New) =====
// https://developers.google.com/maps/documentation/places/web-service/op-overview

const BASE_URL = 'https://places.googleapis.com/v1';
const FETCH_TIMEOUT_MS = 10_000;

// ===== 일일 사용량 카운터 (메모리 기반, 서버 재시작 시 리셋) =====

interface UsageCounter {
  date: string; // 'YYYY-MM-DD'
  searchText: number;
  getPlace: number;
  getPhoto: number;
}

const DAILY_LIMITS = {
  searchText: 170,
  getPlace: 180,
  getPhoto: 20,
} as const;

const SOFT_LIMIT_RATIO = 0.8;

let usage: UsageCounter = { date: todayStr(), searchText: 0, getPlace: 0, getPhoto: 0 };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay(): void {
  const today = todayStr();
  if (usage.date !== today) {
    usage = { date: today, searchText: 0, getPlace: 0, getPhoto: 0 };
  }
}

function canUse(type: keyof typeof DAILY_LIMITS): boolean {
  resetIfNewDay();
  return usage[type] < DAILY_LIMITS[type];
}

function recordUse(type: keyof typeof DAILY_LIMITS): void {
  resetIfNewDay();
  usage[type]++;
  const limit = DAILY_LIMITS[type];
  const softLimit = Math.floor(limit * SOFT_LIMIT_RATIO);
  if (usage[type] === softLimit) {
    console.warn(`[GOOGLE_PLACES] ${type} 사용량 ${softLimit}/${limit} (80% 경고)`);
  }
  if (usage[type] >= limit) {
    console.warn(`[GOOGLE_PLACES] ${type} 일일 한도 ${limit} 도달 — 캐시 폴백 모드`);
  }
}

/** 현재 사용량 조회 (디버깅/모니터링용) */
export function getUsage(): UsageCounter & { limits: typeof DAILY_LIMITS } {
  resetIfNewDay();
  return { ...usage, limits: DAILY_LIMITS };
}

// ===== 가용성 체크 =====

/** API 키가 있고, 일일 한도가 남아있는지 */
export function isAvailable(): boolean {
  return env.GOOGLE_PLACES_API_KEY.length > 0;
}

function isSearchAvailable(): boolean {
  return isAvailable() && canUse('searchText');
}

function isDetailAvailable(): boolean {
  return isAvailable() && canUse('getPlace');
}

// ===== New API 응답 타입 =====

interface GoogleNewPlaceResult {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  rating?: number;
  priceLevel?: string; // "PRICE_LEVEL_FREE" | "PRICE_LEVEL_INEXPENSIVE" | ...
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
  websiteUri?: string;
  types?: string[];
  primaryType?: string;
}

interface GoogleNewSearchResponse {
  places?: GoogleNewPlaceResult[];
}

// ===== fetch 래퍼 =====

async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 공통 인증 헤더 */
function authHeaders(): Record<string, string> {
  return {
    'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
    'Content-Type': 'application/json',
  };
}

// ===== Field Mask 정의 (비용 최적화: 필요한 필드만) =====

/** 상세 조회 시 필드 (사진 포함) */
const DETAIL_FIELD_MASK = [
  'id', 'displayName', 'formattedAddress', 'rating', 'priceLevel',
  'location', 'regularOpeningHours', 'photos', 'websiteUri', 'types', 'primaryType',
].join(',');

/** 검색 시 필드 (사진 제외 — 일 20건 제한 대응) */
const SEARCH_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
  'places.priceLevel', 'places.location', 'places.types', 'places.primaryType',
].join(',');

// ===== 입력 검증 =====

/** Google Place ID 형식 검증 (경로 조작 방지) */
function validatePlaceId(id: string): void {
  // Google Place ID: "ChIJ" 접두사 + 영숫자/하이픈/언더스코어
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('유효하지 않은 Place ID 형식입니다.');
  }
}

// ===== API 호출 =====

/**
 * Place Details (New API)
 * GET https://places.googleapis.com/v1/places/{placeId}
 */
export async function fetchPlaceDetails(googlePlaceId: string): Promise<Place> {
  if (!isDetailAvailable()) {
    throw new Error('GetPlace 일일 한도 초과');
  }

  validatePlaceId(googlePlaceId);

  const response = await fetchApi(`${BASE_URL}/places/${googlePlaceId}`, {
    method: 'GET',
    headers: {
      ...authHeaders(),
      'X-Goog-FieldMask': DETAIL_FIELD_MASK,
    },
  });

  recordUse('getPlace');

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Google Places API 오류 ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as GoogleNewPlaceResult;
  return mapNewPlaceToPlace(data, true);
}

/**
 * Text Search (New API)
 * POST https://places.googleapis.com/v1/places:searchText
 */
export async function searchPlaces(
  query: string,
  limit: number = 20
): Promise<Place[]> {
  if (!isSearchAvailable()) {
    throw new Error('SearchText 일일 한도 초과');
  }

  const body = {
    textQuery: query,
    languageCode: 'ko',
    pageSize: Math.min(limit, 20), // New API max 20 per page
  };

  const response = await fetchApi(`${BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  recordUse('searchText');

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Google Places Search API 오류 ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as GoogleNewSearchResponse;
  const results = data.places ?? [];
  return results.map((p) => mapNewPlaceToPlace(p, false));
}

// ===== 변환 유틸리티 =====

/**
 * New API 응답 → Place 변환
 * @param includePhoto 상세 조회에서만 true (사진 할당량 절약)
 */
function mapNewPlaceToPlace(result: GoogleNewPlaceResult, includePhoto: boolean): Place {
  return {
    googlePlaceId: result.id,
    name: result.displayName?.text ?? result.id,
    category: mapTypesToCategory(result.types ?? [], result.primaryType),
    rating: result.rating,
    priceLevel: mapPriceLevel(result.priceLevel),
    address: result.formattedAddress,
    openingHours: result.regularOpeningHours?.weekdayDescriptions,
    lat: result.location?.latitude ?? 0,
    lng: result.location?.longitude ?? 0,
    photoUrl: includePhoto ? buildPhotoUrl(result.photos?.[0]?.name) : undefined,
    website: result.websiteUri,
  };
}

/**
 * Google types[] → PlaceCategory 매핑
 * New API에서는 primaryType을 우선 사용
 */
function mapTypesToCategory(types: string[], primaryType?: string): PlaceCategory {
  const allTypes = primaryType ? [primaryType, ...types] : types;
  const typeSet = new Set(allTypes);

  if (typeSet.has('restaurant') || typeSet.has('korean_restaurant') || typeSet.has('japanese_restaurant') || typeSet.has('chinese_restaurant')) return 'restaurant';
  if (typeSet.has('cafe') || typeSet.has('coffee_shop')) return 'cafe';
  if (typeSet.has('bakery') || typeSet.has('ice_cream_shop') || typeSet.has('dessert_shop')) return 'dessert';
  if (typeSet.has('tourist_attraction') || typeSet.has('museum') || typeSet.has('art_gallery') || typeSet.has('historical_landmark')) return 'attraction';
  if (typeSet.has('shopping_mall') || typeSet.has('store') || typeSet.has('clothing_store') || typeSet.has('market')) return 'shopping';
  if (typeSet.has('lodging') || typeSet.has('hotel') || typeSet.has('guest_house')) return 'accommodation';
  if (typeSet.has('park') || typeSet.has('national_park') || typeSet.has('campground') || typeSet.has('hiking_area')) return 'nature';
  if (typeSet.has('amusement_park') || typeSet.has('stadium') || typeSet.has('gym') || typeSet.has('spa')) return 'activity';
  if (typeSet.has('transit_station') || typeSet.has('airport') || typeSet.has('train_station') || typeSet.has('bus_station')) return 'transport';

  return 'attraction';
}

/**
 * New API priceLevel enum → 숫자 변환
 * PRICE_LEVEL_FREE → undefined, INEXPENSIVE → 1, MODERATE → 2, EXPENSIVE → 3, VERY_EXPENSIVE → 4
 */
function mapPriceLevel(level?: string): 1 | 2 | 3 | 4 | undefined {
  switch (level) {
    case 'PRICE_LEVEL_INEXPENSIVE': return 1;
    case 'PRICE_LEVEL_MODERATE': return 2;
    case 'PRICE_LEVEL_EXPENSIVE': return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
    default: return undefined; // FREE 또는 미지정
  }
}

/**
 * New API 사진 URL 빌드
 *
 * 클라이언트에 API 키를 노출하지 않기 위해 서버 프록시 경로를 반환.
 * 클라이언트는 /api/v1/places/photo?ref=... 로 요청하고,
 * 서버가 Google API에 키를 붙여 프록시 호출.
 *
 * photoRef = photos[].name (예: "places/ChIJ.../photos/AUc7...")
 */
function buildPhotoUrl(photoName?: string): string | undefined {
  if (!photoName) return undefined;
  if (!canUse('getPhoto')) {
    console.warn('[GOOGLE_PLACES] GetPhoto 일일 한도 초과 — 사진 URL 생성 건너뜀');
    return undefined;
  }
  recordUse('getPhoto');
  // 서버 프록시 경로 반환 (API 키 미포함)
  return `/api/v1/places/photo?ref=${encodeURIComponent(photoName)}`;
}

/**
 * 사진 프록시용: Google Places Photo Media URL 생성 (서버 내부 전용)
 * 이 함수는 서버 프록시 엔드포인트에서만 호출됨
 */
export function buildGooglePhotoUrl(photoRef: string): string {
  const params = new URLSearchParams({
    maxWidthPx: '400',
    key: env.GOOGLE_PLACES_API_KEY,
  });
  return `${BASE_URL}/${photoRef}/media?${params.toString()}`;
}
