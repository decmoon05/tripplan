# TripPlan 전체 개발 로드맵

> **최종 업데이트: 2026-03-29**
> **Phase 1~5 구현 완료.** 아래 미구현 항목만 남음.

## 구현 완료 상태

| Phase | 상태 | 완료일 |
|-------|------|--------|
| Phase 1: 신뢰도 확보 | ✅ 완료 | 2026-03-29 |
| Phase 2: 실용성 확보 | ✅ 완료 | 2026-03-29 |
| Phase 3: 완성도 확보 | ✅ 완료 (이메일 발송 제외) | 2026-03-29 |
| Phase 4: 차별화 | ✅ 완료 | 2026-03-29 |
| Phase 5: 확장 | ✅ 완료 (다국어/커뮤니티 제외) | 2026-03-29 |

### 미구현 잔여 항목
- **이메일 리마인더 발송**: Supabase Edge Function + Resend 연동 필요
- **다국어 (i18n)**: next-intl + 전체 UI 텍스트 추출 (별도 스프린트)
- **커뮤니티/리뷰 (/explore)**: public_trips, trip_reviews (기획 필요)
- **이전 여행 기반 AI 추천**: 평점 데이터를 AI 프롬프트에 주입
- **Google Directions API**: 교통편 실시간 시간/비용

## Context (원본 계획)

TripPlan은 AI 기반 여행 계획 앱. 핵심 흐름(프로필 → AI 일정 생성 → 조회/수정)은 동작하지만, 여행 앱으로서 필수 기능들이 빠져있고 기존 기능도 간소함. 전체 로드맵을 수립하여 체계적으로 개발한다.

---

## Phase 1: 신뢰도 확보 (1~2주)
> 사용자가 "이 앱 정보 맞아?" 의심하지 않도록

### 1-1. 실시간 날씨 API 통합
- **현재**: AI가 추정치로 생성 (검증 안 됨)
- **목표**: OpenWeather API 연동, 여행 기간 날씨 예보 표시
- **파일**: `src/lib/services/weather.service.ts` (신규), `src/app/api/v1/weather/route.ts` (신규)
- **UI**: TripDetailView에 날씨 카드 추가 (일별 기온/강수확률/아이콘)
- **환경변수**: `OPENWEATHER_API_KEY`

### 1-2. 실시간 환율 API 통합
- **현재**: `KRW_TO_LOCAL` 하드코딩 (ai.service.ts)
- **목표**: ExchangeRate API 연동, 실시간 환율 표시
- **파일**: `src/lib/services/exchange.service.ts` (신규), 기존 `ai.service.ts`의 하드코딩 교체
- **UI**: TripDetailView 상단에 환율 정보 배지
- **캐싱**: 6시간 캐시 (API 호출 최소화)

### 1-3. 비상 연락처 & 현지 정보
- **현재**: 전무
- **목표**: 목적지별 대사관, 긴급번호, 병원 정보
- **파일**: `src/lib/data/emergency-contacts.ts` (정적 데이터), TripDetailView에 탭 추가
- **데이터**: 주요 여행지 20곳 수동 입력 + AI 보조 생성

---

## Phase 2: 실용성 확보 (2~3주)
> "이 앱 없이 여행 못 가겠다" 만들기

### 2-1. 준비물 체크리스트
- **현재**: 전무
- **목표**: AI가 여행지/기간/날씨 기반 준비물 자동 추천 + 사용자 커스텀
- **DB**: `trip_checklists` 테이블 (trip_id, item, checked, category, created_at)
- **API**: `/api/v1/trips/[tripId]/checklist` (GET/POST/PUT)
- **UI**: TripDetailView에 체크리스트 탭 (카테고리: 서류, 의류, 전자기기, 의약품, 기타)
- **AI**: 프로필(체력, 동행자 유형) + 날씨 기반 맞춤 추천

### 2-2. 일정 내보내기 (PDF)
- **현재**: 공유 링크만 있음
- **목표**: PDF 다운로드 (일정표 + 지도 스냅샷 + 비상 연락처)
- **라이브러리**: `@react-pdf/renderer` 또는 서버사이드 `puppeteer`
- **API**: `/api/v1/trips/[tripId]/export` (GET, format=pdf)
- **UI**: TripDetailView 상단 "PDF 다운로드" 버튼

### 2-3. 일정 내보내기 (캘린더 ICS)
- **목표**: Google Calendar/Apple Calendar에 일정 추가
- **형식**: ICS 파일 생성 (.ics)
- **API**: `/api/v1/trips/[tripId]/export?format=ics`

### 2-4. 예산 관리 강화
- **현재**: 항목별 estimatedCost 합산만
- **목표**: 카테고리별 예산 설정 + 실제 지출 기록 + 비교 차트
- **DB**: `trip_expenses` 테이블 (trip_id, category, amount, currency, memo, date)
- **UI**: TripDetailView에 예산 탭 (원형 차트: 예상 vs 실제, 카테고리별 바)

---

## Phase 3: 완성도 확보 (3~4주)
> 경쟁 앱과 대등한 수준

### 3-1. 숙소 추천
- **현재**: TripItem에 숙소 카테고리 없음
- **목표**: 예산/위치 기반 숙소 추천 (Google Places hotel 카테고리 활용)
- **기존 활용**: `googlePlaces.service.ts`에 hotel 타입 이미 매핑됨
- **AI**: 일정 생성 시 숙소도 함께 추천하도록 프롬프트 확장
- **UI**: 일정에 숙소 카드 (체크인/체크아웃, 가격대, 위치)

### 3-2. 교통편 상세
- **현재**: transitMode, transitDurationMin, transitSummary만 저장
- **목표**: Google Directions API 연동, 실제 경로/시간/비용 표시
- **파일**: `src/lib/services/directions.service.ts` (신규)
- **UI**: 일정 항목 간 교통 카드 (도보/지하철/버스/택시 옵션별 시간+비용)

### 3-3. 경로 최적화
- **현재**: AI가 생성한 순서 그대로
- **목표**: 같은 날 일정의 동선 최적화 (TSP 근사 알고리즘)
- **구현**: 서버사이드 greedy nearest-neighbor 또는 Google Routes API
- **UI**: "동선 최적화" 버튼 → 전후 비교

### 3-4. 알림 & 리마인더
- **현재**: 전무
- **목표**: 이메일 기반 리마인더 (여행 3일 전, 당일 아침)
- **인프라**: Supabase Edge Functions + Resend/SendGrid
- **설정**: 마이페이지에서 알림 on/off

---

## Phase 4: 차별화 (4~6주)
> "이 앱만의 이유"

### 4-1. Travel Room 실시간 동기화
- **현재**: 폴링 방식, 새로고침해야 업데이트
- **목표**: Supabase Realtime 활용한 실시간 업데이트
- **구현**: `supabase.channel()` 구독, travel_room_members 변경 감지
- **UI**: 실시간 멤버 프로필 카드 업데이트, "입장함" 알림

### 4-2. Travel Room 투표 기능
- **현재**: 호스트만 일정 생성
- **목표**: 생성된 일정에 멤버 투표 (좋아요/싫어요)
- **DB**: `room_votes` 테이블 (room_id, user_id, item_id, vote)
- **UI**: 일정 항목마다 👍/👎 + 투표 현황 바

### 4-3. Travel Room 채팅
- **목표**: 방 내 간단한 채팅 (일정 논의용)
- **DB**: `room_messages` 테이블 (room_id, user_id, message, created_at)
- **실시간**: Supabase Realtime

### 4-4. 마이페이지 강화
- **현재**: 프로필 편집만
- **목표**: 여행 이력 타임라인, 방문 국가 지도, 여행 통계
- **UI**: 탭 구조 (프로필 | 여행 이력 | 통계 | 설정)

### 4-5. 이전 여행 기반 추천
- **현재**: 프로필만 활용
- **목표**: 이전 여행에서 높게 평가한 장소 유형 학습
- **DB**: `trip_ratings` (trip_id, item_id, rating)
- **AI 프롬프트**: 이전 선호 데이터 주입

---

## Phase 5: 확장 (6주+)
> 시장 확장

### 5-1. PWA & 오프라인 모드
- **목표**: 서비스 워커로 일정 데이터 로컬 캐싱
- **구현**: next-pwa, workbox
- **범위**: 일정 조회만 오프라인 지원 (생성은 온라인 필수)

### 5-2. 다국어 지원
- **목표**: 영어, 일본어 추가
- **구현**: next-intl
- **범위**: UI 텍스트 + AI 응답 언어 설정

### 5-3. 사진 갤러리
- **목표**: 여행 추억 사진 업로드/관리
- **인프라**: Supabase Storage
- **UI**: 여행별 갤러리 탭

### 5-4. 커뮤니티 & 리뷰
- **목표**: 공개 일정 검색/평점/코멘트
- **DB**: `public_trips`, `trip_reviews`
- **UI**: 탐색 페이지 (/explore)

---

## 수정 파일 요약 (Phase 1 상세)

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/services/weather.service.ts` | 신규 — OpenWeather API 연동 |
| `src/lib/services/exchange.service.ts` | 신규 — 환율 API 연동 |
| `src/lib/data/emergency-contacts.ts` | 신규 — 비상 연락처 정적 데이터 |
| `src/app/api/v1/weather/route.ts` | 신규 — 날씨 API 엔드포인트 |
| `src/app/api/v1/exchange/route.ts` | 신규 — 환율 API 엔드포인트 |
| `src/lib/services/ai.service.ts` | 하드코딩 환율 제거, 실시간 환율 사용 |
| `src/components/features/trip-view/TripDetailView.tsx` | 날씨/환율/비상연락처 UI 추가 |
| `src/types/database.ts` | WeatherData, ExchangeRate 타입 추가 |
| `.env.example` | `OPENWEATHER_API_KEY` 추가 |

---

## 검증 계획

### Phase 1 완료 기준
1. `/trips/[tripId]` 페이지에서 날씨 카드 표시 (일별 기온/아이콘)
2. 환율 정보 실시간 표시 (KRW → 현지통화)
3. 비상 연락처 탭에서 대사관/긴급번호 확인
4. `preview_screenshot`으로 UI 확인
5. API 에러 시 graceful fallback (날씨 못 가져와도 앱 안 깨짐)
