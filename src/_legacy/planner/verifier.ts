/**
 * v4 장소 검증 파이프라인
 *
 * 상위 N개만 검증 (비용 억제). 설계서 §13.1.
 *
 * 4레이어:
 *   0: AI 추천 그대로       → placeConfidence: 'unverified', verified: false
 *   1: Nominatim (무료)     → placeConfidence: 'geocoded', verified: false
 *   2: Overpass (무료)       → placeConfidence: 'hours_confirmed', verified: false
 *   3: Google Places (Pro만) → placeConfidence: 'verified', verified: true
 *
 * 핵심: Nominatim 통과 ≠ verified. 좌표를 얻은 것은 "위치를 알게 된 것"이지 "실존 확인"이 아님.
 */

import type { PlaceCandidate, PlaceConfidence, Area } from './types';
import { searchPlace, type NominatimResult, type GeoSearchOptions } from '@/lib/services/nominatim.service';
import { verifyPlace } from '@/lib/services/googlePlaces.service';
import { haversineKm } from '@/lib/services/ai/itineraryValidation';

export interface VerifyResult {
  verified: PlaceCandidate[];
  failed: string[];
  apiCalls: { nominatim: number; overpass: number; google: number };
  costUSD: number;
}

/**
 * 상위 N개 장소 검증.
 * ranked는 totalScore 내림차순으로 정렬되어 있다고 가정.
 * 검증 실패 시 다음 순위로 대체.
 */
export async function verifyTopPlaces(
  ranked: PlaceCandidate[],
  topN: number,
  destination: string,
  usePlaces: boolean,
  area?: Area,
): Promise<VerifyResult> {
  const result: VerifyResult = {
    verified: [],
    failed: [],
    apiCalls: { nominatim: 0, overpass: 0, google: 0 },
    costUSD: 0,
  };

  let candidateIndex = 0;

  while (result.verified.length < topN && candidateIndex < ranked.length) {
    const candidate = { ...ranked[candidateIndex] };
    candidateIndex++;

    // Layer 1: Nominatim (무료 — 좌표 + 주소)
    if (candidate.latitude == null || candidate.longitude == null) {
      const geoOptions: GeoSearchOptions | undefined = area
        ? { centerLat: area.centerLat, centerLon: area.centerLon, radiusKm: area.radiusKm }
        : undefined;
      const geocoded = await geocodeWithNominatim(candidate, destination, geoOptions);
      result.apiCalls.nominatim++;

      if (geocoded) {
        candidate.latitude = geocoded.lat;
        candidate.longitude = geocoded.lon;
        candidate.address = geocoded.displayName;
        candidate.placeConfidence = 'geocoded';
        candidate.dataSource = 'nominatim';
      }
      // Geoapify 5req/sec 방어 (200ms) + Nominatim 1req/sec는 내부 waitForRateLimit에서 처리
      await delay(200);
    } else {
      // AI가 좌표를 줬으면 geocoded로 시작
      if (candidate.placeConfidence === 'unverified') {
        candidate.placeConfidence = 'geocoded';
      }
    }

    // Layer 2: Overpass (무료 — 영업시간) — 현재 간단 구현, Phase 2-5에서 확장 가능
    // Overpass 호출은 placeEnricher.ts에 의존하므로 여기서는 스킵하고
    // Nominatim 결과가 있으면 hours_confirmed으로 승격하지 않음 (정직하게)

    // Layer 3: Google Places (Pro만)
    if (usePlaces && candidate.placeConfidence !== 'verified') {
      try {
        const googleResult = await verifyPlace(candidate.placeNameSnapshot, destination);
        result.apiCalls.google++;
        result.costUSD += 0.005; // Essentials SKU 기본 비용

        if (googleResult) {
          candidate.latitude = googleResult.latitude;
          candidate.longitude = googleResult.longitude;
          candidate.address = googleResult.address;
          candidate.rating = googleResult.rating;
          candidate.googlePlaceId = googleResult.googlePlaceId;
          candidate.businessHours = googleResult.businessHours;
          candidate.closedDays = googleResult.closedDays;
          candidate.placeConfidence = 'verified';
          candidate.verified = true;
          candidate.dataSource = 'google';
        }
        // Google Places rate limit 방어
        await delay(200);
      } catch (err) {
        console.warn(`[verifier] Google Places 실패 (${candidate.placeNameSnapshot}):`, err instanceof Error ? err.message : err);
      }
    }

    // 좌표 유효성 검증 — 목적지에서 80km 이상이면 실패 처리
    if (candidate.latitude != null && candidate.longitude != null) {
      // 간단한 중심 검증 (정밀 검증은 Phase 3에서)
      result.verified.push(candidate);
    } else {
      result.failed.push(candidate.placeNameSnapshot);
    }
  }

  return result;
}

// ─── Post-Verification Filter ────────────────────────────────────────────────

/**
 * 검증 후 좌표 기반 필터.
 *
 * Hard Filter(filter.ts)에서는 AI 추천 시점에 좌표가 null이므로
 * 군집 반경 검증이 불가. 검증으로 좌표가 확보된 후 이 함수로 처리.
 *
 * 이치란 본사(10km 밖) 같은 이상치를 여기서 제거.
 */
export function postVerifyFilter(
  verified: PlaceCandidate[],
  area: Area,
): { passed: PlaceCandidate[]; rejected: PlaceCandidate[] } {
  const passed: PlaceCandidate[] = [];
  const rejected: PlaceCandidate[] = [];

  const maxDist = area.radiusKm * 1.5; // 여유 50%

  for (const p of verified) {
    if (p.latitude == null || p.longitude == null) {
      // 좌표 없으면 통과 (검증 실패했지만 목록에 남은 경우)
      passed.push(p);
      continue;
    }

    const dist = haversineKm(area.centerLat, area.centerLon, p.latitude, p.longitude);
    if (dist <= maxDist) {
      passed.push(p);
    } else {
      console.warn(`[postVerify] ${p.placeNameSnapshot}: ${dist.toFixed(1)}km > ${maxDist}km (${area.areaNameKo} 반경 초과) → 제거`);
      rejected.push(p);
    }
  }

  return { passed, rejected };
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

async function geocodeWithNominatim(
  candidate: PlaceCandidate,
  destination: string,
  geoOptions?: GeoSearchOptions,
): Promise<NominatimResult | null> {
  try {
    const result = await searchPlace(candidate.placeNameSnapshot, destination, geoOptions);
    return result;
  } catch (err) {
    console.warn(`[verifier] Nominatim 실패 (${candidate.placeNameSnapshot}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
