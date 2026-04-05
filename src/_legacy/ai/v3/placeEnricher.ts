/**
 * v3 장소 보강 — 4계층 데이터 소스
 *
 * Layer 1: Nominatim/Geoapify (무료) → 좌표 + 주소
 * Layer 2: Overpass (무료) → 영업시간
 * Layer 2.5: Wikipedia (무료, 저장 가능) → 사진
 * Layer 3: Google Places (유료, Pro만) → 정밀 좌표 + 사진 덮어쓰기
 */

import { batchSearchPlaces, type NominatimResult } from '@/lib/services/nominatim.service';
import { findOpeningHours } from '@/lib/services/overpass.service';
import { verifyPlace } from '@/lib/services/googlePlaces.service';
import { getPlacePhoto } from '@/lib/services/wikipedia.service';
import { batchedConcurrency } from '@/lib/utils/concurrency';
import { parseOsmOpeningHours } from '@/lib/utils/osm-hours-parser';
import { haversineKm } from '../itineraryValidation';
import type { AIPlaceRecommendation, EnrichedPlace, V3Config } from './types';

// ---------------------------------------------------------------------------
// 좌표 범위 검증 — 목적지 중심에서 허용 반경 초과 시 좌표 폐기
// ---------------------------------------------------------------------------

const DESTINATION_RADIUS_KM = 80; // 목적지 중심에서 최대 허용 거리

/**
 * 좌표가 있는 장소들의 중앙값을 계산하여 목적지 중심 추정.
 * 이상치(outlier)에 강건하도록 중앙값(median) 사용 (평균이 아닌).
 */
function computeDestinationCenter(places: EnrichedPlace[]): { lat: number; lon: number } | null {
  const coords = places
    .filter(p => p.latitude != null && p.longitude != null)
    .map(p => ({ lat: p.latitude!, lon: p.longitude! }));
  if (coords.length < 3) return null; // 3개 미만이면 판단 불가

  coords.sort((a, b) => a.lat - b.lat);
  const medLat = coords[Math.floor(coords.length / 2)].lat;
  coords.sort((a, b) => a.lon - b.lon);
  const medLon = coords[Math.floor(coords.length / 2)].lon;
  return { lat: medLat, lon: medLon };
}

/**
 * 목적지 중심에서 허용 반경 밖의 좌표를 null로 리셋.
 * 히로시마 식당이 규슈 여행에 포함되는 문제를 방지.
 */
function validateCoordinateBounds(places: EnrichedPlace[]): number {
  const center = computeDestinationCenter(places);
  if (!center) return 0;

  let invalidCount = 0;
  for (const place of places) {
    if (place.latitude == null || place.longitude == null) continue;
    const dist = haversineKm(center.lat, center.lon, place.latitude, place.longitude);
    if (dist > DESTINATION_RADIUS_KM) {
      console.warn(`[PlaceEnricher] 좌표 범위 초과: "${place.placeNameSnapshot}" (${dist.toFixed(0)}km from center) → 좌표 폐기`);
      place.latitude = null;
      place.longitude = null;
      place.address = null;
      place.verified = false;
      invalidCount++;
    }
  }
  return invalidCount;
}

/**
 * AI 추천 장소 리스트를 실제 데이터로 보강한다.
 *
 * Free: Nominatim(좌표) + Overpass(영업시간) → 비용 $0
 * Pro:  위 + Google Places(정밀 좌표/사진/리뷰) → 비용 ~$0.16/일
 */
export async function enrichPlaces(
  places: AIPlaceRecommendation[],
  destination: string,
  config: V3Config,
  onProgress?: (current: number, total: number, placeName: string) => void,
): Promise<{ enriched: EnrichedPlace[]; failedCount: number }> {

  // ─── Layer 1: Nominatim (모든 유저, 무료, ~1req/sec) ───
  onProgress?.(0, places.length, 'Nominatim 좌표 검색 중...');
  const nominatimResults = await batchSearchPlaces(
    places.map(p => ({ name: p.placeNameSnapshot, city: destination })),
    (current, total, name) => onProgress?.(current, total, `📍 ${name}`),
  );

  // 초기 보강 (Nominatim 좌표 적용)
  const enriched: EnrichedPlace[] = places.map(place => {
    const nom = nominatimResults.get(place.placeNameSnapshot);
    return {
      ...place,
      latitude: nom?.lat ?? null,
      longitude: nom?.lon ?? null,
      address: nom?.displayName ?? null,
      businessHours: null,
      closedDays: null,
      rating: null,
      googlePlaceId: null,
      photoUrl: null,
      verified: nom != null,
    };
  });

  let failedCount = enriched.filter(p => !p.latitude).length;
  console.log(`[PlaceEnricher] Layer 1 (Nominatim): ${enriched.length - failedCount}/${enriched.length}개 좌표 확보`);

  // ─── 좌표 범위 검증 (Layer 1 후) ───
  const boundsInvalid = validateCoordinateBounds(enriched);
  if (boundsInvalid > 0) {
    console.log(`[PlaceEnricher] 좌표 범위 검증: ${boundsInvalid}개 폐기 (${DESTINATION_RADIUS_KM}km 초과)`);
    failedCount = enriched.filter(p => !p.latitude).length;
  }

  // ─── Layer 2: Overpass 영업시간 (모든 유저, 무료, 5개씩 병렬) ───
  const placesWithCoords = enriched.filter(p => p.latitude && p.longitude);
  let hoursFound = 0;

  const startLayer2 = Date.now();
  await batchedConcurrency(
    placesWithCoords,
    async (place) => {
      const hours = await findOpeningHours(
        place.placeNameSnapshot,
        place.latitude!,
        place.longitude!,
      );
      if (hours) {
        const parsed = parseOsmOpeningHours(hours);
        place.businessHours = parsed.businessHours;
        place.closedDays = parsed.closedDays;
        hoursFound++;
      }
    },
    2,     // 2개씩 병렬 (Overpass 429 방지)
    1500,  // 배치 간 1.5초
  );
  console.log(`[PlaceEnricher] Layer 2 (Overpass): ${hoursFound}/${enriched.length}개 영업시간 확보 (${((Date.now() - startLayer2) / 1000).toFixed(1)}초)`);

  // ─── Layer 2.5: Wikipedia 사진 (모든 유저, 무료, 저장 가능) ───
  let photosFound = 0;
  for (const place of enriched) {
    if (place.category === 'attraction' || place.category === 'shopping') {
      const wikiPhoto = await getPlacePhoto(place.placeNameSnapshot);
      if (wikiPhoto) {
        place.photoUrl = wikiPhoto.thumbnailUrl;
        photosFound++;
      }
    }
  }
  console.log(`[PlaceEnricher] Layer 2.5 (Wikipedia): ${photosFound}/${enriched.length}개 사진 확보`);

  // ─── Layer 3: Google Places (Pro만, 좌표 없는 장소만 호출 — 비용 최소화) ───
  if (config.usePlaces) {
    let googleSuccess = 0;
    // 이미 Nominatim/Geoapify에서 좌표 확보한 건 스킵 → Places 호출 최소화
    const needsGoogle = enriched.filter(p => !p.latitude || !p.businessHours);
    console.log(`[PlaceEnricher] Layer 3: ${needsGoogle.length}/${enriched.length}개만 Google Places 호출 (좌표 있는 ${enriched.length - needsGoogle.length}개 스킵)`);

    for (let i = 0; i < needsGoogle.length; i++) {
      const place = needsGoogle[i];
      onProgress?.(i + 1, needsGoogle.length, `🔍 ${place.placeNameSnapshot}`);

      try {
        const google = await verifyPlace(place.placeNameSnapshot, destination);
        if (google) {
          place.latitude = google.latitude;
          place.longitude = google.longitude;
          place.address = google.address || place.address;
          place.businessHours = google.businessHours || place.businessHours;
          place.closedDays = google.closedDays || place.closedDays;
          place.rating = google.rating || place.rating;
          place.googlePlaceId = google.googlePlaceId || null;
          place.verified = true;
          googleSuccess++;
        }
      } catch (err) {
        console.warn(`[PlaceEnricher] Google Places 실패: ${place.placeNameSnapshot}`, err instanceof Error ? err.message : err);
      }

      // Rate limit 방지
      if (i < enriched.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    console.log(`[PlaceEnricher] Layer 3 (Google): ${googleSuccess}/${enriched.length}개 보강`);

    // ─── 좌표 범위 검증 (Layer 3 후) ───
    const boundsInvalidL3 = validateCoordinateBounds(enriched);
    if (boundsInvalidL3 > 0) {
      console.log(`[PlaceEnricher] Layer 3 후 좌표 범위 검증: ${boundsInvalidL3}개 폐기`);
    }
    failedCount = enriched.filter(p => !p.latitude).length;
  }

  return { enriched, failedCount };
}

/**
 * Google Places 없이 기본값으로 채운 장소 (하위 호환용)
 * @deprecated enrichPlaces()를 사용하세요
 */
export function toUnverifiedPlaces(places: AIPlaceRecommendation[]): EnrichedPlace[] {
  return places.map(p => ({
    ...p,
    latitude: null,
    longitude: null,
    address: null,
    businessHours: null,
    closedDays: null,
    rating: null,
    googlePlaceId: null,
    photoUrl: null,
    verified: false,
  }));
}
