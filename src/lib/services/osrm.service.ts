/**
 * OSRM Service — OpenStreetMap 기반 무료 라우팅
 *
 * 역할: 두 좌표 간 실제 도로 거리 + 이동시간
 * 비용: $0 (OSM 무료)
 * 모드: driving만 지원 (공개 데모 서버 한계)
 * 도보: 하버사인 거리 × 1.4(도로보정) ÷ 5km/h로 계산
 * 문서: https://project-osrm.org/docs/v5.5.1/api/
 */

export interface RouteResult {
  durationMinutes: number;
  distanceKm: number;
  mode: 'drive' | 'walk';
  summary: string;   // "차량 12분 (8.3km)" or "도보 23분 (1.8km)"
}

// ---------------------------------------------------------------------------
// 캐시 (인메모리, 1시간 TTL)
// ---------------------------------------------------------------------------

const cache = new Map<string, { result: RouteResult | null; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

function routeCacheKey(fromLat: number, fromLon: number, toLat: number, toLon: number, mode: string): string {
  return `${fromLat.toFixed(4)},${fromLon.toFixed(4)}-${toLat.toFixed(4)},${toLon.toFixed(4)}-${mode}`;
}

// ---------------------------------------------------------------------------
// 하버사인 거리 (Nominatim 좌표 기반, 도보용)
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// 도보 이동시간 (하버사인 기반)
// ---------------------------------------------------------------------------

function walkingRoute(fromLat: number, fromLon: number, toLat: number, toLon: number): RouteResult {
  const straightKm = haversineKm(fromLat, fromLon, toLat, toLon);
  const roadKm = straightKm * 1.4; // 직선 → 실제 도로 보정
  const minutes = Math.ceil(roadKm / (5 / 60)); // 5km/h = 0.083km/min
  return {
    durationMinutes: minutes,
    distanceKm: Math.round(roadKm * 100) / 100,
    mode: 'walk',
    summary: `도보 ${minutes}분 (${roadKm.toFixed(1)}km)`,
  };
}

// ---------------------------------------------------------------------------
// OSRM 차량 라우팅
// ---------------------------------------------------------------------------

async function drivingRoute(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): Promise<RouteResult | null> {
  const key = routeCacheKey(fromLat, fromLon, toLat, toLon, 'drive');
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TripPlan/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[OSRM] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      code: string;
      routes: Array<{ duration: number; distance: number }>;
    };

    if (data.code !== 'Ok' || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const minutes = Math.ceil(route.duration / 60);
    const km = Math.round(route.distance / 10) / 100;

    const result: RouteResult = {
      durationMinutes: minutes,
      distanceKm: km,
      mode: 'drive',
      summary: `차량 ${minutes}분 (${km.toFixed(1)}km)`,
    };

    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn('[OSRM] Error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 통합 라우팅 — 모드에 따라 자동 선택
// ---------------------------------------------------------------------------

/**
 * 두 좌표 간 이동시간을 계산한다.
 *
 * - walk: 하버사인 × 1.4 ÷ 5km/h (로컬 계산, API 호출 없음)
 * - drive: OSRM API (실제 도로 기반), 실패 시 하버사인 fallback
 *
 * @param isRentalCar - true면 drive, false면 거리 기반 자동 선택 (≤1.5km walk, >1.5km drive)
 */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  isRentalCar: boolean = false,
): Promise<RouteResult> {
  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);

  // 모드 결정
  if (isRentalCar) {
    // 렌터카: 0.5km 이하는 걸어도 됨
    if (straightKm <= 0.5) {
      return walkingRoute(from.lat, from.lng, to.lat, to.lng);
    }
    const result = await drivingRoute(from.lat, from.lng, to.lat, to.lng);
    if (result) return result;
    // OSRM 실패 fallback
    const roadKm = straightKm * 1.4;
    const minutes = Math.ceil(roadKm / (50 / 60)); // 50km/h 시내 평균
    return { durationMinutes: minutes, distanceKm: roadKm, mode: 'drive', summary: `차량 약 ${minutes}분` };
  }

  // 일반: 거리 기반 자동 선택
  if (straightKm <= 1.5) {
    return walkingRoute(from.lat, from.lng, to.lat, to.lng);
  }

  // 1.5km~10km: 대중교통 (OSRM driving 시간 × 1.3 보정)
  if (straightKm <= 10) {
    const driveResult = await drivingRoute(from.lat, from.lng, to.lat, to.lng);
    if (driveResult) {
      const transitMin = Math.ceil(driveResult.durationMinutes * 1.3) + 10; // 대기시간 +10분
      return {
        durationMinutes: transitMin,
        distanceKm: driveResult.distanceKm,
        mode: 'walk', // subway로 표시하고 싶지만 RouteResult에 없으므로 walk 대신 사용
        summary: `지하철 약 ${transitMin}분`,
      };
    }
  }

  // 10km+: 택시/차량
  const driveResult = await drivingRoute(from.lat, from.lng, to.lat, to.lng);
  if (driveResult) return driveResult;

  // 최종 fallback
  const roadKm = straightKm * 1.4;
  const minutes = Math.ceil(roadKm / (30 / 60)); // 30km/h
  return { durationMinutes: minutes, distanceKm: roadKm, mode: 'drive', summary: `이동 약 ${minutes}분` };
}

// ---------------------------------------------------------------------------
// 배치 라우팅 — 하루 일정 전체
// ---------------------------------------------------------------------------

/**
 * 순서대로 이동하는 경유지들의 구간별 이동시간을 계산한다.
 *
 * @param waypoints - 순서대로의 좌표 배열
 * @param isRentalCar - 렌터카 여부
 * @returns 구간별 RouteResult (waypoints.length - 1개)
 */
export async function batchRoutes(
  waypoints: { lat: number; lng: number }[],
  isRentalCar: boolean = false,
): Promise<RouteResult[]> {
  const results: RouteResult[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const result = await getRoute(waypoints[i - 1], waypoints[i], isRentalCar);
    results.push(result);
  }
  return results;
}
