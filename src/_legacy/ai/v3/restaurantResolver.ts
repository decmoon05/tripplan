/**
 * Restaurant Resolver — 좌표 없는 음식점을 실제 식당으로 교체
 *
 * AI가 "신주쿠 라멘 맛집" 같은 일반명을 생성했을 때,
 * Overpass API로 해당 지역의 실제 식당을 찾아 교체한다.
 *
 * ItiNera 논문 방식: AI가 "라멘"이라고 하면, 알고리즘이 실제 라멘집을 배치
 */

import { queryNearbyPOI, type OverpassPOI } from '@/lib/services/overpass.service';
import { searchPlace } from '@/lib/services/nominatim.service';
import { parseOsmOpeningHours } from '@/lib/utils/osm-hours-parser';
import type { EnrichedPlace } from './types';

/**
 * 좌표가 없는 restaurant/cafe를 실제 식당으로 교체한다.
 *
 * 전략:
 * 1. 같은 날 좌표 있는 장소의 중심점 계산
 * 2. 중심점 반경 1km에서 Overpass로 실제 식당 검색
 * 3. cuisine 매칭 (AI notes에 "라멘" 있으면 cuisine=ramen 우선)
 * 4. 매칭 성공 → 실제 식당으로 교체 (이름, 좌표, 영업시간)
 *
 * @param places - 보강된 장소 리스트 (일부 좌표 null)
 * @param destination - 목적지 도시
 * @returns 교체된 수
 */
export async function resolveNullCoordRestaurants(
  places: EnrichedPlace[],
  destination: string,
): Promise<number> {
  const nullRestaurants = places.filter(
    p => (p.category === 'restaurant' || p.category === 'cafe') &&
      p.latitude == null,
  );

  if (nullRestaurants.length === 0) return 0;

  console.log(`[RestaurantResolver] 좌표 없는 식당 ${nullRestaurants.length}건 해결 시도`);

  // 좌표 있는 장소들의 중심점 (도시 대표 좌표)
  const withCoords = places.filter(p => p.latitude != null && p.longitude != null);
  let centerLat: number;
  let centerLon: number;

  if (withCoords.length > 0) {
    centerLat = withCoords.reduce((sum, p) => sum + p.latitude!, 0) / withCoords.length;
    centerLon = withCoords.reduce((sum, p) => sum + p.longitude!, 0) / withCoords.length;
  } else {
    // 좌표 있는 장소가 없으면 도시 검색
    const cityResult = await searchPlace(destination, destination);
    if (!cityResult) return 0;
    centerLat = cityResult.lat;
    centerLon = cityResult.lon;
  }

  // Overpass로 중심점 반경 2km 식당 검색
  const nearbyRestaurants = await queryNearbyPOI(centerLat, centerLon, 2000, 'restaurant');
  const nearbyCafes = await queryNearbyPOI(centerLat, centerLon, 2000, 'cafe');
  const allNearby = [...nearbyRestaurants, ...nearbyCafes];

  if (allNearby.length === 0) {
    console.log(`[RestaurantResolver] ${destination} 주변에 식당 없음`);
    return 0;
  }

  // 이미 사용된 식당 이름 (중복 방지)
  const usedNames = new Set(places.map(p => p.placeNameSnapshot.toLowerCase()));
  let resolved = 0;

  for (const restaurant of nullRestaurants) {
    // cuisine 키워드 추출 (AI notes에서)
    const keywords = extractCuisineKeywords(restaurant.notes || '', restaurant.placeNameSnapshot);

    // 매칭: cuisine 키워드가 있으면 우선, 없으면 아무 식당
    const match = findBestMatch(allNearby, keywords, usedNames);

    if (match) {
      // 교체
      const oldName = restaurant.placeNameSnapshot;
      restaurant.placeNameSnapshot = formatPlaceName(match);
      restaurant.latitude = match.lat;
      restaurant.longitude = match.lon;
      if (match.openingHours) {
        const parsed = parseOsmOpeningHours(match.openingHours);
        restaurant.businessHours = parsed.businessHours;
        restaurant.closedDays = parsed.closedDays;
      }
      restaurant.verified = true;

      usedNames.add(match.name.toLowerCase());
      resolved++;

      console.log(`[RestaurantResolver] "${oldName}" → "${restaurant.placeNameSnapshot}" (${match.lat.toFixed(4)}, ${match.lon.toFixed(4)})`);
    }
  }

  console.log(`[RestaurantResolver] ${resolved}/${nullRestaurants.length}건 해결`);
  return resolved;
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/** AI notes/이름에서 음식 키워드 추출 */
function extractCuisineKeywords(notes: string, name: string): string[] {
  const text = `${notes} ${name}`.toLowerCase();
  const keywords: string[] = [];

  const cuisineMap: Record<string, string[]> = {
    ramen: ['라멘', 'ramen', 'ラーメン'],
    sushi: ['스시', 'sushi', '寿司', '초밥'],
    japanese: ['일식', 'japanese', '和食', '이자카야', '居酒屋'],
    korean: ['한식', 'korean', '韓国'],
    chinese: ['중식', 'chinese', '中華'],
    italian: ['이탈리안', 'italian', 'パスタ', '피자'],
    curry: ['카레', 'curry', 'カレー'],
    seafood: ['해산물', 'seafood', '해물', '魚'],
    vegetarian: ['채식', 'vegan', 'vegetarian', '비건'],
    halal: ['할랄', 'halal'],
    cafe: ['카페', 'cafe', 'coffee', '커피'],
    bbq: ['야키니쿠', '焼肉', 'bbq', '고기'],
    noodle: ['우동', 'udon', '소바', 'soba', '국수'],
    tempura: ['텐동', '텐푸라', 'tempura', '天ぷら'],
    tonkatsu: ['돈카츠', 'tonkatsu', 'とんかつ'],
  };

  for (const [cuisine, patterns] of Object.entries(cuisineMap)) {
    if (patterns.some(p => text.includes(p))) {
      keywords.push(cuisine);
    }
  }

  return keywords;
}

/** cuisine 매칭으로 최적 식당 찾기 */
function findBestMatch(
  pois: OverpassPOI[],
  cuisineKeywords: string[],
  usedNames: Set<string>,
): OverpassPOI | null {
  // 이미 사용된 이름 제외
  const available = pois.filter(p => !usedNames.has(p.name.toLowerCase()));
  if (available.length === 0) return null;

  // cuisine 매칭 시도
  if (cuisineKeywords.length > 0) {
    for (const poi of available) {
      const poiCuisine = (poi.cuisine || '').toLowerCase();
      if (cuisineKeywords.some(k => poiCuisine.includes(k))) {
        return poi;
      }
    }
  }

  // 매칭 실패 → 아무 식당 (이름 있는 것 우선)
  const withName = available.filter(p => p.name && p.name !== 'Unknown');
  return withName.length > 0 ? withName[0] : available[0];
}

/** POI → 표시 이름 (한국어 + 현지어) */
function formatPlaceName(poi: OverpassPOI): string {
  if (poi.nameLocal) {
    return `${poi.nameLocal} (${poi.name})`;
  }
  return poi.name;
}
