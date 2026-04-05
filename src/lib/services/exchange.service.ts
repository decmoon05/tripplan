/**
 * Exchange Rate Service — open.er-api.com 연동
 * - 무료 플랜, CORS 지원, 1500회/월 (충분)
 * - 인메모리 캐시 6시간
 * - 실패 시 하드코딩 fallback 반환 (앱 안 깨짐)
 */

export interface ExchangeRateResult {
  base: string;     // 'KRW'
  target: string;   // 'JPY', 'USD', ...
  rate: number;     // 1 KRW = rate TARGET
  inverseRate: number; // 1 TARGET = inverseRate KRW
  fetchedAt: number;
  isFallback?: boolean;
}

// 하드코딩 fallback (API 실패 시 사용)
const FALLBACK_RATES: Record<string, number> = {
  USD: 0.00073,
  EUR: 0.00067,
  JPY: 0.107,
  CNY: 0.0053,
  GBP: 0.00057,
  THB: 0.026,
  VND: 18.5,
  TWD: 0.023,
  HKD: 0.0057,
  SGD: 0.00097,
  AUD: 0.0011,
  CAD: 0.00099,
  MYR: 0.0034,
  IDR: 11.8,
  PHP: 0.041,
};

const rateCache = new Map<string, ExchangeRateResult>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

/** 캐시 상태 (admin용) */
export function getExchangeCacheStatus() {
  return { entries: rateCache.size, ttlMs: CACHE_TTL_MS };
}
/** 캐시 전체 플러시 */
export function clearExchangeCache() { rateCache.clear(); }

function getCached(key: string): ExchangeRateResult | null {
  const cached = rateCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    rateCache.delete(key);
    return null;
  }
  return cached;
}

function getFallback(base: string, target: string): ExchangeRateResult {
  // KRW → target
  if (base === 'KRW') {
    const rate = FALLBACK_RATES[target] ?? 1;
    return { base, target, rate, inverseRate: 1 / rate, fetchedAt: Date.now(), isFallback: true };
  }
  // target → KRW
  if (target === 'KRW') {
    const inverseRate = FALLBACK_RATES[base] ?? 1;
    const rate = 1 / inverseRate;
    return { base, target, rate, inverseRate, fetchedAt: Date.now(), isFallback: true };
  }
  return { base, target, rate: 1, inverseRate: 1, fetchedAt: Date.now(), isFallback: true };
}

/**
 * 환율을 가져온다.
 * @param base   기준 통화 ('KRW')
 * @param target 대상 통화 ('JPY', 'USD', ...)
 */
export async function getExchangeRate(
  base: string,
  target: string,
): Promise<ExchangeRateResult> {
  if (base === target) {
    return { base, target, rate: 1, inverseRate: 1, fetchedAt: Date.now() };
  }

  const cacheKey = `${base}:${target}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://open.er-api.com/v6/latest/${base}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      console.warn(`[exchange] API error ${res.status} — using fallback`);
      return getFallback(base, target);
    }

    const data = await res.json();
    if (data.result !== 'success') {
      console.warn('[exchange] API returned error result — using fallback');
      return getFallback(base, target);
    }

    const rates: Record<string, number> = data.rates ?? {};
    const rate = rates[target];
    // 숫자 유효성 검증 (0, NaN, Infinity, 음수, 비정상적 큰 값 차단)
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1e8) {
      console.warn(`[exchange] Invalid rate for ${target}: ${rate} — using fallback`);
      return getFallback(base, target);
    }

    const result: ExchangeRateResult = {
      base,
      target,
      rate,
      inverseRate: 1 / rate,
      fetchedAt: Date.now(),
    };

    rateCache.set(cacheKey, result);
    // 역방향도 캐싱
    rateCache.set(`${target}:${base}`, {
      base: target,
      target: base,
      rate: 1 / rate,
      inverseRate: rate,
      fetchedAt: Date.now(),
    });

    return result;
  } catch (err) {
    console.error('[exchange] Fetch failed:', err);
    return getFallback(base, target);
  }
}

/**
 * 여행 목적지 통화 코드를 추론한다.
 * (AI 서비스에서 사용하던 하드코딩 교체용)
 */
export function inferCurrencyFromDestination(destination: string): string {
  const dest = destination.toLowerCase();
  if (dest.includes('japan') || dest.includes('일본') || dest.includes('도쿄') || dest.includes('오사카') || dest.includes('교토') || dest.includes('후쿠오카')) return 'JPY';
  if (dest.includes('china') || dest.includes('중국') || dest.includes('베이징') || dest.includes('상하이') || dest.includes('청두')) return 'CNY';
  if (dest.includes('taiwan') || dest.includes('대만') || dest.includes('타이베이')) return 'TWD';
  if (dest.includes('hong kong') || dest.includes('홍콩')) return 'HKD';
  if (dest.includes('thailand') || dest.includes('태국') || dest.includes('방콕') || dest.includes('치앙마이') || dest.includes('파타야') || dest.includes('푸켓')) return 'THB';
  if (dest.includes('vietnam') || dest.includes('베트남') || dest.includes('하노이') || dest.includes('호치민') || dest.includes('다낭')) return 'VND';
  if (dest.includes('singapore') || dest.includes('싱가포르')) return 'SGD';
  if (dest.includes('malaysia') || dest.includes('말레이시아') || dest.includes('쿠알라룸푸르')) return 'MYR';
  if (dest.includes('indonesia') || dest.includes('인도네시아') || dest.includes('발리') || dest.includes('자카르타')) return 'IDR';
  if (dest.includes('philippines') || dest.includes('필리핀') || dest.includes('마닐라') || dest.includes('세부')) return 'PHP';
  if (dest.includes('usa') || dest.includes('미국') || dest.includes('뉴욕') || dest.includes('LA') || dest.includes('로스앤젤레스') || dest.includes('샌프란시스코') || dest.includes('라스베가스')) return 'USD';
  if (dest.includes('uk') || dest.includes('영국') || dest.includes('런던')) return 'GBP';
  if (dest.includes('france') || dest.includes('프랑스') || dest.includes('paris') || dest.includes('파리')) return 'EUR';
  if (dest.includes('germany') || dest.includes('독일') || dest.includes('이탈리아') || dest.includes('스페인') || dest.includes('유럽')) return 'EUR';
  if (dest.includes('australia') || dest.includes('호주') || dest.includes('시드니') || dest.includes('멜버른')) return 'AUD';
  if (dest.includes('canada') || dest.includes('캐나다') || dest.includes('밴쿠버') || dest.includes('토론토')) return 'CAD';
  if (dest.includes('한국') || dest.includes('seoul') || dest.includes('서울') || dest.includes('부산') || dest.includes('제주')) return 'KRW';
  return 'USD'; // 기본값
}
