# TripWise — 할 일 체크리스트 (공정표)

> 이 파일은 항상 최신 상태로 유지할 것.
> 작업 완료 시 [x] 표시. 새 작업 발견 시 바로 추가.

---

## 현재 상태: ✅ Phase 1 백엔드 1~6단계 완료 (기초 + Auth/Profile + 여행/AI + 장소 + 보안 강화) → 다음: 프론트엔드

---

## Phase 0 — 개발 환경 세팅

- [x] Node.js 설치 확인 (v22.18.0)
- [x] Expo CLI 설치 (v55.0.14)
- [x] Supabase 프로젝트 생성 → Session Pooler URL 연결 완료 (aws-1-ap-northeast-2, 서울)
- [ ] Upstash Redis 생성 → REDIS 키 발급 (Phase 1 이후에 해도 됨)
- [x] Anthropic API 키 → .env 설정 완료
- [x] Google Places API 키 발급 → .env 설정 완료 (New API, 일일 사용량 카운터 적용)
- [ ] Anthropic API 크레딧 충전 (현재 잔액 부족으로 AI 일정 생성 불가)
- [x] 모노레포 초기 구조 생성 (package.json, apps/mobile, packages/api, packages/shared)
- [x] .env.example 파일 생성
- [x] .gitignore 설정
- [x] git 초기화 + 첫 커밋

---

## Phase 1 — MVP

### 백엔드

#### 1. 기초 세팅 ✅ (완료)
- [x] Express + TypeScript 프로젝트 초기화
- [x] Prisma 설정 + 초기 스키마 작성 (8 모델: User, UserProfile, Trip, TripDay, TripPlace, PlaceCache, TravelIssue, RefreshToken)
- [x] JWT 인증 미들웨어 (Access 15m + Refresh 7d, HS256)
- [x] 에러 핸들러 미들웨어 (AppError + ZodError + 서버 로깅)
- [x] 환경변수 로더 설정 (Zod 검증, dotenv override)
- [x] asyncWrapper (Express 4.x 비동기 에러 처리)
- [x] Prisma Client 싱글톤

#### 2. 사용자/프로파일 API ✅ (완료)
- [x] POST /api/v1/auth/register (bcrypt 해싱, 이메일 정규화)
- [x] POST /api/v1/auth/login (타이밍 공격 방지, 이메일 열거 방지)
- [x] POST /api/v1/auth/refresh (리프레시 토큰 검증 + DB 해시 검증 + 회전)
- [x] POST /api/v1/auth/logout (인증 필수, 모든 리프레시 토큰 폐기)
- [x] GET /api/v1/profile (Prisma JSON → 공유 타입 변환)
- [x] PUT /api/v1/profile (기존 데이터 merge + upsert)
- [x] GET /api/v1/profile/questions (고정 12개 질문 반환)
- [x] POST /api/v1/profile/complete (답변 저장 + 규칙 기반 분석, AI 보충질문 stub)
- [x] Zod 유효성 검증 (이메일 정규화, 배열 길이 제한, customText 조건부 검증)
- [x] 보안 리뷰 통과 (타이밍 공격, 에러 로깅, req.user 가드)

#### 3. 여행 API + AI 통합 ✅ (완료)
- [x] POST /api/v1/trips (목적지+날짜+동행 입력, Claude AI 일정 자동 생성)
- [x] GET /api/v1/trips (내 여행 목록)
- [x] GET /api/v1/trips/:id (일정 상세 + PlaceCache 조인)
- [x] PATCH /api/v1/trips/:id/places (날짜별 장소 교체)
- [x] Claude API 클라이언트 (claudeService.ts — 프롬프트 빌더, JSON 파싱, 재시도)
- [x] 프로파일 기반 일정 생성 (프로필 nullable, 없으면 기본 일정)
- [x] PlaceCache 메타데이터 저장 (AI 생성 장소 30일 캐시)
- [x] verifyTripAccess 확장 가능 접근 검증 (Phase 2 파티 기능 대비)
- [x] 보안 리뷰 통과 (Prompt Injection 방어, 에러 메시지 노출 차단, 입력 검증 강화)

#### 4. 장소 API ✅ (완료)
- [x] GET /api/v1/places/:id (Google Places New API + 캐시 레이어)
- [x] GET /api/v1/places/search (Text Search + 캐시 폴백)
- [x] GET /api/v1/places/photo (사진 프록시 — API 키 보호)
- [x] Google Places API (New) 전환 (Legacy → New API 엔드포인트/헤더/응답)
- [x] 일일 사용량 카운터 (SearchText 170, GetPlace 180, GetPhoto 20)
- [x] 보안 리뷰 2회 통과 (API 키 노출 차단, Path Traversal 방어, 에러 로그 보호)

#### 5. AI 추가 기능
- [ ] 실시간 이슈 체크 서비스 (공사, 휴무, 이벤트, 안전)
- [ ] AI 응답 캐싱 레이어 (동일 요청 반복 방지)

#### 6. 보안 강화 ✅ (완료)
- [x] Helmet 보안 헤더 (12+ 보안 헤더 자동 적용, X-Powered-By 제거)
- [x] Rate limiting 미들웨어 (전역 100/15m, 인증 10/15m, AI 5/1h)
- [x] Refresh token 회전/폐기 (SHA-256 해시 DB 저장, 로그아웃 시 전체 폐기)
- [x] 로그아웃 엔드포인트 (POST /api/v1/auth/logout)
- [x] Graceful shutdown 처리 (SIGTERM/SIGINT + Prisma $disconnect + 10초 타임아웃)
- [x] getUserId() 헬퍼 공유 유틸리티 분리 (utils/auth.ts → 4개 컨트롤러에서 사용)
- [x] listTrips 페이지네이션 추가 (?page=1&limit=10, pagination 객체 반환)

### 프론트엔드 (React Native) ← **다음 작업**

#### 1. 기초 세팅
- [ ] Expo 프로젝트 초기화
- [ ] Expo Router 설정
- [ ] NativeWind 또는 스타일 시스템 설정
- [ ] React Query + Zustand 설치
- [ ] API 서비스 레이어 (axios + 인터셉터)

#### 2. 인증 화면
- [ ] 회원가입 화면
- [ ] 로그인 화면
- [ ] 토큰 자동 갱신

#### 3. 온보딩/프로파일링
- [ ] 질문 카드 컴포넌트
- [ ] 5가지 답변 옵션 UI (예/아니오/상관없음/때에따라/직접입력)
- [ ] AI 보충 질문 처리
- [ ] 프로파일 완성 화면

#### 4. 홈 화면
- [ ] 프로파일 요약 카드
- [ ] 새 여행 시작 버튼
- [ ] 이전 여행 목록

#### 5. 목적지 선택
- [ ] 검색바 + 자동완성
- [ ] 인기 목적지 그리드
- [ ] 날짜 선택 (DatePicker)
- [ ] 동행 유형 선택

#### 6. 일정 화면 (핵심)
- [ ] 날짜별 탭
- [ ] 여행지 카드 컴포넌트 (간결 기본 + 상세 펼치기)
- [ ] 카드 드래그 순서 변경
- [ ] 지도 뷰 토글 (Google Maps)
- [ ] 이슈 경고 배너

---

## Phase 2 — (나중에)

- [ ] 재정 바구니
- [ ] 즉흥 변경 모드
- [ ] 취미 매칭 확장
- [ ] 나이대별 소셜 추천
- [ ] 여행 파티/공동 편집 (TripMember 테이블 + verifyTripAccess 확장)

---

## 발견된 이슈 / 메모

- dotenv override 필요: 시스템 환경변수에 빈 ANTHROPIC_API_KEY가 있으면 .env를 무시함 → `override: true`로 해결
- ESM import 호이스팅: dotenv 로딩을 env.ts 내부로 이동해야 함 (index.ts에서 import 순서 보장 불가)
- Prisma v6에서 `InputJsonValue` 타입 제거됨 → `object` 타입으로 대체
- CORS `credentials: true` + `origin: '*'`는 브라우저가 거부 → `origin: true`로 변경
- worktree 환경에서 .env 파일이 별도로 필요 (메인 레포에서 복사)
- Anthropic API 크레딧 부족 시 502 AI_GENERATION_FAILED 반환 (코드 정상, 외부 요인)
- AI 응답의 숫자 필드가 string으로 올 수 있음 → `Number()` 강제 변환으로 해결
- Prompt Injection 방어: `<user_input>` 태그 격리 + sanitizeInput() 적용
- Google Places API (New): Legacy API deprecated → New API로 전환 (X-Goog-Api-Key 헤더, X-Goog-FieldMask 비용 최적화)
- Supabase Session Pooler 커넥션 풀 한도: 동시 upsert 20건 → 순차 처리로 해결
- Photo URL에 API 키 포함 금지 → 서버 프록시 엔드포인트로 대체
- Place ID에 경로 조작 문자(../) 가능 → validatePlaceId 정규식 검증 추가
- Refresh Token 순수 JWT(stateless) → 탈취 시 7일간 무제한 사용 → SHA-256 해시 DB 저장 + 회전으로 해결
- express-rate-limit 메모리 저장소 → 서버 재시작 시 카운터 리셋 (Phase 1 충분, 프로덕션에서 Redis 저장소 교체)
- Prisma query engine DLL 잠김 (EPERM) → 서버 프로세스 종료 후 prisma generate 실행
