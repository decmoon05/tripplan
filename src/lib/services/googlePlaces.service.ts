/**
 * Google Places API (New) — REST fetch 사용, 추가 패키지 불필요.
 * 환경변수: GOOGLE_PLACES_API_KEY
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const BASE_URL = 'https://places.googleapis.com/v1';

/** 429 전용 재시도 헬퍼 — exponential backoff (1s, 2s) */
async function fetchWithRetry(
  url: string,
  init: Omit<RequestInit, 'signal'>,
  timeoutMs: number,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok || res.status !== 429 || attempt === maxRetries) return res;
    const delayMs = (attempt + 1) * 1000;
    console.warn(`[GooglePlaces] 429, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('fetchWithRetry: unreachable');
}

// FieldMask — SKU 비용 결정에 직접 영향
// Essentials ($5/1000, 10,000 무료): id, displayName, formattedAddress, location, types
// Pro ($32/1000, 5,000 무료): + rating, regularOpeningHours, photos 등
// → photos 포함 시 Pro SKU ($0.032/건). 사진 없으면 UX 깨짐
const PLACE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.photos', // Pro SKU 트리거 — 사진 없으면 UX 깨짐
].join(',');

// Pro 유저 전용 (rating, hours 필요 시) — 별도 호출로 분리 가능
const PLACE_FIELD_MASK_PRO = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  // photos 제외 — Enterprise SKU 트리거 방지 ($35/1000, 1,000 무료)
].join(',');

export interface CachedPlace {
  googlePlaceId: string;
  displayName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingsTotal: number;
  priceLevel: number | null;
  businessHours: string | null;
  closedDays: string | null;
  types: string[];
  category: string;
  photoReference: string | null;
}

/** Google types → 앱 카테고리 매핑 */
function mapCategory(types: string[]): string {
  for (const t of types) {
    if (['tourist_attraction', 'museum', 'park', 'amusement_park', 'zoo', 'aquarium'].includes(t)) return 'attraction';
    if (['restaurant', 'food', 'meal_delivery', 'meal_takeaway'].includes(t)) return 'restaurant';
    if (t === 'cafe') return 'cafe';
    if (['shopping_mall', 'store', 'clothing_store', 'department_store', 'supermarket'].includes(t)) return 'shopping';
    if (t === 'lodging') return 'hotel';
  }
  return 'attraction';
}

/** regularOpeningHours → "HH:MM-HH:MM" 텍스트 */
function formatBusinessHours(openingHours?: { weekdayDescriptions?: string[] }): string | null {
  if (!openingHours?.weekdayDescriptions?.length) return null;
  // 첫 번째 요일 설명을 반환 (대표 시간)
  return openingHours.weekdayDescriptions[0] || null;
}

/** regularOpeningHours에서 휴무일 추출 */
function formatClosedDays(openingHours?: { weekdayDescriptions?: string[] }): string | null {
  if (!openingHours?.weekdayDescriptions) return null;
  const closed = openingHours.weekdayDescriptions.filter(
    (d) => d.toLowerCase().includes('closed') || d.includes('정기휴무'),
  );
  return closed.length > 0 ? closed.join(', ') : null;
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
  photos?: { name?: string }[];
}

function toGooglePlaceFromResult(place: GooglePlace): CachedPlace | null {
  if (!place.id || !place.displayName?.text) return null;

  const types = place.types || [];
  const priceLevelMap: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };

  // photo reference: Google Places (New) 형식 — "places/xxx/photos/yyy"
  const photoRef = place.photos?.[0]?.name || null;

  return {
    googlePlaceId: place.id,
    displayName: place.displayName.text,
    address: place.formattedAddress || null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    userRatingsTotal: place.userRatingCount ?? 0,
    priceLevel: place.priceLevel ? (priceLevelMap[place.priceLevel] ?? null) : null,
    businessHours: formatBusinessHours(place.regularOpeningHours),
    closedDays: formatClosedDays(place.regularOpeningHours),
    types,
    category: mapCategory(types),
    photoReference: photoRef,
  };
}

/**
 * Google Text Search (New) API로 장소 검색.
 * @param destination 목적지 (e.g., "오사카")
 * @param category 앱 카테고리 (e.g., "restaurant")
 * @param maxResults 최대 결과 수
 */
export async function searchPlaces(
  destination: string,
  category: string,
  maxResults = 10,
): Promise<CachedPlace[]> {
  if (!API_KEY) {
    console.warn('[GooglePlaces] API key not set, returning empty');
    return [];
  }

  const categoryQuery: Record<string, string> = {
    attraction: 'popular tourist attractions',
    restaurant: 'popular restaurants',
    cafe: 'popular cafes',
    shopping: 'popular shopping',
    hotel: 'popular hotels',
  };

  // 입력 sanitize
  const safeDest = destination.replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 100);
  if (!safeDest) return [];

  const query = `${categoryQuery[category] || 'popular places'} in ${safeDest}`;

  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': PLACE_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: maxResults,
          languageCode: 'ko',
        }),
      },
      10_000,
    );

    if (!res.ok) {
      console.error(`[GooglePlaces] searchText failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rawPlaces = data?.places;
    if (!Array.isArray(rawPlaces)) return [];

    const places: CachedPlace[] = [];

    for (const place of rawPlaces) {
      const parsed = toGooglePlaceFromResult(place);
      if (parsed) {
        // 카테고리 오버라이드 (검색 카테고리 우선)
        parsed.category = category;
        places.push(parsed);
      }
    }

    return places;
  } catch (err) {
    console.error('[GooglePlaces] searchPlaces error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** 검색용 장소명 정규화 — 혼합 스크립트(한글+한자 등) 제거 */
function normalizeSearchName(name: string): string {
  // 괄호 안 내용 제거: "오사카 성 (大阪城)" → "오사카 성"
  let cleaned = name.replace(/\s*[\(（].*?[\)）]\s*/g, '').trim();
  // 한글+공백 prefix 추출: "오사카 성大阪城" → "오사카 성"
  const koreanPrefix = cleaned.match(/^[\uAC00-\uD7AF\s]+/);
  if (koreanPrefix && koreanPrefix[0].trim().length >= 2) {
    cleaned = koreanPrefix[0].trim();
  }
  return cleaned;
}

/**
 * 단일 장소 이름으로 검증 (Text Search).
 * 매칭 실패 시 null 반환.
 */
export async function verifyPlace(
  placeName: string,
  destination: string,
): Promise<CachedPlace | null> {
  if (!API_KEY) return null;

  const safeName = placeName.replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 200);
  const safeDest = destination.replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 100);
  if (!safeName) return null;

  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': PLACE_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: `${normalizeSearchName(safeName)} ${safeDest}`,
          maxResultCount: 1,
          languageCode: 'ko',
        }),
      },
      5_000,
      1, // postValidate 배치에서 호출되므로 1회만 재시도
    );

    if (!res.ok) return null;

    const data = await res.json();
    const rawPlaces = data?.places;
    if (!Array.isArray(rawPlaces) || rawPlaces.length === 0) return null;

    return toGooglePlaceFromResult(rawPlaces[0]);
  } catch (err) {
    console.warn('[GooglePlaces] verifyPlace error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 목적지에 대해 4개 카테고리 전체 검색.
 * 순차 호출로 Google API 429 방지.
 * @returns 모든 카테고리의 CachedPlace 배열
 */
export async function searchAllCategories(
  destination: string,
  maxPerCategory = 10,
): Promise<CachedPlace[]> {
  const categories = ['attraction', 'restaurant', 'cafe', 'shopping'];
  const allPlaces: CachedPlace[] = [];

  for (const cat of categories) {
    const places = await searchPlaces(destination, cat, maxPerCategory);
    allPlaces.push(...places);
  }

  return allPlaces;
}
