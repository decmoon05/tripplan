/**
 * Weather Service — Open-Meteo API (무료, 키 불필요)
 * https://open-meteo.com/en/docs
 * - 최대 16일 예보
 * - 인메모리 캐시 1시간
 * - API 키 없음 → 설정 불필요, 항상 동작
 * - 비상업 무료 (10,000 call/일)
 */

export interface DayWeather {
  date: string;       // 'YYYY-MM-DD'
  tempMin: number;    // °C
  tempMax: number;
  description: string;
  icon: string;       // WMO weather code as string (e.g. '0', '61')
  precipPct: number;  // 강수 확률 0~100
}

export interface WeatherForecast {
  destination: string;
  currency?: string;
  days: DayWeather[];
  fetchedAt: number;
}

// 인메모리 캐시 (key: `${lat}:${lon}:${startDate}`)
const weatherCache = new Map<string, WeatherForecast>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

/** 캐시 상태 (admin용) */
export function getWeatherCacheStatus() {
  return { entries: weatherCache.size, ttlMs: CACHE_TTL_MS };
}
/** 캐시 전체 플러시 */
export function clearWeatherCache() { weatherCache.clear(); }

function getCached(key: string): WeatherForecast | null {
  const cached = weatherCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    weatherCache.delete(key);
    return null;
  }
  return cached;
}

/**
 * WMO Weather Code → 이모지 + 한국어 설명
 * https://open-meteo.com/en/docs#weathervariables
 */
const WMO_MAP: Record<number, { emoji: string; desc: string }> = {
  0:  { emoji: '☀️', desc: '맑음' },
  1:  { emoji: '🌤️', desc: '대체로 맑음' },
  2:  { emoji: '⛅', desc: '구름 조금' },
  3:  { emoji: '☁️', desc: '흐림' },
  45: { emoji: '🌫️', desc: '안개' },
  48: { emoji: '🌫️', desc: '짙은 안개' },
  51: { emoji: '🌦️', desc: '가벼운 이슬비' },
  53: { emoji: '🌦️', desc: '이슬비' },
  55: { emoji: '🌧️', desc: '강한 이슬비' },
  56: { emoji: '🌧️', desc: '결빙 이슬비' },
  57: { emoji: '🌧️', desc: '강한 결빙 이슬비' },
  61: { emoji: '🌧️', desc: '가벼운 비' },
  63: { emoji: '🌧️', desc: '비' },
  65: { emoji: '🌧️', desc: '강한 비' },
  66: { emoji: '🌧️', desc: '결빙 비' },
  67: { emoji: '🌧️', desc: '강한 결빙 비' },
  71: { emoji: '❄️', desc: '가벼운 눈' },
  73: { emoji: '❄️', desc: '눈' },
  75: { emoji: '❄️', desc: '강한 눈' },
  77: { emoji: '❄️', desc: '싸락눈' },
  80: { emoji: '🌦️', desc: '가벼운 소나기' },
  81: { emoji: '🌧️', desc: '소나기' },
  82: { emoji: '🌧️', desc: '강한 소나기' },
  85: { emoji: '🌨️', desc: '가벼운 눈 소나기' },
  86: { emoji: '🌨️', desc: '눈 소나기' },
  95: { emoji: '⛈️', desc: '뇌우' },
  96: { emoji: '⛈️', desc: '우박 동반 뇌우' },
  99: { emoji: '⛈️', desc: '강한 우박 뇌우' },
};

/** WMO code → 이모지 */
export function iconToEmoji(icon: string): string {
  const code = parseInt(icon, 10);
  return WMO_MAP[code]?.emoji ?? '🌡️';
}

/** WMO code → 한국어 설명 */
function wmoDescription(code: number): string {
  return WMO_MAP[code]?.desc ?? '알 수 없음';
}

// Open-Meteo Geocoding으로 도시명 → 좌표 변환
interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

async function geocodeCity(destination: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=ko`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name ?? destination,
    };
  } catch {
    return null;
  }
}

/**
 * 여행 목적지의 날씨 예보를 가져온다.
 * @param destination 도시명 (한글 또는 영문)
 * @param startDate   여행 시작일 'YYYY-MM-DD'
 * @param days        일수 (최대 16일)
 */
export async function getWeatherForecast(
  destination: string,
  startDate: string,
  days: number = 5,
): Promise<WeatherForecast | null> {
  // Open-Meteo는 좌표 기반이므로 먼저 도시명 → 좌표 변환
  const geo = await geocodeCity(destination);
  if (!geo) {
    console.warn(`[weather] Geocode failed for "${destination}"`);
    return null;
  }

  const effectiveDays = Math.max(1, Math.min(days, 16));
  const cacheKey = `${geo.latitude}:${geo.longitude}:${startDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${geo.latitude}` +
      `&longitude=${geo.longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&timezone=auto` +
      `&forecast_days=${effectiveDays}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn(`[weather] Open-Meteo API error ${res.status}`);
      return null;
    }

    const data = await res.json();
    const daily = data.daily;

    if (!daily?.time?.length) {
      console.warn('[weather] No daily data returned');
      return null;
    }

    const dayWeathers: DayWeather[] = daily.time.map((date: string, i: number) => {
      const wmoCode = daily.weather_code?.[i] ?? 0;
      return {
        date,
        tempMin: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        tempMax: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        description: wmoDescription(wmoCode),
        icon: String(wmoCode),
        precipPct: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      };
    });

    // 여행 시작일 이후만 필터
    const filtered = dayWeathers.filter((d) => d.date >= startDate);

    const forecast: WeatherForecast = {
      destination: geo.name,
      days: filtered,
      fetchedAt: Date.now(),
    };

    weatherCache.set(cacheKey, forecast);
    return forecast;
  } catch (err) {
    console.error('[weather] Fetch failed:', err);
    return null;
  }
}
