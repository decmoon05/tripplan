# API 비용 관리 가이드

> 최종 업데이트: 2026-04-02
> 기준: Google Maps Platform 2025.03 가격 개편 이후

---

## 사용 중인 API 전체 목록

### 유료 API

| API | SKU | 단가/건 | 월 무료 | 키 위치 |
|-----|-----|---------|--------|---------|
| **Gemini 3-flash** | — | ~$0.001/건 | 250 RPD | `GEMINI_API_KEY` |
| **Gemini 2.5-flash** | — | ~$0.0008/건 | 1,500 RPD | `GEMINI_API_KEY` |
| **Places Text Search Pro** | Pro | **$0.032/건** | **5,000/월** | `GOOGLE_PLACES_API_KEY` |
| **Places Text Search Essentials** | Essentials | $0.005/건 | 10,000/월 | 같은 키 |
| **Routes Compute Essentials** | Essentials | $0.005/건 | 10,000/월 | `GOOGLE_MAPS_API_KEY` |
| **Dynamic Maps** | Essentials | $0.007/로드 | 10,000/월 | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |

### 무료 API

| API | 한도 | 프로덕션 | 용도 |
|-----|------|---------|------|
| **Geoapify** | 3,000/일, 5req/sec | ✅ | 좌표 검색 (Free+Pro) |
| **Nominatim** | 1req/sec | ⚠️ 합리적 사용 | Geoapify fallback |
| **Overpass** | 자동 부하 분산 | ⚠️ 합리적 사용 | 영업시간 |
| **OSRM Demo** | 1req/sec | **❌ 프로덕션 금지** | 이동시간 보조 |

---

## FieldMask와 비용의 관계

Google Places API (New)는 **요청한 필드에 따라 SKU가 결정**됨:

```
Essentials 필드 ($0.005/건, 10,000 무료):
  places.id, places.displayName, places.formattedAddress,
  places.location, places.types

Pro 필드 ($0.032/건, 5,000 무료):
  + places.rating              ← Pro 트리거
  + places.regularOpeningHours ← Pro 트리거
  + places.photos              ← Pro 트리거
  + places.userRatingCount     ← Pro 트리거
  + places.priceLevel          ← Pro 트리거
```

**하나라도 Pro 필드를 요청하면 전체가 Pro 요금.**

### 현재 코드 (googlePlaces.service.ts)
```typescript
const PLACE_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.location', 'places.rating', 'places.userRatingCount',
  'places.priceLevel', 'places.regularOpeningHours',
  'places.types', 'places.photos',
].join(',');
// → Pro SKU: $0.032/건
```

### 비용 절감 방법
```
Free 유저: rating/hours/photos 제거 → Essentials $0.005/건 (84% 절감)
Pro 유저: 현재 그대로 → Pro $0.032/건
```

---

## 월간 비용 예측

### 무료 한도 내 (소규모)

| 상황 | Places | Routes | Maps | Gemini | 합계 |
|------|--------|--------|------|--------|------|
| 테스트 10건 | 200건 (무료) | 0 | 0 | $0.47 | **$0.47** |
| MAU 100명 | ~2,000건 (무료) | ~500건 (무료) | ~1,000건 (무료) | $2.10 | **$2.10** |

### 무료 한도 초과 (성장기)

| MAU | Places 호출 | 무료 5,000건 | 초과분 | Places 비용 | Gemini | 합계 |
|-----|-----------|------------|--------|-----------|--------|------|
| 500명 | ~8,000건 | -5,000 | 3,000 | $96 | $10 | **$106** |
| 1,000명 | ~16,000건 | -5,000 | 11,000 | $352 | $21 | **$373** |
| 5,000명 | ~80,000건 | -5,000 | 75,000 | $2,400 | $105 | **$2,505** |

### FieldMask 최적화 시 (Essentials)

| MAU | 초과분 | Essentials 비용 | Pro 비용 | 절감 |
|-----|--------|----------------|---------|------|
| 1,000명 | 11,000건 | **$55** | $352 | **84%** |
| 5,000명 | 75,000건 | **$375** | $2,400 | **84%** |

---

## 비용 안전장치 (코드)

1. **Gemini Pro 모델 차단**: `models.ts` — 3.1-pro, 2.5-pro 자동 차단
2. **Places 플랜별 분기**: `getPlanFeatures()` — Free는 Places 스킵
3. **비용 추적**: `V3CostTracker` — 매 생성마다 실제 비용 계산
4. **Google API 가격표**: `GOOGLE_API_PRICING` — 코드 내 정확한 가격 참조

---

## 참고 링크

- [Google Maps Platform 가격표](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Places API 필드별 SKU](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing)
- [Geoapify 가격](https://www.geoapify.com/pricing/)
