/**
 * Geocoding Service — Geoapify (우선) + Nominatim (fallback)
 *
 * 역할: 장소 이름 → 실제 좌표 (위도/경도) + 주소
 * 비용: $0 (둘 다 무료)
 *
 * Geoapify: 5 req/sec, 3000건/일 (GEOAPIFY_API_KEY 필요)
 * Nominatim: 1 req/sec (키 불필요, fallback)
 *
 * 문서:
 * - https://apidocs.geoapify.com/docs/geocoding/
 * - https://nominatim.org/release-docs/latest/api/Search/
 */

export interface NominatimResult {
  lat: number;
  lon: number;
  displayName: string;
  osmType: string;     // 'way', 'node', 'relation'
  category: string;    // 'amenity', 'tourism', etc.
  type: string;        // 'place_of_worship', 'restaurant', etc.
  importance: number;  // 0~1, 높을수록 유명
}

// ---------------------------------------------------------------------------
// 캐시 (인메모리, 24시간 TTL)
// ---------------------------------------------------------------------------

const cache = new Map<string, { result: NominatimResult | null; expiresAt: number }>();
const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72시간

function cacheKey(name: string, city: string): string {
  return `${name.trim().toLowerCase()}@${city.trim().toLowerCase()}`;
}

function getCached(key: string): NominatimResult | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCache(key: string, result: NominatimResult | null): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Rate limit (1초 간격 보장)
// ---------------------------------------------------------------------------

let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(r => setTimeout(r, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// 도시 좌표 (viewbox용) — Nominatim 검색 정확도 향상
// ---------------------------------------------------------------------------

const CITY_COORDS: Record<string, { lat: number; lon: number; radius: number }> = {
  '도쿄': { lat: 35.68, lon: 139.77, radius: 0.5 },
  '오사카': { lat: 34.69, lon: 135.50, radius: 0.4 },
  '교토': { lat: 35.01, lon: 135.77, radius: 0.3 },
  '후쿠오카': { lat: 33.59, lon: 130.40, radius: 0.3 },
  '나라': { lat: 34.69, lon: 135.80, radius: 0.2 },
  '서울': { lat: 37.57, lon: 126.98, radius: 0.3 },
  '부산': { lat: 35.18, lon: 129.08, radius: 0.3 },
  '제주': { lat: 33.50, lon: 126.53, radius: 0.4 },
  '방콕': { lat: 13.76, lon: 100.50, radius: 0.4 },
  '파리': { lat: 48.86, lon: 2.35, radius: 0.3 },
  '런던': { lat: 51.51, lon: -0.13, radius: 0.4 },
  '뉴욕': { lat: 40.71, lon: -74.01, radius: 0.4 },
  '하노이': { lat: 21.03, lon: 105.85, radius: 0.3 },
  '호치민': { lat: 10.82, lon: 106.63, radius: 0.3 },
  '타이베이': { lat: 25.03, lon: 121.57, radius: 0.3 },
  '싱가포르': { lat: 1.35, lon: 103.82, radius: 0.3 },
  '홋카이도': { lat: 43.06, lon: 141.35, radius: 1.0 },
  '오키나와': { lat: 26.34, lon: 127.77, radius: 0.5 },
  '규슈': { lat: 33.25, lon: 131.00, radius: 1.5 },
  '로마': { lat: 41.90, lon: 12.50, radius: 0.3 },
  '바르셀로나': { lat: 41.39, lon: 2.17, radius: 0.3 },
  '두바이': { lat: 25.20, lon: 55.27, radius: 0.4 },
};

function getCityViewbox(city: string): string | null {
  // 정확한 도시명 매칭
  const coords = CITY_COORDS[city];
  if (coords) {
    const r = coords.radius;
    return `${coords.lon - r},${coords.lat - r},${coords.lon + r},${coords.lat + r}`;
  }
  // 부분 매칭 (e.g., "도쿄 시부야" → "도쿄")
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    if (city.includes(name)) {
      const r = c.radius;
      return `${c.lon - r},${c.lat - r},${c.lon + r},${c.lat + r}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 장소 이름에서 검색 쿼리 생성
// ---------------------------------------------------------------------------

/**
 * "센소지 (浅草寺)" → "浅草寺" (현지어 우선) 또는 "센소지"
 * 괄호 안 현지어가 Nominatim에서 더 정확한 결과를 낸다.
 */
function extractSearchName(placeName: string): string {
  // 괄호 안 현지어 추출
  const match = placeName.match(/[（(]([^)）]+)[)）]/);
  if (match) return match[1].trim();
  // 괄호 없으면 전체 사용
  return placeName.trim();
}

// ---------------------------------------------------------------------------
// Geoapify 검색 (우선, 5req/sec)
// ---------------------------------------------------------------------------

async function searchWithGeoapify(
  placeName: string,
  city: string,
): Promise<NominatimResult | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    console.log('[Geoapify] API 키 없음 → Nominatim fallback');
    return null;
  }

  const searchName = extractSearchName(placeName);
  const query = `${searchName}, ${city}`;

  try {
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.searchParams.set('text', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('apiKey', apiKey);

    // viewbox로 도시 범위 제한
    const cityCoords = CITY_COORDS[city] || Object.entries(CITY_COORDS).find(([name]) => city.includes(name))?.[1];
    if (cityCoords) {
      const r = cityCoords.radius;
      url.searchParams.set('filter', `rect:${cityCoords.lon - r},${cityCoords.lat - r},${cityCoords.lon + r},${cityCoords.lat + r}`);
    }

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      results: Array<{
        lat: number; lon: number; formatted: string;
        result_type: string; category: string; rank: { importance: number };
      }>;
    };

    if (!data.results?.length) {
      console.log(`[Geoapify] "${query}" 결과 없음`);
      return null;
    }

    const r = data.results[0];
    console.log(`[Geoapify] "${query}" → ${r.lat}, ${r.lon}`);
    return {
      lat: r.lat,
      lon: r.lon,
      displayName: r.formatted,
      osmType: r.result_type || 'node',
      category: r.category || 'unknown',
      type: r.result_type || 'unknown',
      importance: r.rank?.importance || 0.5,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 단건 검색 (Geoapify 우선, Nominatim fallback)
// ---------------------------------------------------------------------------

/**
 * 장소 이름 + 도시로 좌표를 검색한다.
 *
 * @param placeName - "센소지 (浅草寺)" 형태
 * @param city - "도쿄", "오사카" 등
 * @returns 좌표 + 주소, 못 찾으면 null
 */
export async function searchPlace(
  placeName: string,
  city: string,
): Promise<NominatimResult | null> {
  const key = cacheKey(placeName, city);

  // 캐시 확인
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  // Geoapify 우선 (5req/sec, rate limit 불필요)
  const geoapifyResult = await searchWithGeoapify(placeName, city);
  if (geoapifyResult) {
    setCache(key, geoapifyResult);
    return geoapifyResult;
  }

  // Geoapify 실패 → Nominatim fallback (1req/sec)
  await waitForRateLimit();

  const searchName = extractSearchName(placeName);
  const query = `${searchName}, ${city}`;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('accept-language', 'ko');

    // viewbox로 도시 범위 제한 → 동명 장소 오매칭 방지
    const viewbox = getCityViewbox(city);
    if (viewbox) {
      url.searchParams.set('viewbox', viewbox);
      url.searchParams.set('bounded', '1');
    }

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TripPlan/1.0 (travel-planner)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[Nominatim] HTTP ${res.status} for "${query}"`);
      setCache(key, null);
      return null;
    }

    const data = await res.json() as Array<{
      lat: string; lon: string; display_name: string;
      osm_type: string; category: string; type: string; importance: number;
    }>;

    if (!data || data.length === 0) {
      // 현지어로 못 찾으면 전체 이름으로 재시도
      if (searchName !== placeName.trim()) {
        await waitForRateLimit();
        url.searchParams.set('q', `${placeName.trim()}, ${city}`);
        const retryRes = await fetch(url.toString(), {
          headers: { 'User-Agent': 'TripPlan/1.0 (travel-planner)' },
          signal: AbortSignal.timeout(10000),
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json() as typeof data;
          if (retryData && retryData.length > 0) {
            const result = toNominatimResult(retryData[0]);
            setCache(key, result);
            return result;
          }
        }
      }
      setCache(key, null);
      return null;
    }

    const result = toNominatimResult(data[0]);
    setCache(key, result);
    return result;
  } catch (err) {
    console.warn(`[Nominatim] Error for "${query}":`, err instanceof Error ? err.message : err);
    setCache(key, null);
    return null;
  }
}

function toNominatimResult(raw: {
  lat: string; lon: string; display_name: string;
  osm_type: string; category: string; type: string; importance: number;
}): NominatimResult {
  return {
    lat: parseFloat(raw.lat),
    lon: parseFloat(raw.lon),
    displayName: raw.display_name,
    osmType: raw.osm_type,
    category: raw.category,
    type: raw.type,
    importance: raw.importance,
  };
}

// ---------------------------------------------------------------------------
// 배치 검색 (1초 간격 준수)
// ---------------------------------------------------------------------------

/**
 * 여러 장소를 순차적으로 검색한다. (1초 간격)
 *
 * @param places - 검색할 장소 배열
 * @param onProgress - 진행률 콜백 (current, total, placeName)
 * @returns Map<placeNameSnapshot, NominatimResult>
 */
export async function batchSearchPlaces(
  places: { name: string; city: string }[],
  onProgress?: (current: number, total: number, placeName: string) => void,
): Promise<Map<string, NominatimResult>> {
  const results = new Map<string, NominatimResult>();
  const startTime = Date.now();

  // 캐시 hit인 것 먼저 빠르게 처리
  const uncached: { idx: number; name: string; city: string }[] = [];
  for (let i = 0; i < places.length; i++) {
    const { name, city } = places[i];
    const key = cacheKey(name, city);
    const cached = getCached(key);
    if (cached !== undefined) {
      if (cached) results.set(name, cached);
    } else {
      uncached.push({ idx: i, name, city });
    }
  }

  // 캐시 miss → API 호출
  // Geoapify 키 있으면 5개씩 병렬 (5req/sec), 없으면 순차 (1req/sec)
  const hasGeoapify = !!process.env.GEOAPIFY_API_KEY;
  const BATCH_SIZE = hasGeoapify ? 5 : 1;
  const BATCH_DELAY = hasGeoapify ? 300 : 0; // Geoapify: 5req/sec → 300ms 간격

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(({ name, city }) => {
        onProgress?.(results.size + 1, places.length, name);
        return searchPlace(name, city).then(r => ({ name, result: r }));
      }),
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value.result) {
        results.set(r.value.name, r.value.result);
      }
    }
    if (i + BATCH_SIZE < uncached.length && BATCH_DELAY > 0) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Nominatim] ${results.size}/${places.length}개 좌표 확보 (${elapsed}초, 캐시: ${places.length - uncached.length}건)`);
  return results;
}
