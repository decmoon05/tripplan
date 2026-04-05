import type { TripItem } from '@/types/database';
import { verifyPlace } from '@/lib/services/googlePlaces.service';

/**
 * AI 생성 아이템을 사후 검증.
 * - cachedPlaceIds에 있는 googlePlaceId → verified=true (스킵)
 * - 없는 아이템 → Google Places Text Search로 검증
 * - 매칭 성공 → Google 데이터로 덮어쓰기 + verified=true
 * - 매칭 실패 → verified=false 유지
 */
export async function postValidateItems(
  items: TripItem[],
  destination: string,
  cachedPlaceIds: Set<string>,
): Promise<TripItem[]> {
  const hasGoogleKey = !!process.env.GOOGLE_PLACES_API_KEY;
  const skipVerify = process.env.SKIP_PLACES_VERIFY === 'true';
  if (!hasGoogleKey) return items;

  // SKIP_PLACES_VERIFY=true: 전체 스킵 대신, 좌표 null인 아이템만 보완
  if (skipVerify) {
    console.log('[PostValidate] SKIP_PLACES_VERIFY=true → 좌표 null인 아이템만 Places 보완');
    const nullCoordItems = items.filter(it =>
      (it.latitude == null || it.longitude == null) &&
      it.category !== 'transport' && it.category !== 'hotel' &&
      !it.placeNameSnapshot.includes('현지 점심') && !it.placeNameSnapshot.includes('현지 저녁')
    );
    if (nullCoordItems.length === 0) return items;
    console.log(`[PostValidate] 좌표 null ${nullCoordItems.length}건 보완 시도`);

    const nullIds = new Set(nullCoordItems.map(it => it.id));
    const results: TripItem[] = [];
    for (const item of items) {
      if (!nullIds.has(item.id)) { results.push(item); continue; }
      try {
        const result = await Promise.race([
          verifyPlace(item.placeNameSnapshot, destination),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
        ]);
        if (result) {
          results.push({
            ...item,
            latitude: result.latitude ?? item.latitude,
            longitude: result.longitude ?? item.longitude,
            address: result.address || item.address,
            googlePlaceId: result.googlePlaceId || item.googlePlaceId,
            verified: true,
          });
        } else {
          results.push(item);
        }
      } catch {
        results.push(item);
      }
    }
    return results;
  }

  // 배치 처리 (Google API rate limit 방지, 3개씩 동시 처리)
  const CONCURRENCY = 3;
  const results: TripItem[] = [];

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        // 이미 검증된 장소 (캐시에 있는 placeId만 신뢰)
        if (item.googlePlaceId && cachedPlaceIds.has(item.googlePlaceId)) {
          return { ...item, verified: true };
        }

        // 미검증 장소 → Google Places로 검증 시도
        try {
          const result = await Promise.race([
            verifyPlace(item.placeNameSnapshot, destination),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
          ]);

          if (result) {
            return {
              ...item,
              verified: true,
              googlePlaceId: result.googlePlaceId,
              address: result.address || item.address,
              latitude: result.latitude ?? item.latitude,
              longitude: result.longitude ?? item.longitude,
              businessHours: result.businessHours || item.businessHours,
              closedDays: result.closedDays || item.closedDays,
            };
          }

          // 매칭 실패
          return { ...item, verified: false };
        } catch (err) {
          console.warn('[PostValidate] 검증 실패:', err instanceof Error ? err.message : err);
          return item;
        }
      }),
    );
    results.push(...batchResults);
  }

  return results;
}
