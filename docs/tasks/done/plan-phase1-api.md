# Phase 1 실시간 API 통합 — 계획서

> 작성일: 2026-03-29
> 목표: 실시간 날씨 + 환율 + 비상 연락처 통합으로 신뢰도 확보

## 배경

TripPlan은 AI가 추정치로 날씨·환율 정보를 생성한다. 실제 데이터와 다를 수 있어 "이 앱 정보 맞아?" 의심을 유발. Phase 1에서 실시간 API를 연동한다.

## 구현 범위

### 1-1. 날씨 API (OpenWeather)
- `src/lib/services/weather.service.ts` — API 호출 + 캐싱 (1시간)
- `src/app/api/v1/weather/route.ts` — Next.js API Route (destination + startDate 파라미터)
- `TripDetailView`에 날씨 카드 추가 (일별 기온/날씨 아이콘/강수확률)
- 에러 시 graceful fallback (날씨 못 가져와도 앱 안 깨짐)

### 1-2. 환율 API (ExchangeRate-API)
- `src/lib/services/exchange.service.ts` — API 호출 + 캐싱 (6시간)
- `src/app/api/v1/exchange/route.ts` — Next.js API Route (from/to 파라미터)
- `TripDetailView`에 환율 배지 추가
- `ai.service.ts`의 하드코딩 환율 교체

### 1-3. 비상 연락처 (정적 데이터)
- `src/lib/data/emergency-contacts.ts` — 주요 여행지 비상 연락처
- `TripDetailView`에 비상정보 섹션 추가

## 기술 선택
- OpenWeather: `api.openweathermap.org/data/2.5/forecast` (5일 3시간 예보)
- ExchangeRate: `open.er-api.com/v6/latest/{base}` (무료, CORS 지원)
- 캐싱: Node.js Map 기반 인메모리 캐시 (서버리스 재시작 시 초기화 허용)
- Env: `OPENWEATHER_API_KEY` 추가 필요

## 의존성
- 기존 서비스 패턴 (`googlePlaces.service.ts`) 참조
- `TripDetailView` Trip Overview 카드 하단에 UI 추가
