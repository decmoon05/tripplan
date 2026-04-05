# Tripplan PRD (Product Requirements Document)

> 작성일: 2026-03-08
> 최종 수정: 2026-03-24
> 버전: 2.0
> 상태: Phase 1~2 구현 완료

## 1. 제품 개요

**Tripplan**은 AI 기반 개인화 여행 계획 서비스로, 사용자의 성향(MBTI, 라이프스타일, 식성, 관심사 등)을 분석하여 맞춤형 여행 일정을 자동 생성합니다.

**핵심 차별점:** Anti-OTA 포지셔닝 — 패키지 상품 판매가 아닌, 사용자 개인에 최적화된 자유여행 일정 설계. Google Places API를 통한 실제 장소 검증(Hybrid RAG)으로 AI 할루시네이션을 방지합니다.

## 2. 기술 스택

| 영역 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 프론트엔드 | Next.js + React | 16 / 19 | App Router, 서버/클라이언트 컴포넌트 분리 |
| 스타일 | Tailwind CSS | 4 | CSS 변수 기반 테마, 유틸리티 우선 |
| 타입 | TypeScript | 5 | 전체 코드베이스 타입 안전성 |
| 백엔드/BaaS | Supabase | - | Auth, PostgreSQL, RLS, Storage 통합 |
| AI (메인) | OpenAI GPT-5.4-mini / Claude Sonnet 4.6 | - | Strategy 패턴으로 교체 가능 |
| AI (게이트웨이) | factchat-cloud.mindlogic.ai | - | 내부 API 게이트웨이 경유 |
| 장소 데이터 | Google Places API (New) | v1 | 장소 검색, 상세 정보, 사진, 검증 |
| 지도 | Google Maps JavaScript API | weekly | AdvancedMarkerElement, 경로 표시 |
| 배포 | Vercel | - | Next.js 최적화 배포 |

### 주요 라이브러리

| 용도 | 라이브러리 | 비고 |
|------|-----------|------|
| 서버 상태 관리 | TanStack Query 5 | 캐싱, 리페칭, 뮤테이션 |
| 클라이언트 상태 | Zustand (persist) | 프로필 폼 상태 유지 |
| 입력 검증 | Zod v4 | 서버/클라이언트 스키마 공유 |
| 폼 관리 | React Hook Form + zodResolver | Zod 연동 |
| AI SDK | `openai`, `@anthropic-ai/sdk` | 스트리밍 지원 |
| 드래그앤드롭 | `@dnd-kit/core` | 타임라인 카드 순서 변경 |
| 지도 로더 | `@googlemaps/js-api-loader` | 동적 Google Maps 로드 |

## 3. 개발 단계 및 현재 상태

### Phase 1: 핵심 기능 (MVP) ✅ 완료
- 사용자 성향 입력 (5단계 온보딩: MBTI → 라이프스타일 → 식성 → 관심사 → 확인)
- AI 기반 여행 일정 생성 (1~7일, 청크 분할)
- 일정 시각화 (타임라인 + 지도 동시 표시)
- 일정 수정 (항목 추가/편집/삭제, 드래그 순서 변경)
- Mock Data 기반 개발 완료

### Phase 2: 핵심 연동 ✅ 완료
- 실제 AI API 연동 (OpenAI + Claude, Strategy 패턴)
- Google Places Hybrid RAG (장소 검증 파이프라인)
- Supabase Auth (이메일/비밀번호)
- 일정 저장/불러오기 (대시보드)
- 공유 기능 (토큰 기반 링크 공유)
- Rate Limiting (엔드포인트별 일일 제한)
- 관리자 시스템 (통계, 사용자 관리)

### Phase 2.5: UX 개선 ✅ 완료
- 대시보드 (여행 목록, 삭제)
- 마이페이지 (프로필 확인/수정)
- 자동 진행 (여행 스타일 선택 시 자동 다음 단계)
- 지도+타임라인 동시 표시 (데스크톱 분할 레이아웃)
- 비행기 도착시간/숙소 위치 AI 반영
- 커스텀 관심사/식성 자유 입력
- 장소 카드 이미지 (Google Places Photos)

### Phase 3: 수익화 (미구현)
- PG사 결제 연동 (건별 2,900원 안심팩)
- 제휴 수수료 모델 (숙소/항공 예약 연계)
- 네이티브 광고 (여행 관련)

## 4. 핵심 기능 상세

### 4.1 사용자 프로파일링 (질문 분리 아키텍처)

**온보딩 (1회, `/onboarding`)** — 개인 성향, DB에 영구 저장

| 단계 | 입력 항목 | 선택지 |
|------|-----------|--------|
| 1 | MBTI | 16개 유형 |
| 2 | 라이프스타일 | 아침형(early/moderate/late), 체력(high/moderate/low), 모험도(explorer/balanced/cautious), 사진스타일(sns/casual/minimal) |
| 3 | 식성 | 8개 제한사항 + 커스텀 자유입력 (100자) |
| 4 | 관심사 | 38개 태그(5카테고리) + 커스텀 자유입력 (200자) |
| 5 | 확인 | 요약 표시 후 저장 |

**여행 생성 (매번, `/trips/new`)** — 여행별 설정

| 단계 | 입력 항목 | 선택지 |
|------|-----------|--------|
| 1 | 목적지 + 날짜 | 텍스트 + 날짜 선택기 |
| 1-2 | 도착 시간 | 오전/오후/저녁/미정 (Day 1 일정 시작시간에 반영) |
| 1-3 | 숙소 지역 | 자유입력 (매일 마지막 일정을 숙소 근처로 배치) |
| 2 | 여행 페이스 | relaxed(하루 3~4곳) / moderate(5곳) / active(6곳) — 자동 진행 |
| 3 | 예산 | budget(0.6x) / moderate(1x) / luxury(2.5x) — 자동 진행 |
| 4 | 동행자 | solo/couple/friends/family/family-kids/business — 자동 진행 |
| 5 | 특별 요청 | 자유입력 (500자) |
| 6 | 실현가능성 검사 | AI가 특별 요청의 실현 가능성 평가 → 대안 제시 |
| 7 | 장소 경험 선택 | 인기 장소에 대해 "제외/재방문/새로운/숨기기" 선택 |
| 8 | 생성 | 로딩 애니메이션 → 결과 표시 |

### 4.2 AI 일정 생성 시스템

#### Strategy 패턴 (프로바이더 교체 가능)

```
AI_PROVIDER 환경변수 → mock | openai | claude

선택된 프로바이더 실패 시:
  claude ↔ openai 크로스 폴백 → 최종 mock 폴백
```

| 프로바이더 | 모델 | 특징 |
|-----------|------|------|
| OpenAI | gpt-5.4-mini (기본) | 게이트웨이 호환, 청크 분할, reasoning 모델 감지 |
| Claude | claude-sonnet-4-6 (기본) | 스트리밍/비스트리밍 3단계 재시도, nano 폴백 |
| Mock | 하드코딩 템플릿 | 도쿄/제주 템플릿, 체력별 필터링, 통화 자동 감지 |

#### AI 프롬프트 구조

- **시스템 프롬프트** (3,142자): JSON 출력 형식, 21개 필드 정의, 장소명 한국어+현지어 규칙, 식사 보장, 동선 최적화
- **게이트웨이 압축 프롬프트** (1,000자): system role 사용 불가 시 user에 병합
- **사용자 프롬프트**: 프로필 섹션 + 여행 조건 + 검증된 장소 목록 + 장소 선호도

#### 프롬프트에 반영되는 프로필 요소

| 요소 | AI 지시 방식 |
|------|-------------|
| MBTI | 성향 키워드 전달 |
| 페이스 | "relaxed: max 4 items/day with 2+ hour rest gaps" |
| 예산 | "budget: prioritize free attractions, street food" |
| 체력 | low → "NEVER include intense items, suggest taxi/transit" |
| 아침형 | late → "start after 11am, begin with brunch" |
| 모험도 | explorer → "local alleys, hidden gems, off-the-beaten-path" |
| 식성 | "Diet: vegetarian, no-seafood. MUST respect." |
| 관심사 | "Interests: anime, temple — MUST include matching places" |
| 도착시간 | afternoon → "Day 1 start from 14:00-15:00" |
| 숙소지역 | "Hotel area: 난바. Last activity near hotel each day." |
| 특별요청 | triple-quote 감싸기 + 제어문자 제거 (인젝션 방어) |
| 커스텀 식성/관심사 | 기존 enum에 병합하여 전달 |

#### 청크 분할 생성 (게이트웨이 모드)

- 1일을 morning/afternoon 2청크로 분할
- 청크별 독립 호출 → 이전 청크 결과를 다음 청크에 컨텍스트로 전달
- 중복 제거: 퍼지 이름 매칭 (정규화 후 부분 문자열 비교)
- 시간 중복 해소: `resolveTimeOverlaps()`

#### AI 생성 항목 필드 (21개)

```
dayNumber, orderIndex, placeNameSnapshot, category, startTime, endTime,
estimatedCost, currency, priceConfidence, notes, latitude, longitude,
activityLevel, reasonTags[], address, businessHours, closedDays,
transitMode, transitDurationMin, transitSummary, verified, googlePlaceId
```

### 4.3 Google Places Hybrid RAG (할루시네이션 방지)

AI가 생성한 장소의 실존 여부를 Google Places API로 검증하는 파이프라인.

#### 전체 흐름

```
1. 캐시 로드 (place_cache 테이블, 14일 TTL)
   ↓
2. AI 프롬프트에 [VERIFIED PLACES] 섹션 주입
   → 카테고리별 검증된 장소 목록 제공
   → AI가 이 목록에서 우선 선택하도록 유도
   ↓
3. AI 일정 생성
   ↓
4. 사후 검증 (postValidate)
   → 동시 3건씩 Google Places 퍼지 매칭
   → 매칭 성공 → verified=true, googlePlaceId 할당
   → 매칭 실패 → verified=false (일정에는 포함)
   ↓
5. DB 저장 (trip_items에 verified, google_place_id 포함)
```

#### Google Places 서비스 상세

- **API**: `places.googleapis.com/v1` (New Google Places API)
- **필드 마스크**: id, displayName, formattedAddress, location, rating, currentOpeningHours, regularOpeningHours, types, photos
- **캐시 전략**:
  - 메모리 캐시: 30분 TTL, 최대 100 목적지 (ToS 준수)
  - DB 캐시: `place_cache` 테이블 (destination + google_place_id UNIQUE, 14일 TTL)
  - `photo_reference` 컬럼으로 Google Places Photo URL 생성 가능
- **카테고리 매핑**: Google types → attraction/restaurant/cafe/shopping/hotel
- **재시도**: 429 에러 시 지수 백오프 (1초, 2초)
- **환경변수**: `GOOGLE_PLACES_API_KEY` (없으면 AI/mock 폴백)

#### 인기 장소 추천 (Popular Places)

- **엔드포인트**: `GET /api/v1/ai/popular-places?destination=오사카`
- Google Places에서 카테고리별 검색 → 캐시 → 프론트 표시
- 사용자 관심사/MBTI에 따라 필터링 및 설명 개인화
- 장소 카드에 Google Places Photo 썸네일 표시 (카테고리별 폴백 아이콘)

### 4.4 실현가능성 검사 (Feasibility Check)

- **엔드포인트**: `POST /api/v1/ai/feasibility-check`
- 사용자의 특별 요청이 목적지/기간에서 실현 가능한지 AI가 판단
- 반환: `status: 'no_issues' | 'has_concerns'`, 대안 옵션 목록
- 예: "3일 안에 오키나와 전체를 돌고 싶어요" → "3일로는 오키나와 본섬 위주가 적합합니다" + 대안 제시

### 4.5 장소 확장 (Expand Place)

- **엔드포인트**: `POST /api/v1/ai/expand`
- 타임라인 카드에서 장소를 클릭하면 AI가 세부 옵션을 생성
- 예: "숙소" → 룸 타입별 가격, "레스토랑" → 메뉴 추천
- 비용 반영: 세부 옵션 선택 시 `estimatedCost` 업데이트

### 4.6 일정 검증 시스템 (Itinerary Validation)

AI 생성 후 자동 수행되는 품질 검증:

| 검증 항목 | 설명 |
|-----------|------|
| 시간 중복 해소 | 같은 날 겹치는 시간대 자동 조정 |
| 지리 경계 검증 | 목적지 중심에서 30km 이상 벗어나는 장소 제거 |
| 식사 보장 | 매일 점심(11:00-14:00)과 저녁(17:30-21:00) 포함 여부 확인 |
| 동선 최적화 | 일별 장소 근접 그룹핑, 역주행 최소화 |
| 체력 필터링 | `stamina: low/moderate` → intense 활동 제거/대체 |

### 4.7 장소 선호도 시스템 (Place Preferences)

- **엔드포인트**: `GET/POST /api/v1/place-preferences`
- 여행 생성 전, 인기 장소에 대해 사용자가 선호도 표시:
  - `exclude`: 이미 가봄, 제외
  - `revisit`: 재방문 희망
  - `new`: 새로운 곳 (기본값)
  - `hidden`: 카드에서 숨김
- AI 프롬프트에 반영: "Exclude: [장소명]", "Must include: [장소명]"
- DB 저장: `user_place_preferences` 테이블 (destination별)

### 4.8 통화 및 비용 처리

- AI가 **현지 통화**로 비용 추정 (JPY, THB, EUR 등 — KRW 변환 안 함)
- `priceConfidence`: confirmed(공식 가격) / estimated(AI 추정)
- 프론트에서 이중 표시: "¥1,500 (~₩15,000)"
- 14개 통화 지원 (KRW, JPY, USD, EUR, GBP, THB, VND, TWD, CNY, SGD, HKD, AUD, PHP, MYR)
- 정적 환율 기반 (2026-03 기준)

## 5. 사용자 흐름

### 5.1 페이지 라우트

| 경로 | 접근 | 설명 |
|------|------|------|
| `/` | 공개 | 랜딩 페이지 |
| `/auth/login` | 공개 | 이메일/비밀번호 로그인 |
| `/auth/signup` | 공개 | 회원가입 |
| `/auth/callback` | 공개 | OAuth 콜백 |
| `/onboarding` | 인증 | 프로필 5단계 설정 |
| `/dashboard` | 인증 | 여행 목록 (최신순, 삭제 가능) |
| `/trips/new` | 인증 | 여행 생성 (8단계) |
| `/trips/[tripId]` | 인증 | 여행 상세 (타임라인+지도) |
| `/mypage` | 인증 | 프로필 확인/수정 |
| `/admin` | 관리자 | 통계, 사용자 관리 |
| `/shared/[token]` | 공개 | 공유된 여행 읽기 전용 |

### 5.2 여행 상세 뷰 (Trip View)

- **데스크톱**: 좌우 분할 레이아웃 (왼쪽 타임라인 스크롤 / 오른쪽 지도 sticky)
- **모바일**: 탭 토글 (타임라인 | 지도)
- **상호작용**: 타임라인 카드 hover → 지도 마커 하이라이트 + panTo, 마커 클릭 → 카드 스크롤

### 5.3 타임라인 카드 정보

| 항목 | 내용 |
|------|------|
| 장소명 | 한국어 + 현지어 (예: "센소지 (浅草寺)") |
| 카테고리 | attraction/restaurant/cafe/shopping/transport/hotel |
| 시간 | HH:MM ~ HH:MM (24시간제) |
| 비용 | 현지통화 + KRW 환산 (추정/확인 뱃지) |
| 이동수단 | walk/bus/taxi/subway/train/bicycle/drive/flight/ferry + 소요시간 |
| 활동강도 | light/moderate/intense |
| 추천 사유 | 해시태그 (예: #포토스팟, #힐링, #현지맛집) |
| 검증 여부 | ✓ Google 검증 / 미검증 |
| 메모 | AI 생성 팁 (한국어 2~3문장) |
| 주소 | 현지어 주소 |
| 영업시간 | "09:00-17:00" 또는 null |
| 정기휴일 | "월요일", "연중무휴" 등 |

## 6. 데이터 모델

### 6.1 핵심 테이블

```
auth.users (Supabase 관리)
├── id (UUID)
├── email
└── ... (Supabase 내부)

public.user_profiles
├── user_id (UUID, PK, FK → auth.users.id)
├── role (text: user|developer|admin)
├── mbti_style (text)
├── morning_type (text: early|moderate|late)
├── stamina (text: high|moderate|low)
├── adventure_level (text: explorer|balanced|cautious)
├── photo_style (text: sns|casual|minimal)
├── food_preference (text[])
├── interests (text[])
├── custom_food_preference (text, max 100자)
├── custom_interests (text, max 200자)
├── created_at (timestamptz)
└── updated_at (timestamptz)

public.trips
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users.id)
├── destination (text)
├── start_date (date)
├── end_date (date)
├── status (text: draft|generated|confirmed)
├── share_token (UUID, UNIQUE, nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)

public.trip_items
├── id (UUID, PK)
├── trip_id (UUID, FK → trips.id, CASCADE)
├── day_number (int)
├── order_index (int)
├── place_id (text)
├── place_name_snapshot (text)
├── category (text)
├── start_time (text, "HH:MM")
├── end_time (text, "HH:MM")
├── estimated_cost (int, 현지통화)
├── currency (text, ISO 4217)
├── price_confidence (text: confirmed|estimated)
├── notes (text)
├── latitude (float)
├── longitude (float)
├── activity_level (text: light|moderate|intense)
├── reason_tags (text[])
├── address (text, nullable)
├── business_hours (text, nullable)
├── closed_days (text, nullable)
├── transit_mode (text, nullable)
├── transit_duration_min (int, nullable)
├── transit_summary (text, nullable)
├── verified (boolean)
├── google_place_id (text, nullable)
└── created_at (timestamptz)
```

### 6.2 보조 테이블

```
public.place_cache
├── id (UUID, PK)
├── destination (text)
├── google_place_id (text)
├── display_name (text)
├── address (text, nullable)
├── latitude (float, nullable)
├── longitude (float, nullable)
├── rating (float, nullable)
├── business_hours (text, nullable)
├── closed_days (text, nullable)
├── category (text)
├── photo_reference (text, nullable)
├── cached_at (timestamptz)
└── UNIQUE(destination, google_place_id), TTL 14일

public.user_place_preferences
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users.id)
├── destination (text)
├── place_name (text)
├── google_place_id (text, nullable)
├── preference (text: exclude|revisit|new|hidden)
└── created_at (timestamptz)

public.api_usage_log
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users.id)
├── endpoint (text)
└── created_at (timestamptz)
```

### 6.3 보안 (RLS)

- 모든 주요 테이블에 Row Level Security 활성화
- `user_id` 기반 접근 제어 (본인 데이터만 CRUD)
- 공유 여행: `share_token`으로 접근 시 읽기 전용 허용
- 역할 자가 승격 방지 트리거 (`prevent_role_self_promotion`)
- `place_cache`: 인증된 사용자 읽기 허용

## 7. API 엔드포인트

### 7.1 인증/프로필

| 메서드 | 경로 | 설명 | Rate Limit |
|--------|------|------|------------|
| GET | `/api/v1/profile` | 프로필 조회 | - |
| PUT | `/api/v1/profile` | 프로필 저장/수정 | - |

### 7.2 여행 관리

| 메서드 | 경로 | 설명 | Rate Limit |
|--------|------|------|------------|
| GET | `/api/v1/trips` | 여행 목록 조회 | - |
| POST | `/api/v1/trips` | 여행 생성 | - |
| GET | `/api/v1/trips/[tripId]` | 여행 상세 조회 | - |
| PATCH | `/api/v1/trips/[tripId]` | 여행 수정 | - |
| DELETE | `/api/v1/trips/[tripId]` | 여행 삭제 | - |
| POST | `/api/v1/trips/[tripId]/share` | 공유 토큰 생성 | - |
| GET | `/api/v1/trips/[tripId]/items` | 일정 항목 조회 | - |
| POST | `/api/v1/trips/[tripId]/items` | 일정 항목 생성/일괄 upsert | - |
| PATCH | `/api/v1/trips/[tripId]/items` | 일정 항목 수정 | - |
| DELETE | `/api/v1/trips/[tripId]/items` | 일정 항목 삭제 | - |

### 7.3 AI 엔드포인트

| 메서드 | 경로 | 설명 | Rate Limit |
|--------|------|------|------------|
| POST | `/api/v1/ai/generate` | AI 일정 생성 | 10/일 |
| GET | `/api/v1/ai/popular-places` | 인기 장소 조회 | 50/일 |
| POST | `/api/v1/ai/feasibility-check` | 실현가능성 검사 | 30/일 |
| POST | `/api/v1/ai/expand` | 장소 세부 확장 | 50/일 |

### 7.4 장소 선호도

| 메서드 | 경로 | 설명 | Rate Limit |
|--------|------|------|------------|
| GET | `/api/v1/place-preferences` | 선호도 조회 (destination별) | - |
| POST | `/api/v1/place-preferences` | 선호도 저장 | - |

### 7.5 관리자

| 메서드 | 경로 | 설명 | 접근 |
|--------|------|------|------|
| GET | `/api/v1/admin/stats` | API 사용 통계 | admin/developer |
| GET | `/api/v1/admin/users` | 사용자 목록 + 역할 | admin/developer |

## 8. 보안

### 8.1 인증/인가

- Supabase Auth (이메일/비밀번호)
- `getAuthUser()`: `supabase.auth.getUser()`로 토큰 검증 (세션 아닌 토큰 기반)
- 미들웨어 보호 경로: `/trips`, `/onboarding`, `/admin`, `/dashboard`, `/mypage`
- Auth Rate Limiting: IP 기반 15분/10회 (메모리, 1000개 초과 시 정리)

### 8.2 AI 프롬프트 인젝션 방어

- 사용자 입력(`specialNote`, `customFoodPreference`, `customInterests`, `hotelArea`, `placeName`)에 제어문자 + triple-quote 구분자 제거
- `sanitize: (s) => s.replace(/[\x00-\x1f"""]/g, '').slice(0, maxLen)`
- triple-quote 감싸기로 프롬프트 구조 분리

### 8.3 입력 검증

- 모든 API 엔드포인트에 Zod 스키마 검증
- 프론트/서버 동일 스키마 공유 (`src/lib/validators/`)
- 문자열 길이 제한: specialNote 500자, hotelArea 100자, customFoodPreference 100자, customInterests 200자

## 9. Rate Limiting

| 엔드포인트 | 일일 제한 | 비고 |
|-----------|----------|------|
| `/api/v1/ai/generate` | 10회 | `AI_DAILY_LIMIT` 환경변수로 조정 가능 |
| `/api/v1/ai/popular-places` | 50회 | |
| `/api/v1/ai/feasibility-check` | 30회 | |
| `/api/v1/ai/expand` | 50회 | |
| `/auth` POST | 10회/15분 | IP 기반, 메모리 |

- admin/developer 역할은 제한 면제
- 추적: `api_usage_log` 테이블 (사용자별, 엔드포인트별)

## 10. 환경변수

| 변수 | 용도 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 엔드포인트 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 (서버 전용) | ✅ |
| `AI_PROVIDER` | AI 프로바이더 선택 (mock/openai/claude) | ✅ |
| `OPENAI_API_KEY` | OpenAI API 키 | AI 사용 시 |
| `OPENAI_BASE_URL` | 게이트웨이 URL (설정 시 게이트웨이 모드) | 선택 |
| `OPENAI_MODEL` | OpenAI 모델 (기본: gpt-5.4-mini) | 선택 |
| `OPENAI_FALLBACK_MODEL` | 폴백 모델 (기본: gpt-5-mini) | 선택 |
| `OPENAI_LIGHT_MODEL` | 경량 모델 (기본: gpt-5.4-nano) | 선택 |
| `ANTHROPIC_API_KEY` | Claude API 키 | claude 사용 시 |
| `ANTHROPIC_BASE_URL` | Claude 게이트웨이 URL | 선택 |
| `ANTHROPIC_MODEL` | Claude 모델 (기본: claude-sonnet-4-6) | 선택 |
| `GOOGLE_PLACES_API_KEY` | Google Places API 키 (서버 전용) | 장소 검증 시 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps 클라이언트 키 | 지도 표시 시 |
| `AI_DAILY_LIMIT` | AI 생성 일일 제한 (기본: 10) | 선택 |

## 11. 수익 모델

| 수익원 | 모델 | 시기 |
|--------|------|------|
| 안심팩 (건별 결제) | 2,900원/건 | Phase 3 |
| 제휴 수수료 | 숙소/항공 예약 연계 수수료 | Phase 3+ |
| 네이티브 광고 | 여행 관련 광고 | Phase 3+ |

> **수익성 경고:** API 비용 모델링 참조 → `docs/prd/api-cost-model.md`

## 12. 법적 준수 사항

상세 내용: `docs/prd/legal-compliance.md`

- [ ] **사업자 등록 유형:** 법률 상담 후 결정
- [ ] **위치기반서비스사업자 신고:** 서비스 개시 후 1개월 이내
- [ ] **개인정보보호법:** 개인정보처리방침, 동의 절차, 보유기간 명시
- [ ] **Google Places API ToS:** place_id + 캐시 정책 준수
- [ ] **표시광고법:** 광고 콘텐츠 명확 구분

## 13. 참고 서비스

| 서비스 | 핵심 기능 | Tripplan 차별점 |
|--------|-----------|----------------|
| 네이버 여행 | 리뷰 기반 장소 추천, 코스 공유 | AI 개인화 일정 생성 (성향 분석) |
| 카카오맵 | 장소 검색, 길찾기, 맛집 큐레이션 | 여행 전체 일정 자동 설계 |
| Wanderlog | 여행 일정 수동 편집, 공유 | AI가 초안 생성 → 사용자가 수정 |
| 트리플 | OTA 연계 패키지 판매 | Anti-OTA: 자유여행 최적화, 개인화 |

> **포지셔닝:** 기존 서비스들이 "장소 추천" 또는 "수동 편집"에 머무는 반면, Tripplan은 "AI가 개인 성향 기반으로 전체 일정을 자동 설계 + Google Places로 실존 장소 검증"하는 것이 핵심 차별점.

## 14. 주요 가정 및 리스크

| 가정/리스크 | 영향도 | 대응 방안 |
|------------|--------|-----------|
| Google Places API 가격 변동 | 높음 | 필드 마스크 + 캐시로 호출 최소화, 대안 API 조사 |
| AI 일정 품질이 기대 이하 | 높음 | Hybrid RAG + 사후 검증 + 프롬프트 튜닝 |
| AI 게이트웨이 크레딧 소진 | 높음 | 3단계 폴백 체인 (claude↔openai→mock) |
| 위치기반서비스사업자 미신고 | 높음 | 런칭 전 신고 준비 완료 |
| 무료 사용자 비용 초과 | 중간 | Rate Limiting (10/일), 역할별 면제 |
| PWA iOS 제한사항 | 중간 | Phase 1~2는 PWA, DAU 1만+ 시 네이티브 전환 검토 |

## 15. DB 마이그레이션 이력 (18개)

| 파일 | 내용 |
|------|------|
| `20260308000001_initial.sql` | 초기 테이블 (user_profiles, trips, trip_items) |
| `20260308000002_auth_trigger.sql` | 회원가입 시 user_profiles 자동 생성 |
| `20260308000003_share_token.sql` | 공유 토큰 + 공개 접근 RLS |
| `20260309000004_api_usage_log.sql` | Rate Limiting용 사용 로그 |
| `20260310000005_add_currency_confidence.sql` | currency, priceConfidence 컬럼 |
| `20260310000006_user_place_preferences.sql` | 장소 선호도 테이블 |
| `20260311000001_profile_personalization.sql` | 프로필 개인화 확장 |
| `20260311000002_lifestyle_columns.sql` | 라이프스타일 4개 컬럼 분리 |
| `20260312000001_security_fixes.sql` | RLS 전면 재정비, 역할 자가승격 방지 |
| `20260318000001_add_reason_tags.sql` | reason_tags 배열 컬럼 |
| `20260318000002_add_transit_business_info.sql` | 이동수단, 영업시간, 정기휴일 |
| `20260319000001_place_cache.sql` | Google Places 캐시 테이블 |
| `20260319000002_add_verified.sql` | verified, google_place_id 컬럼 |
| `20260320000001_user_roles.sql` | 사용자 역할 (user/developer/admin) |
| `20260320000002_custom_preferences.sql` | 커스텀 식성/관심사 컬럼 |
| `20260320000003_place_photo_reference.sql` | place_cache photo_reference 컬럼 |
