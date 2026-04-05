/**
 * Wikipedia REST API — 무료 장소 사진 제공
 *
 * 역할: 장소 이름 → 위키피디아 썸네일 URL
 * 비용: $0 (완전 무료, 키 불필요)
 * 한도: 합리적 사용 (User-Agent 필수)
 * 저장: ✅ CC 라이선스, 캐싱/저장 허용
 * 문서: https://en.wikipedia.org/api/rest_v1/
 */

export interface WikiPhoto {
  title: string;
  thumbnailUrl: string;    // 330px 썸네일
  originalUrl: string;     // 원본 고해상도
  description: string;     // 한줄 설명
}

// ---------------------------------------------------------------------------
// 캐시 (인메모리, 24시간)
// ---------------------------------------------------------------------------

const cache = new Map<string, { result: WikiPhoto | null; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 장소 이름에서 Wikipedia 제목 추출
// ---------------------------------------------------------------------------

/**
 * "센소지 (浅草寺)" → "Sensō-ji" (영어 위키 제목)
 * 괄호 안 현지어로 먼저 시도, 실패하면 전체 이름으로
 */
function extractWikiSearchName(placeName: string): string[] {
  const names: string[] = [];

  // 괄호 안 현지어
  const match = placeName.match(/[（(]([^)）]+)[)）]/);
  if (match) names.push(match[1].trim());

  // 한국어 이름 (괄호 앞)
  const koreanName = placeName.replace(/\s*[（(][^)）]+[)）]/, '').trim();
  if (koreanName) names.push(koreanName);

  // 전체
  names.push(placeName.trim());

  return [...new Set(names)];
}

// ---------------------------------------------------------------------------
// Wikipedia REST API 호출
// ---------------------------------------------------------------------------

async function searchWikipedia(query: string): Promise<WikiPhoto | null> {
  try {
    // 1차: 영어 위키피디아 (커버리지 최고)
    const enResult = await fetchWikiSummary('en', query);
    if (enResult) return enResult;

    // 2차: 일본어 위키피디아 (일본 장소)
    const jaResult = await fetchWikiSummary('ja', query);
    if (jaResult) return jaResult;

    // 3차: 한국어 위키피디아 (한국 장소)
    const koResult = await fetchWikiSummary('ko', query);
    if (koResult) return koResult;

    return null;
  } catch {
    return null;
  }
}

async function fetchWikiSummary(lang: string, title: string): Promise<WikiPhoto | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'TripPlan/1.0 (travel-planner; contact@tripplan.app)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      title: string;
      thumbnail?: { source: string };
      originalimage?: { source: string };
      extract?: string;
    };

    if (!data.thumbnail?.source) return null;

    return {
      title: data.title,
      thumbnailUrl: data.thumbnail.source,
      originalUrl: data.originalimage?.source || data.thumbnail.source,
      description: data.extract?.slice(0, 100) || '',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 장소 이름으로 Wikipedia 사진을 검색한다.
 * 무료, 키 불필요, 저장 가능 (CC 라이선스).
 *
 * @param placeName - "센소지 (浅草寺)" 형태
 * @returns 사진 URL 또는 null
 */
export async function getPlacePhoto(placeName: string): Promise<WikiPhoto | null> {
  const cacheKey = placeName.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const searchNames = extractWikiSearchName(placeName);

  for (const name of searchNames) {
    const result = await searchWikipedia(name);
    if (result) {
      cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }
  }

  cache.set(cacheKey, { result: null, expiresAt: Date.now() + CACHE_TTL_MS });
  return null;
}

/**
 * 여러 장소의 사진을 배치로 검색한다.
 * 순차 실행 (위키피디아 부하 방지).
 */
export async function batchGetPlacePhotos(
  placeNames: string[],
): Promise<Map<string, WikiPhoto>> {
  const results = new Map<string, WikiPhoto>();

  for (const name of placeNames) {
    const photo = await getPlacePhoto(name);
    if (photo) results.set(name, photo);
    // 100ms 딜레이 (위키피디아 예의)
    await new Promise(r => setTimeout(r, 100));
  }

  return results;
}
