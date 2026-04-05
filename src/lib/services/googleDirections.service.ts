/**
 * Google Directions API — 실제 이동시간 계산
 *
 * Pro/Team 유저만 사용 (Free는 AI 추정치 유지).
 * 비용: $0.005/회 × ~4회/일 = $0.02/일.
 * 인메모리 캐시 1시간.
 */

const CACHE = new Map<string, { result: DirectionsResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

export interface DirectionsResult {
  durationMinutes: number;
  distanceKm: number;
  summary: string; // "도보 12분" or "차량 1시간 47분"
  mode: string;
}

const MODE_MAP: Record<string, string> = {
  walk: 'walking',
  drive: 'driving',
  bus: 'transit',
  subway: 'transit',
  train: 'transit',
  taxi: 'driving',
  bicycle: 'bicycling',
};

const MODE_KOREAN: Record<string, string> = {
  walking: '도보',
  driving: '차량',
  transit: '대중교통',
  bicycling: '자전거',
};

/**
 * Google Directions API로 실제 이동시간을 계산한다.
 * @returns null if API 키 없음, 호출 실패, 또는 좌표 무효
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  transitMode: string = 'transit',
): Promise<DirectionsResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  // 좌표 유효성
  if (origin.lat == null || origin.lng == null || destination.lat == null || destination.lng == null) return null;

  const mode = MODE_MAP[transitMode] || 'transit';
  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}-${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}-${mode}`;

  // 캐시 확인
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${mode}&key=${apiKey}&language=ko`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      return null;
    }

    const leg = data.routes[0].legs[0];
    const durationMinutes = Math.round(leg.duration.value / 60);
    const distanceKm = Math.round(leg.distance.value / 100) / 10; // 소수점 1자리

    const modeKorean = MODE_KOREAN[mode] || mode;
    const summary = durationMinutes < 60
      ? `${modeKorean} ${durationMinutes}분`
      : `${modeKorean} ${Math.floor(durationMinutes / 60)}시간 ${durationMinutes % 60}분`;

    const result: DirectionsResult = {
      durationMinutes,
      distanceKm,
      summary,
      mode: transitMode,
    };

    // 캐시 저장
    CACHE.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    return result;
  } catch (err) {
    console.warn('[Directions] API 실패:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 아이템 배열에 실제 이동시간을 주입한다.
 * transitDurationMin과 transitSummary를 Directions API 결과로 교체.
 * startTime은 이전 아이템 endTime + 실제 이동시간으로 조정.
 */
export async function enrichItemsWithDirections<T extends {
  latitude?: number | null;
  longitude?: number | null;
  transitMode?: string | null;
  transitDurationMin?: number | null;
  transitSummary?: string | null;
  startTime: string;
  endTime: string;
  dayNumber: number;
  orderIndex: number;
}>(items: T[]): Promise<T[]> {
  const { toMinutes, toHHMM } = await import('./ai/itineraryValidation');

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];

    // 같은 날이 아니면 스킵
    if (prev.dayNumber !== curr.dayNumber) continue;
    // 첫 아이템이면 스킵
    if (curr.orderIndex === 0) continue;

    if (!prev.latitude || !prev.longitude || !curr.latitude || !curr.longitude) continue;

    const result = await getDirections(
      { lat: prev.latitude, lng: prev.longitude },
      { lat: curr.latitude, lng: curr.longitude },
      curr.transitMode || 'transit',
    );

    if (result) {
      curr.transitDurationMin = result.durationMinutes;
      curr.transitSummary = result.summary;

      // startTime 조정: 이전 endTime + 이동시간
      const prevEndMin = toMinutes(prev.endTime);
      const newStartMin = prevEndMin + result.durationMinutes;
      const newStart = toHHMM(newStartMin);

      // endTime도 비례 조정 (활동 시간 유지)
      const currDuration = toMinutes(curr.endTime) - toMinutes(curr.startTime);
      const newEnd = toHHMM(newStartMin + Math.max(30, currDuration));

      curr.startTime = newStart;
      curr.endTime = newEnd;
    }
  }

  return items;
}
