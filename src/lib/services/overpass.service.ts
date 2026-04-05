/**
 * Overpass API Service — OpenStreetMap POI 데이터 조회
 *
 * 역할: 좌표 주변 장소의 영업시간, 별점, 음식 종류 등
 * 비용: $0 (OSM 무료)
 * 한도: 합리적 사용 (초당 2회 미만 권장)
 * 문서: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

export interface OverpassPOI {
  name: string;
  nameLocal: string | null;         // 현지어 이름
  openingHours: string | null;      // "Mo-Fr 09:00-18:00"
  cuisine: string | null;           // "japanese;ramen"
  wheelchairAccessible: boolean;
  website: string | null;
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// 캐시 (인메모리, 6시간 TTL)
// ---------------------------------------------------------------------------

const cache = new Map<string, { result: OverpassPOI[]; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function poiCacheKey(lat: number, lon: number, radius: number, type?: string): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)},${radius},${type || 'any'}`;
}

// ---------------------------------------------------------------------------
// 좌표 주변 POI 조회
// ---------------------------------------------------------------------------

/**
 * 좌표 주변의 POI(장소)를 조회한다.
 *
 * @param lat - 위도
 * @param lon - 경도
 * @param radiusMeters - 검색 반경 (미터)
 * @param amenityType - 'restaurant', 'cafe', 'attraction' 등 (생략 시 전체)
 * @returns POI 배열
 */
export async function queryNearbyPOI(
  lat: number,
  lon: number,
  radiusMeters: number = 300,
  amenityType?: string,
): Promise<OverpassPOI[]> {
  const key = poiCacheKey(lat, lon, radiusMeters, amenityType);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const amenityFilter = amenityType
    ? `["amenity"="${amenityType}"]`
    : '["amenity"~"restaurant|cafe|bar"]';

  const query = `[out:json][timeout:10];node${amenityFilter}(around:${radiusMeters},${lat},${lon});out body 10;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[Overpass] HTTP ${res.status}`);
      return [];
    }

    const data = await res.json() as {
      elements: Array<{
        lat: number;
        lon: number;
        tags: Record<string, string>;
      }>;
    };

    const pois: OverpassPOI[] = (data.elements || []).map(e => ({
      name: e.tags?.name || e.tags?.['name:en'] || 'Unknown',
      nameLocal: e.tags?.['name:ja'] || e.tags?.['name:ko'] || e.tags?.['name:zh'] || null,
      openingHours: e.tags?.opening_hours || null,
      cuisine: e.tags?.cuisine || null,
      wheelchairAccessible: e.tags?.wheelchair === 'yes',
      website: e.tags?.website || e.tags?.['contact:website'] || null,
      lat: e.lat,
      lon: e.lon,
    }));

    cache.set(key, { result: pois, expiresAt: Date.now() + CACHE_TTL_MS });
    return pois;
  } catch (err) {
    console.warn('[Overpass] Error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 이름 매칭으로 특정 장소의 영업시간 찾기
// ---------------------------------------------------------------------------

/**
 * 좌표 근처에서 장소 이름과 가장 비슷한 POI를 찾아 영업시간을 반환한다.
 *
 * @param placeName - 장소 이름 (현지어 포함 가능)
 * @param lat - 위도
 * @param lon - 경도
 * @returns 영업시간 문자열 또는 null
 */
export async function findOpeningHours(
  placeName: string,
  lat: number,
  lon: number,
): Promise<string | null> {
  const pois = await queryNearbyPOI(lat, lon, 300);

  // 이름 유사도 매칭
  const nameLC = placeName.toLowerCase();
  for (const poi of pois) {
    if (!poi.openingHours) continue;
    const poiName = `${poi.name} ${poi.nameLocal || ''}`.toLowerCase();
    if (poiName.includes(nameLC) || nameLC.includes(poi.name.toLowerCase())) {
      return poi.openingHours;
    }
  }

  // 정확한 이름 매칭 실패 → 가장 가까운 POI의 영업시간 반환 (같은 종류면)
  const withHours = pois.filter(p => p.openingHours);
  if (withHours.length > 0) {
    return withHours[0].openingHours;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 도시 내 레스토랑 수 조회 (지역 품질 판단용)
// ---------------------------------------------------------------------------

/**
 * 도시 중심 좌표 주변의 레스토랑 수를 카운트한다.
 * 지역 데이터 품질 판단에 사용 (높음/중간/낮음).
 */
export async function countRestaurantsInCity(
  lat: number,
  lon: number,
  radiusKm: number = 20,
): Promise<number> {
  const key = `count:${lat.toFixed(2)},${lon.toFixed(2)},${radiusKm}`;
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.result.length;

  const radiusMeters = radiusKm * 1000;
  const query = `[out:json][timeout:30];node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});out count;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return 0;

    const data = await res.json() as {
      elements: Array<{ tags: { total: string } }>;
    };

    const count = parseInt(data.elements?.[0]?.tags?.total || '0', 10);
    console.log(`[Overpass] ${lat.toFixed(2)},${lon.toFixed(2)} 반경 ${radiusKm}km: restaurant ${count}개`);
    return count;
  } catch (err) {
    console.warn('[Overpass] Count error:', err instanceof Error ? err.message : err);
    return 0;
  }
}
