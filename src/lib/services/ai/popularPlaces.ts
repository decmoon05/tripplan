import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isGatewayMode } from './prompt';
import type { UserProfile } from '@/types/database';
import { searchAllCategories, searchPlaces, type CachedPlace } from '@/lib/services/googlePlaces.service';

/** OpenAI 클라이언트 지연 초기화 — AI_PROVIDER=claude일 때 불필요한 인스턴스화 방지 */
let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy',
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      timeout: 60_000,
      maxRetries: 1,
    });
  }
  return _openaiClient;
}

// ── 서버 메모리 캐시 (30분 TTL) ─────────────────────────
// Google Places ToS 준수: DB에는 place_id만 저장, 상세 데이터는 메모리에만 유지
const MEMORY_TTL_MS = 30 * 60 * 1000; // 30분
const memoryCache = new Map<string, { places: CachedPlace[]; expiresAt: number }>();

/** 캐시 상태 (admin용) */
export function getPlacesCacheStatus() {
  return { entries: memoryCache.size, maxEntries: 100, ttlMs: MEMORY_TTL_MS };
}
/** 캐시 전체 플러시 */
export function clearPlacesCache() { memoryCache.clear(); }

function getFromMemory(destination: string): CachedPlace[] | null {
  const entry = memoryCache.get(destination);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(destination);
    return null;
  }
  return entry.places;
}

function setToMemory(destination: string, places: CachedPlace[]): void {
  memoryCache.set(destination, { places, expiresAt: Date.now() + MEMORY_TTL_MS });
  // 메모리 누수 방지: 최대 100개 목적지만 캐싱
  if (memoryCache.size > 100) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
}

export type ActivityLevel = 'light' | 'moderate' | 'intense';

export interface PopularPlace {
  name: string;
  category: 'attraction' | 'restaurant' | 'cafe' | 'shopping' | 'transport' | 'hotel';
  description: string;
  activityLevel: ActivityLevel;
  googlePlaceId?: string;
  address?: string;
  rating?: number;
  verified?: boolean;
  photoReference?: string | null;
}

/** CachedPlace → PopularPlace 변환 */
function cachedToPopular(cached: CachedPlace): PopularPlace {
  return {
    name: cached.displayName,
    category: cached.category as PopularPlace['category'],
    description: cached.address || '',
    activityLevel: 'moderate',
    googlePlaceId: cached.googlePlaceId,
    address: cached.address || undefined,
    rating: cached.rating || undefined,
    verified: true,
    photoReference: cached.photoReference || null,
  };
}

/** 장소명 정규화 (공백·특수문자 제거, 소문자) */
function normalizeName(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, '') // 괄호 안 내용 제거
    .replace(/[\s\-·・]/g, '')     // 공백·하이픈·가운뎃점 제거
    .toLowerCase();
}

/** googlePlaceId + 이름 유사도 기반 중복 제거 */
function deduplicatePlaces(places: PopularPlace[]): PopularPlace[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: PopularPlace[] = [];

  for (const place of places) {
    // googlePlaceId 중복
    if (place.googlePlaceId && seenIds.has(place.googlePlaceId)) continue;

    // 이름 유사도 중복 (정규화된 이름 비교)
    const normalized = normalizeName(place.name);
    if (seenNames.has(normalized)) continue;

    if (place.googlePlaceId) seenIds.add(place.googlePlaceId);
    seenNames.add(normalized);
    result.push(place);
  }

  return result;
}

/**
 * 검증된 인기 장소 가져오기.
 * 1. place_cache에서 캐시 조회
 * 2. 캐시 미스 → Google Places API 호출 → place_cache에 upsert
 * 3. Google API 실패 → 기존 AI/mock 폴백
 */
export async function getPopularPlaces(
  destination: string,
  excludedPlaces: string[] = [],
  visitedPlaces: string[] = [],
  userProfile: UserProfile | null = null,
  supabase?: SupabaseClient,
): Promise<PopularPlace[]> {
  const providerType = process.env.AI_PROVIDER || 'mock';
  const hasGoogleKey = !!process.env.GOOGLE_PLACES_API_KEY;

  // Google Places API 사용 가능하면 우선 시도
  if (hasGoogleKey && supabase) {
    try {
      const places = await getPlacesFromCacheOrApi(supabase, destination);
      if (places.length > 0) {
        let filtered = deduplicatePlaces(places.map(cachedToPopular));
        if (excludedPlaces.length > 0) {
          filtered = filtered.filter(
            (p) => !excludedPlaces.some((ex) => p.name.includes(ex) || ex.includes(p.name)),
          );
        }
        return filtered;
      }
    } catch (err) {
      console.warn('[PopularPlaces] Google Places fallback:', err instanceof Error ? err.message : err);
    }
  }

  // 폴백: AI 또는 mock
  if (providerType === 'mock' || !hasGoogleKey) {
    return getMockPopularPlaces(destination, excludedPlaces);
  }

  return getAIPopularPlaces(destination, excludedPlaces, visitedPlaces, userProfile);
}

/**
 * 검증된 장소 가져오기 (Option B: slim DB + 메모리 캐시).
 *
 * 1. 메모리 캐시 히트 → 바로 반환 (30분 TTL)
 * 2. 메모리 미스 → DB에서 place_id 목록 조회
 *    2a. DB 히트 → place_id들로 Google API 개별 조회 → 메모리에 저장
 *    2b. DB 미스 → searchAllCategories → place_id만 DB 저장 + 상세 메모리 저장
 */
async function getPlacesFromCacheOrApi(
  supabase: SupabaseClient,
  destination: string,
): Promise<CachedPlace[]> {
  // 1. 메모리 캐시 확인
  const memoryCached = getFromMemory(destination);
  if (memoryCached) return memoryCached;

  // 2. DB에서 place_id 목록 조회 (만료되지 않은 것만)
  const { data: dbRows } = await supabase
    .from('place_cache')
    .select('google_place_id, category')
    .eq('destination', destination)
    .gt('expires_at', new Date().toISOString());

  if (dbRows && dbRows.length > 0) {
    // DB 히트: place_id는 있으니 카테고리별로 Google API 재조회하여 상세정보 획득
    const categories = [...new Set(dbRows.map((r) => r.category as string))];
    const placeIdSet = new Set(dbRows.map((r) => r.google_place_id as string));

    const allPlaces: CachedPlace[] = [];
    // 순차 호출 (Google API 429 방지)
    for (const cat of categories) {
      const catPlaces = await searchPlaces(destination, cat, 5); // 10→5개로 축소 (비용 50% 절감)
      for (const p of catPlaces) {
        if (placeIdSet.has(p.googlePlaceId)) {
          allPlaces.push(p);
        }
      }
    }

    if (allPlaces.length > 0) {
      setToMemory(destination, allPlaces);
      return allPlaces;
    }

    // Google API 재조회 실패 시 DB place_ids로 최소 캐시 반환 (빈 배열 대신)
    if (dbRows.length > 0) {
      console.warn(`[PopularPlaces] Google API 불가, DB place_ids로 최소 캐시 반환 (${dbRows.length}건)`);
      return dbRows.map((r) => ({
        googlePlaceId: r.google_place_id as string,
        displayName: '',
        address: null, latitude: null, longitude: null,
        rating: null, userRatingsTotal: 0, priceLevel: null,
        businessHours: null, closedDays: null, types: [],
        category: r.category as string,
        photoReference: null,
      }));
    }
  }

  // 3. DB 미스 → Google Places API 전체 검색
  const places = await searchAllCategories(destination);
  if (places.length === 0) return [];

  // place_id만 DB에 저장 (ToS 준수)
  const rows = places.map((p) => ({
    destination,
    category: p.category,
    google_place_id: p.googlePlaceId,
  }));

  await supabase
    .from('place_cache')
    .upsert(rows, { onConflict: 'destination,google_place_id' })
    .select();

  // 상세 데이터는 메모리에만
  setToMemory(destination, places);

  return places;
}

/** 목적지의 검증된 장소 가져오기 (trip.service에서 사용) */
export async function getVerifiedPlacesForDestination(
  supabase: SupabaseClient,
  destination: string,
): Promise<CachedPlace[]> {
  return getPlacesFromCacheOrApi(supabase, destination);
}

/** 사용자 프로필 기반 개인화된 인기 장소 프롬프트 생성 */
function buildProfileContext(profile: UserProfile | null): string {
  if (!profile) return '';

  const lines: string[] = [];

  if (profile.interests?.length > 0) {
    lines.push(`Interests: ${profile.interests.join(', ')} — prioritize places matching these`);
  }
  if (profile.stamina) {
    const desc: Record<string, string> = {
      low: 'low stamina (prefer easy, flat, indoor spots — avoid hiking/trekking)',
      moderate: 'moderate stamina (some walking OK but no intense hikes)',
      high: 'high stamina (can handle any activity level)',
    };
    lines.push(`Stamina: ${desc[profile.stamina] || profile.stamina}`);
  }
  if (profile.adventureLevel) {
    const desc: Record<string, string> = {
      explorer: 'adventurous (include hidden gems, local-only spots, off-the-beaten-path)',
      balanced: 'balanced (mix of popular and local spots)',
      cautious: 'safety-first (well-known, well-reviewed tourist spots only)',
    };
    lines.push(`Adventure: ${desc[profile.adventureLevel] || profile.adventureLevel}`);
  }
  if (profile.photoStyle) {
    const desc: Record<string, string> = {
      sns: 'photo-focused (include Instagram-worthy, photogenic spots)',
      casual: 'casual photos (scenic but not photo-centric)',
      minimal: 'experience-focused (local experiences over photo spots)',
    };
    lines.push(`Photo: ${desc[profile.photoStyle] || profile.photoStyle}`);
  }
  if (profile.foodPreference?.length > 0) {
    lines.push(`Food restrictions: ${profile.foodPreference.join(', ')}`);
  }

  return lines.length > 0 ? `\n\n[Traveler Profile — personalize recommendations based on this]\n${lines.join('\n')}` : '';
}

/** AI 기반 인기 장소 (폴백용) */
async function getAIPopularPlaces(
  destination: string,
  excludedPlaces: string[],
  visitedPlaces: string[],
  userProfile: UserProfile | null,
): Promise<PopularPlace[]> {
  let contextPrompt = '';
  if (excludedPlaces.length > 0) {
    contextPrompt += `\n\nExclude these places (user already visited): ${excludedPlaces.join(', ')}. Suggest alternatives instead.`;
  }
  if (visitedPlaces.length > 0) {
    const unexcluded = visitedPlaces.filter((p) => !excludedPlaces.includes(p));
    if (unexcluded.length > 0) {
      contextPrompt += `\n\nPreviously visited places (may include but also recommend new ones): ${unexcluded.join(', ')}`;
    }
  }

  contextPrompt += buildProfileContext(userProfile);

  const systemInstructions = `You are a travel expert. Return a JSON array of 15-20 popular places PERSONALIZED for the traveler's profile.
Each item must have: name, category, description, activityLevel.
- name: Use Korean as primary name with local language in parentheses. Format: "Korean Name (Local Name)". Examples: "센소지 (浅草寺)", "에펠탑 (Tour Eiffel)". NEVER use English-only names.
- category: one of "attraction", "restaurant", "cafe", "shopping"
- description: 1 sentence in Korean, include why this place fits the traveler
- activityLevel: one of "light", "moderate", "intense"
- If the traveler has low/moderate stamina, DO NOT include "intense" places
- Prioritize places that match the traveler's interests and style
Return ONLY the JSON array, no markdown.`;

  const safeDest = destination.slice(0, 100);
  const userMessage = `Recommend 15-20 personalized tourist attractions, restaurants, cafes, and shopping spots in """${safeDest}""" for this specific traveler. Write name and description in Korean.${contextPrompt}`;

  const messages: { role: 'system' | 'user'; content: string }[] = isGatewayMode()
    ? [{ role: 'user', content: `${systemInstructions}\n\n---\n\n${userMessage}` }]
    : [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: userMessage },
      ];

  try {
    const lightModel = process.env.OPENAI_LIGHT_MODEL || 'gpt-5.4-nano';
    const response = await getOpenAIClient().chat.completions.create({
      model: lightModel,
      messages,
      temperature: 0.8,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return getMockPopularPlaces(destination, excludedPlaces);

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return getMockPopularPlaces(destination, excludedPlaces);

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return getMockPopularPlaces(destination, excludedPlaces);
    return parsed.filter((p: Record<string, unknown>) => p.name && p.category) as PopularPlace[];
  } catch (err) {
    console.warn('[PopularPlaces] AI fallback:', err instanceof Error ? err.message : err);
    return getMockPopularPlaces(destination, excludedPlaces);
  }
}

function getMockPopularPlaces(destination: string, excludedPlaces: string[] = []): PopularPlace[] {
  const dest = destination.toLowerCase();
  let allPlaces: PopularPlace[] = [];

  if (dest.includes('오사카') || dest.includes('osaka')) {
    allPlaces = [
      { name: '오사카성 (Osaka Castle)', category: 'attraction', description: '오사카의 상징적인 역사 유적', activityLevel: 'moderate' },
      { name: '도톤보리 (Dotonbori)', category: 'attraction', description: '네온사인과 먹거리의 거리', activityLevel: 'light' },
      { name: '구로몬 시장 (Kuromon Market)', category: 'shopping', description: '오사카의 부엌으로 불리는 전통 시장', activityLevel: 'light' },
      { name: '신세카이 (Shinsekai)', category: 'attraction', description: '레트로 분위기의 쿠시카츠 거리', activityLevel: 'light' },
      { name: '유니버설 스튜디오 재팬', category: 'attraction', description: '해리포터, 닌텐도 월드 등 테마파크', activityLevel: 'moderate' },
      { name: '이치란 라멘 (Ichiran)', category: 'restaurant', description: '1인 칸막이의 돈코츠 라멘 전문점', activityLevel: 'light' },
      { name: '리쿠로 오지상 치즈케이크', category: 'cafe', description: '오사카 명물 흔들리는 치즈케이크', activityLevel: 'light' },
      { name: '난바 야스케 (Takoyaki)', category: 'restaurant', description: '오사카 대표 길거리 타코야키', activityLevel: 'light' },
      { name: '하루카스 300 전망대', category: 'attraction', description: '일본 최고층 빌딩의 360도 전망', activityLevel: 'light' },
      { name: '카이유칸 수족관 (Kaiyukan)', category: 'attraction', description: '세계 최대급 실내 수족관', activityLevel: 'light' },
    ];
  } else if (dest.includes('도쿄') || dest.includes('tokyo')) {
    allPlaces = [
      { name: '센소지 (Senso-ji)', category: 'attraction', description: '아사쿠사의 상징적인 불교 사원', activityLevel: 'moderate' },
      { name: '도쿄 스카이트리', category: 'attraction', description: '634m 높이의 전파탑 겸 전망대', activityLevel: 'light' },
      { name: '시부야 스크램블 교차로', category: 'attraction', description: '세계에서 가장 유명한 횡단보도', activityLevel: 'light' },
      { name: '메이지 신궁', category: 'attraction', description: '도심 속 고요한 신사', activityLevel: 'moderate' },
      { name: '아키하바라 전자상가', category: 'shopping', description: '전자제품과 애니메이션 성지', activityLevel: 'light' },
      { name: '츠키지 외시장', category: 'restaurant', description: '신선한 해산물과 먹거리', activityLevel: 'light' },
      { name: '하라주쿠 다케시타 거리', category: 'shopping', description: '젊은 패션과 디저트 거리', activityLevel: 'light' },
      { name: '팀랩 보더리스', category: 'attraction', description: '몰입형 디지털 아트 뮤지엄', activityLevel: 'light' },
      { name: '이치란 라멘', category: 'restaurant', description: '1인석 돈코츠 라멘', activityLevel: 'light' },
      { name: '신주쿠 교엔', category: 'attraction', description: '도심 속 넓은 정원', activityLevel: 'light' },
    ];
  } else if (dest.includes('제주') || dest.includes('jeju')) {
    allPlaces = [
      { name: '성산일출봉 (城山日出峰)', category: 'attraction', description: '유네스코 세계자연유산, 일출 명소', activityLevel: 'moderate' },
      { name: '만장굴 (萬丈窟)', category: 'attraction', description: '세계 최장 용암동굴', activityLevel: 'light' },
      { name: '협재해수욕장', category: 'attraction', description: '에메랄드빛 바다와 백사장', activityLevel: 'light' },
      { name: '제주 흑돼지 거리', category: 'restaurant', description: '두꺼운 흑돼지 구이 맛집 밀집', activityLevel: 'light' },
      { name: '카페 델문도', category: 'cafe', description: '한담해안로의 오션뷰 카페', activityLevel: 'light' },
      { name: '동문재래시장', category: 'shopping', description: '제주 대표 전통 시장, 먹거리 골목', activityLevel: 'light' },
    ];
  } else {
    allPlaces = [];
  }

  if (excludedPlaces.length > 0) {
    allPlaces = allPlaces.filter(
      (p) => !excludedPlaces.some((ex) => p.name.includes(ex) || ex.includes(p.name)),
    );
  }

  return allPlaces;
}
