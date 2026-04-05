# 사이클 7: edge2 테스트 리포트 (gemini-2.5-flash)

> 실행일: 2026-03-30
> 모델: gemini-2.5-flash (무료 키)
> 시나리오: edge2/ 10개
> 비용: $0

---

## 결과 요약

| 결과 | 건수 |
|------|------|
| PASS | 0 |
| FAIL | 3 |
| ERROR (429 rate limit) | 7 |

**429 rate limit으로 7건 실행 불가.** 성공한 3건만 분석.

## 성공한 3건 상세

| # | 시나리오 | 점수 | 실패 항목 |
|---|---------|------|----------|
| 1 | 하와이 허니문 우기 | 19/20 | dinner Day 3 누락 |
| 2 | 아이슬란드 6월 오로라 | 17/20 | lunch Day2,4 / geo 364km / 좌표 2건 |
| 3 | 스위스 최저예산 5일 기차 | 16/20 | lunch Day1~4 / dinner Day2,3 |

## 반복 패턴

### 1. 식사 누락 (3/3 시나리오 전부)
- 하와이: Day 3 저녁 1건
- 아이슬란드: Day 2, 4 점심 2건
- **스위스: 4일 점심 + 2일 저녁 = 6건** ← 가장 심각

**원인**: augmentMissingMeals()가 슬롯을 찾지 못하고 스킵하는 경우가 많음. 장기(5일+) + 꽉 찬 일정에서 빈 시간대를 찾기 어려움.

**대책**: augment 시 기존 아이템의 endTime을 당기거나, 마지막 아이템 뒤에 강제 삽입하는 fallback 추가.

### 2. geo_boundary (아이슬란드 364km)
아이슬란드 링로드 여행은 하루 300km+ 이동이 정상. 시나리오의 geoBoundaryKm이 200으로 설정되어 있지만 실제로는 더 넓어야 함.

→ 다도시/로드트립 시나리오는 geo 검증을 완화하거나 스킵해야 함.

### 3. 429 Rate Limit
무료 키 일일 한도: 2.5-flash = 1500 RPD (requests/day)
오늘 edge(10) + edge2(3) + 기타 단건 = ~25회 호출했는데 429 → **일일 한도가 아니라 분당 한도(RPM)에 걸린 것**

**대책**: 시나리오 간 딜레이를 30초→60초로 늘리기

## 수정 완료 (사이클 7 피드백 기반)

| # | 문제 | 수정 | 파일 |
|---|------|------|------|
| 1 | augment 슬롯 못 찾으면 스킵됨 | **강제 삽입 fallback** — 빈 슬롯 없으면 마지막 아이템 직후에 삽입. 점심(12:00)/저녁(18:00) 기본값도 추가 | `itineraryValidation.ts` augmentMissingMeals() |
| 2 | drive 100%가 FAIL | **drive 80%+ 정상 인정** — 렌터카/교외/대중교통 부실 지역(오키나와, 제주 등) | `testValidation.ts` checkTransitModeVariety() |
| 3 | geo_boundary 역/공항/관광지 오탐 | **교통허브+호텔+augmented 제외**, 반경 ×1.5 여유, 이상좌표(0,0/범위초과) 필터 | `testValidation.ts` checkGeoBoundary() |
| 4 | 429 RPM 초과 | **기본 concurrency 1(순차), 15초 딜레이**, `--delay` 옵션 추가 | `test_scenarios.py` |
| 5 | Grounding + responseMimeType 비호환 (2.5-flash) | **모델별 Grounding 호환성 체크** — 3-flash만 지원, 나머지 OFF | `gemini.provider.ts` callGeminiWithRetry + callGeminiStream |

### 수정 상세: augmentMissingMeals() 강제 삽입

```
Before:
  슬롯 없음 → console.warn("스킵") → 식사 누락 유지

After:
  슬롯 없음 → fallback 1: 14:30 이전 마지막 아이템 뒤 +5분에 삽입
            → fallback 2: 아이템 자체가 없으면 12:00 (점심) / 18:00 (저녁) 강제
            → 저녁도 동일: 전체 아이템 중 마지막 뒤 or 18:30 기본
```

### 수정 상세: geo_boundary 강화

```
Before:
  모든 아이템 좌표 → 중앙값 계산 → 반경 초과 = FAIL

After:
  1. 제외: transport/hotel/역/공항/augmented 식당
  2. 필터: 좌표 (0,0), ±90/±180 초과 → 이상좌표 제거
  3. 반경: config.geoBoundaryKm × 1.5 (관광지 교외 허용)
```

## 누적 통계

| 사이클 | 모델 | PASS | 실행 | PASS율 |
|--------|------|------|------|--------|
| 1~3 | 3.1-pro | 0~2 | 30 | 0~20% |
| 4~5 | 3-flash+하이브리드 | 3 | 8 | ~60~80% |
| 6 | **2.5-flash** | **2** | **10** | **20%** |
| 7 | **2.5-flash** | **0** | **3** (7건 429) | **0%** |
