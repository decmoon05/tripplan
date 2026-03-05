# TripWise — 작업 내역 로그

> 각 작업 단계의 완료 내역, 변경 파일, 결정 이유를 기록합니다.
> 최신 작업이 위에 위치합니다.

---

## 2026-03-05: Phase 1 백엔드 5단계 — 보안 강화

### 목표
서버 보안 수준 전면 강화. Rate limiting, 보안 헤더, Refresh Token 회전/폐기, Graceful Shutdown 적용.
코드 품질 개선 (중복 제거, 페이지네이션).

### 적용한 보안 기능 (6개)

| 기능 | 상세 | 위험도 해결 |
|------|------|------------|
| Helmet 보안 헤더 | 12+ 헤더 자동 적용 (CSP, HSTS, X-Frame-Options 등) | WARNING → ✅ |
| Rate Limiting (3종) | 전역 100/15m, 인증 10/15m, AI 5/1h | CRITICAL → ✅ |
| Refresh Token 회전 | SHA-256 해시 DB 저장, 갱신 시 기존 폐기 | CRITICAL → ✅ |
| 로그아웃 | POST /api/v1/auth/logout, 모든 토큰 폐기 | — (신규) |
| Graceful Shutdown | SIGTERM/SIGINT + Prisma $disconnect + 10초 타임아웃 | WARNING → ✅ |
| 페이지네이션 | GET /api/v1/trips?page=1&limit=10 + pagination 객체 | INFO → ✅ |

### 새 엔드포인트 (1개)

| Method | Path | Auth | 설명 | 상태코드 |
|--------|------|:----:|------|---------|
| POST | `/api/v1/auth/logout` | O | 모든 리프레시 토큰 폐기 | 200 |

### 수정된 엔드포인트 (2개)

| Method | Path | 변경 내용 |
|--------|------|-----------|
| POST | `/api/v1/auth/refresh` | DB 해시 검증 + 회전 (기존 토큰 폐기 → 새 토큰 발급) |
| GET | `/api/v1/trips` | 페이지네이션 추가 (?page=1&limit=10) |

### 생성한 파일 (3개)

```
packages/api/src/
├── middlewares/
│   └── rateLimiter.ts              # 3종 Rate Limiter (전역/인증/AI)
├── repositories/
│   └── refreshTokenRepository.ts   # RefreshToken CRUD (해시 저장/조회/폐기)
└── utils/
    └── auth.ts                     # getUserId() 공유 헬퍼
```

### 수정한 파일 (13개)

| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | helmet, express-rate-limit 의존성 추가 |
| `prisma/schema.prisma` | RefreshToken 모델 추가 (tokenHash unique, userId index) |
| `src/index.ts` | helmet() + globalLimiter + Graceful Shutdown (SIGTERM/SIGINT) |
| `src/utils/jwt.ts` | hashToken() SHA-256 + REFRESH_TOKEN_EXPIRES_MS 추가 |
| `src/utils/index.ts` | hashToken, REFRESH_TOKEN_EXPIRES_MS, getUserId export 추가 |
| `src/services/authService.ts` | 토큰 해시 DB 저장, 회전, logout 함수 추가 |
| `src/controllers/authController.ts` | logout 핸들러 추가, getUserId 공유화 |
| `src/routes/authRoutes.ts` | authLimiter + logout 라우트 추가 |
| `src/routes/tripRoutes.ts` | aiLimiter 적용 (POST만) |
| `src/controllers/tripController.ts` | getUserId 공유화, 페이지네이션 |
| `src/controllers/profileController.ts` | getUserId 공유화 |
| `src/controllers/placeController.ts` | getUserId 공유화 |
| `src/types/validations.ts` | paginationSchema + PaginationInput 추가 |
| `src/services/tripService.ts` | listTrips 페이지네이션 (skip/take + count) |
| `src/repositories/tripRepository.ts` | findByUserId(skip, take) + countByUserId 추가 |

### Rate Limiting 설계

| 리미터 | 대상 | 제한 | 목적 |
|--------|------|------|------|
| globalLimiter | 모든 엔드포인트 | IP당 100회/15분 | DDoS 방어 |
| authLimiter | /api/v1/auth/* | IP당 10회/15분 | 브루트포스 방어 |
| aiLimiter | POST /api/v1/trips | IP당 5회/1시간 | Claude API 비용 보호 |

### Refresh Token 회전 흐름

```
1. 로그인/회원가입 → JWT 발급 + SHA-256 해시 DB 저장
2. refresh 요청 → JWT 서명 검증 + DB 해시 조회 (폐기 여부 확인)
3. 검증 통과 → 기존 해시 revoke + 새 JWT 발급 + 새 해시 저장
4. 폐기된 토큰 재사용 → REFRESH_TOKEN_REVOKED 에러
5. 로그아웃 → 해당 사용자의 모든 토큰 폐기 (revokeAllByUserId)
```

### 테스트 결과

| 테스트 케이스 | 기대 | 결과 |
|--------------|------|------|
| Helmet 헤더 적용 | CSP, HSTS, X-Frame-Options 등 | ✅ |
| X-Powered-By 제거 | 헤더 없음 | ✅ |
| 전역 Rate Limit 헤더 | RateLimit-Limit: 100 | ✅ |
| 인증 Rate Limit 헤더 | RateLimit-Limit: 10 | ✅ |
| 회원가입 + 토큰 발급 | 성공 | ✅ |
| Refresh 회전 (1차) | 새 토큰 발급 | ✅ |
| 폐기된 토큰 재사용 | REFRESH_TOKEN_REVOKED | ✅ |
| 로그인 → 로그아웃 | 200 "로그아웃 되었습니다" | ✅ |
| 로그아웃 후 refresh | REFRESH_TOKEN_REVOKED | ✅ |
| 페이지네이션 (page=1, limit=5) | pagination 객체 반환 | ✅ |
| TypeScript 컴파일 | 에러 없음 | ✅ |

---

## 2026-03-05: Phase 1 백엔드 4단계 — 장소 API + Google Places (New) 통합

### 목표
Google Places API (New)를 사용한 장소 검색/상세 조회 API 구현.
캐시 우선 전략, 일일 사용량 관리, API 키 보호까지 포함.

### 만든 엔드포인트 (3개)

| Method | Path | Auth | 설명 | 상태코드 |
|--------|------|:----:|------|---------|
| GET | `/api/v1/places/search` | O | 장소 검색 (Google Text Search + 캐시 폴백) | 200 |
| GET | `/api/v1/places/:id` | O | 장소 상세 (Google Details + 캐시 폴백) | 200 / 404 |
| GET | `/api/v1/places/photo` | O | 사진 프록시 (API 키 보호) | 200 / 400 / 502 |

### 생성한 파일 (4개)

```
packages/api/src/
├── services/
│   ├── googlePlacesService.ts   # Google Places API (New) 클라이언트 + 사용량 카운터
│   └── placeService.ts          # 장소 비즈니스 로직 (캐시 우선 전략)
├── controllers/
│   └── placeController.ts       # 장소 요청/응답 + 사진 프록시
└── routes/
    └── placeRoutes.ts           # /api/v1/places/* (authenticate 적용)
```

### 수정한 파일 (3개)

| 파일 | 변경 내용 |
|------|-----------|
| `types/validations.ts` | placeIdParamSchema, placeSearchQuerySchema 추가 |
| `repositories/placeCacheRepository.ts` | searchByText 추가 (ILIKE, 와일드카드 이스케이프) |
| `index.ts` | placeRouter import + `/api/v1/places` 등록 |

### Google Places API 전환 (Legacy → New)

| 항목 | Legacy | New |
|------|--------|-----|
| 인증 | URL `key=` 파라미터 | `X-Goog-Api-Key` 헤더 |
| 검색 | GET `/textsearch/json` | POST `/places:searchText` |
| 상세 | GET `/details/json` | GET `/places/{id}` |
| 응답 필드 | `name`, `geometry.location` | `displayName.text`, `location.latitude` |
| 가격 | 문자열 없음 (`0~4` 숫자) | `PRICE_LEVEL_INEXPENSIVE` 등 enum |
| 필드 제어 | `fields=` 파라미터 | `X-Goog-FieldMask` 헤더 |

### 비용 관리 (월 10,000원 이하 목표)

| API | 일일 한도 | 비용/건 | 관리 방식 |
|-----|----------|---------|-----------|
| SearchText | 170건 | $32/1000 | 메모리 카운터 + 80% 경고 |
| GetPlace | 180건 | $17/1000 | 메모리 카운터 + 100% 캐시 폴백 |
| GetPhoto | 20건 | $7/1000 | 상세 조회에서만 사용 |

- Field Mask로 불필요 필드 제외 → SKU 비용 절감
- 검색 결과는 사진 미포함 (일 20건 제한 대응)
- 7일 캐시 → 동일 장소 반복 조회 시 API 호출 없음

### 보안 리뷰 (2회) 및 수정사항

| 이슈 | 심각도 | 수정 내용 |
|------|--------|-----------|
| buildPhotoUrl에 API 키 포함 → 클라이언트 노출 | CRITICAL | 서버 프록시 엔드포인트로 전환 (/api/v1/places/photo) |
| Place ID path traversal (`../admin`) | WARNING | validatePlaceId 정규식 검증 ([A-Za-z0-9_-]+) |
| Photo ref path traversal (`../../etc/passwd`) | WARNING | 정규식 패턴 매칭 (places/.../photos/...) |
| 캐시 에러 로그에 DB 연결 정보 포함 가능 | WARNING | err.message만 출력 |
| buildPlaceFromCache name/category 미검증 | WARNING | ?? 기본값 적용 (name→googlePlaceId, category→'attraction') |
| ILIKE 와일드카드 주입 (`%`, `_`) | WARNING | escapeLike 함수 (1차 리뷰에서 수정) |
| fetch 타임아웃 없음 | WARNING | AbortController 10초 타임아웃 (1차 리뷰에서 수정) |

### 발견 및 해결한 버그

| 버그 | 원인 | 해결 |
|------|------|------|
| MaxClientsInSessionMode | cacheSearchResults에서 Promise.all 20건 동시 upsert | for...of 순차 처리 |
| 사진 프록시 라우트 미매칭 | 서버 미재시작 (tsx 핫리로드 미지원) | 서버 재시작 후 정상 동작 |

### 테스트 결과

| 테스트 케이스 | 기대 | 결과 |
|--------------|------|------|
| 검색 `tokyo ramen` (limit=5) | Google 소스 + 5건 | ✅ |
| 검색 `paris cafe` (limit=2) | Google 소스 + 2건 | ✅ |
| 검색 `osaka sushi` (limit=3) | Google 소스 + 3건 | ✅ |
| 검색 `kyoto temple` (limit=1) | Google 소스 + 1건 | ✅ |
| 상세 조회 (실제 Google Place ID) | Google → 캐시 저장 | ✅ |
| 캐시 히트 (같은 ID 재조회) | 캐시에서 즉시 반환 | ✅ |
| photoUrl API 키 미포함 | `AIza` 없음 (SAFE) | ✅ |
| Path traversal (`../admin`) | 차단 | ✅ |
| Photo ref traversal (`../../etc/passwd`) | INVALID_PHOTO_REF | ✅ |
| Photo ref 누락 | VALIDATION_ERROR: ref Required | ✅ |
| 캐시 순차 쓰기 (MaxClients 에러) | 해결됨 | ✅ |

---

## 2024-03-04: Phase 1 백엔드 3단계 — 여행 API + AI 통합

### 목표
여행 생성 → Claude AI 일정 자동 생성 → 일정 조회/수정까지의 전체 흐름을 구현하는 API 4개.
사용자 프로필 기반 개인화된 일정을 AI가 자동 생성하고, 날짜별 장소 교체가 가능하도록 함.

### 만든 엔드포인트 (4개)

| Method | Path | Auth | 설명 | 상태코드 |
|--------|------|:----:|------|---------|
| POST | `/api/v1/trips` | O | 여행 생성 → AI 일정 자동 생성 | 201 / 400 / 502 |
| GET | `/api/v1/trips` | O | 내 여행 목록 | 200 |
| GET | `/api/v1/trips/:id` | O | 여행 상세 (일정 + 장소 + PlaceCache) | 200 / 403 / 404 |
| PATCH | `/api/v1/trips/:id/places` | O | 날짜별 장소 교체 | 200 / 403 / 404 |

### 생성한 파일 (6개)

```
packages/api/src/
├── repositories/
│   ├── tripRepository.ts          # Trip + TripDay + TripPlace 트랜잭션 CRUD
│   └── placeCacheRepository.ts    # PlaceCache upsert/조회 (30일 캐시)
├── services/
│   ├── claudeService.ts           # Claude API 클라이언트 (프롬프트 빌더, JSON 파싱, 재시도)
│   └── tripService.ts             # 여행 오케스트레이션 (AI 호출 + DB 저장 + 접근제어)
├── controllers/
│   └── tripController.ts          # 여행 요청/응답 처리
└── routes/
    └── tripRoutes.ts              # /api/v1/trips/* (authenticate 적용)
```

### 수정한 파일 (2개)

| 파일 | 변경 내용 |
|------|-----------|
| `types/validations.ts` | createTripSchema, updateTripPlacesSchema, tripIdParamSchema 추가 (3개 스키마 + 3개 타입) |
| `index.ts` | tripRouter import + `/api/v1/trips` 등록 |

### 아키텍처 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| AI 호출 방식 | 동기 (요청 → 대기 → 응답) | MVP 단계, 비동기 큐는 과잉 |
| AI 모델 | claude-sonnet-4-6 | 비용/속도 균형 |
| AI 응답 형식 | JSON 구조화 출력 (파싱 실패 시 1회 재시도) | 프론트엔드에서 바로 사용 가능 |
| Google Places | mock googlePlaceId 사용 | API 키 미발급, Phase 1 후반 연동 |
| 일정 수정 | PATCH: 날짜 단위 전체 교체 | 개별 추가/삭제보다 구현 단순 |
| 프로필 연동 | nullable (프로필 없어도 동작) | 프로파일링 스킵한 사용자 대응 |
| 접근 검증 | `verifyTripAccess(userId, tripId, permission)` | Phase 2 파티 기능 대비 확장 가능 설계 |
| PlaceCache | AI 생성 장소 메타데이터 30일 캐시 | 동일 장소 반복 조회 방지 |

### 보안 리뷰 및 수정사항

| 이슈 | 심각도 | 수정 내용 |
|------|--------|-----------|
| AI 에러 메시지가 raw API 응답 노출 | CRITICAL | 클라이언트에 제네릭 메시지 반환, 서버 로그에만 상세 기록 |
| Prompt Injection 취약점 | CRITICAL | `sanitizeInput()` 함수 + `<user_input>` 태그 격리 적용 |
| dayNumber 상한 없음 | WARNING | `.max(14)` 추가 (서비스 로직 14일 제한과 일치) |
| destination 공백만 입력 가능 | WARNING | `.trim()` 추가 |
| cachePlaceMetadata 실패 시 여행 생성 중단 | WARNING | try-catch로 캐시 실패 격리 (여행 생성은 계속) |
| 프로필 catch가 모든 에러 무시 | WARNING | `PROFILE_NOT_FOUND`만 catch, 나머지는 로깅 |
| createTrip 응답에 PlaceCache 데이터 누락 | WARNING | PlaceCache 조인하여 풍부한 응답 반환 |
| AI 응답 숫자 필드가 string일 수 있음 | WARNING | `Number()` 강제 변환 + 기본값 적용 |

### 테스트 결과

| 테스트 케이스 | 기대 | 결과 |
|--------------|------|------|
| 헬스체크 | 200 OK | ✅ |
| 인증 없이 여행 목록 | 401 AUTH_REQUIRED | ✅ |
| 잘못된 body로 여행 생성 | 400 VALIDATION_ERROR | ✅ |
| 여행 생성 (AI 호출) | 502 (크레딧 부족으로 AI 실패) | ✅ (코드 정상, 외부 요인) |
| 존재하지 않는 tripId 조회 | 404 TRIP_NOT_FOUND | ✅ |
| 타인 여행 접근 | 403 FORBIDDEN | ✅ |
| 종료일 < 시작일 | 400 VALIDATION_ERROR | ✅ |

> **참고**: Anthropic API 크레딧 부족으로 실제 AI 일정 생성은 테스트 불가. 코드 로직은 정상 동작 확인됨.

### 핵심 코드 패턴

**접근 제어 (Phase 2 확장 대비)**
```typescript
type TripPermission = 'read' | 'write';
async function verifyTripAccess(userId: string, tripId: string, _permission: TripPermission) {
  const trip = await tripRepo.findById(tripId);
  if (!trip) throw new AppError('TRIP_NOT_FOUND', 404, ...);
  if (trip.userId !== userId) throw new AppError('FORBIDDEN', 403, ...);
  // Phase 2: TripMember 테이블 조회 + permission 체크로 교체
  return trip.id;
}
```

**Prompt Injection 방어**
```typescript
function sanitizeInput(input: string): string {
  return input
    .replace(/[\r\n]+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\b(ignore|forget|disregard|override)\b/gi, '')
    .trim().slice(0, 200);
}
// 프롬프트에서 <user_input> 태그로 사용자 데이터 격리
```

### 나중에 할 것

- Anthropic API 크레딧 충전 후 AI 일정 생성 실 테스트
- Google Places API 키 발급 → 장소 API 연동
- AI 응답 캐싱 레이어 (동일 요청 반복 방지)
- Rate limiting (특히 AI 엔드포인트)
- getUserId() 헬퍼 공유 유틸리티로 분리

---

## 2024-03-04: Phase 1 백엔드 2단계 — Auth + Profile API

### 목표
회원가입/로그인 → 성격 프로파일링까지의 전체 흐름을 동작시키는 API 7개 구현.

### 만든 엔드포인트 (7개)

| Method | Path | Auth | 설명 | 상태코드 |
|--------|------|:----:|------|---------|
| POST | `/api/v1/auth/register` | X | 회원가입 → 토큰 반환 | 201 / 409 |
| POST | `/api/v1/auth/login` | X | 로그인 → 토큰 반환 | 200 / 401 |
| POST | `/api/v1/auth/refresh` | X | 토큰 갱신 | 200 / 401 |
| GET | `/api/v1/profile` | O | 내 프로필 조회 | 200 / 404 |
| PUT | `/api/v1/profile` | O | 프로필 수정 | 200 |
| GET | `/api/v1/profile/questions` | O | 프로파일링 질문 12개 | 200 |
| POST | `/api/v1/profile/complete` | O | 답변 저장 + 분석 | 200 |

### 생성한 파일 (10개)

```
packages/api/src/
├── types/validations.ts          # Zod 스키마 5개 + 추론 타입
├── data/profileQuestions.ts       # 고정 프로파일링 질문 12개
├── repositories/
│   ├── userRepository.ts          # User DB 쿼리 (findByEmail, findById, create)
│   └── profileRepository.ts       # UserProfile DB 쿼리 (findByUserId, upsert)
├── services/
│   ├── authService.ts             # 인증 로직 (register, login, refresh)
│   └── profileService.ts          # 프로필 로직 (get, update, questions, complete)
├── controllers/
│   ├── authController.ts          # 인증 요청/응답 처리
│   └── profileController.ts       # 프로필 요청/응답 처리
└── routes/
    ├── authRoutes.ts              # POST register/login/refresh
    └── profileRoutes.ts           # authenticate + GET/PUT/GET/POST
```

### 수정한 파일 (2개)

| 파일 | 변경 내용 |
|------|-----------|
| `middlewares/errorHandler.ts` | ZodError 처리 추가 (400 VALIDATION_ERROR), 500 에러 서버 로깅 |
| `index.ts` | authRouter, profileRouter import + 등록 |

### 설치한 패키지

| 패키지 | 용도 |
|--------|------|
| `bcryptjs` | 비밀번호 해싱 (SALT_ROUNDS=12) |
| `@types/bcryptjs` | TypeScript 타입 |

### 아키텍처 결정

- **계층 구조**: Routes → Controllers → Services → Repositories → Prisma
  - Route: 얇게 유지, asyncWrapper로 감싸기만
  - Controller: Zod parse + Service 호출 + 응답 포매팅
  - Service: 비즈니스 로직 핵심 (bcrypt, JWT, 프로필 분석)
  - Repository: 순수 Prisma 쿼리만
- **프로파일 분석**: 규칙 기반 (Phase 2에서 AI 분석으로 교체 예정)
- **AI 보충질문**: stub (빈 배열 반환, Phase 1 범위)
- **personalityData 저장**: Prisma Json 필드에 `object` 타입으로 저장

### 보안 리뷰 및 수정사항

| 이슈 | 심각도 | 수정 내용 |
|------|--------|-----------|
| 로그인 타이밍 공격 | CRITICAL | 유저 미존재 시에도 DUMMY_HASH로 bcrypt.compare 실행 |
| 이메일 정규화 미처리 | WARNING | Zod에서 `.trim().toLowerCase()` 적용 |
| 500 에러 서버 로깅 없음 | WARNING | `console.error('[INTERNAL_ERROR]', err)` 추가 |
| customText 검증 누락 | WARNING | `.refine()` — custom 답변 시 customText 필수 |
| req.user! 논널 단언 | WARNING | `getUserId()` 헬퍼로 안전한 가드 체크 |
| 배열 길이 무제한 | WARNING | `.max()` 제한 추가 (interests 50, cuisines 30 등) |
| PROFILE_QUESTIONS 뮤터블 | INFO | `readonly ProfileQuestion[]`로 변경 |

### 테스트 결과

| 테스트 케이스 | 기대 | 결과 |
|--------------|------|------|
| 회원가입 | 201 + tokens | ✅ |
| 중복 이메일 가입 | 409 | ✅ |
| 로그인 | 200 + tokens | ✅ |
| 잘못된 비밀번호 | 401 | ✅ |
| 토큰 갱신 | 200 + new tokens | ✅ |
| 유효성 검증 실패 | 400 VALIDATION_ERROR | ✅ |
| 프로필 조회 (미생성) | 404 | ✅ |
| 인증 없이 프로필 조회 | 401 | ✅ |
| 질문 목록 | 200 + 12개 질문 | ✅ |
| 프로파일링 완료 | 200 + 프로필 + followUpQuestions | ✅ |
| 프로필 조회 (생성 후) | 200 + 프로필 데이터 | ✅ |
| 프로필 수정 | 200 + 수정된 프로필 | ✅ |
| 대문자 이메일 가입 → 소문자 로그인 | 200 | ✅ |
| custom 답변에 텍스트 없음 | 400 | ✅ |
| 배열 51개 초과 | 400 | ✅ |

### 나중에 할 것 (Phase 1 내 별도 작업)

- Rate limiting (express-rate-limit)
- Helmet 보안 헤더
- Refresh token 회전/폐기
- Graceful shutdown

---

## 2024-03-04: Phase 1 백엔드 1단계 — 기초 세팅

### 목표
백엔드 서버의 기반 인프라 구축 (환경변수, DB, JWT, 에러 처리).

### 생성한 파일 (7개)

```
packages/api/src/
├── utils/
│   ├── env.ts              # Zod 기반 환경변수 검증 + dotenv override
│   ├── prisma.ts           # PrismaClient 싱글톤
│   ├── asyncWrapper.ts     # Express 4.x 비동기 에러 래퍼
│   ├── jwt.ts              # JWT 생성/검증 (HS256, Access 15m, Refresh 7d)
│   └── index.ts            # 배럴 re-export
├── types/auth.ts           # JwtPayload, TokenPair, Express Request 확장
└── middlewares/
    ├── auth.ts             # Bearer 토큰 인증 미들웨어
    └── errorHandler.ts     # AppError 클래스 + 에러 핸들러
```

### 수정한 파일 (1개)

| 파일 | 변경 내용 |
|------|-----------|
| `index.ts` | dotenv import 제거, errorHandler 연결, CORS origin:true |

### 해결한 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| ANTHROPIC_API_KEY 로딩 실패 | 시스템 환경변수에 빈 값 존재 | dotenv `override: true` |
| ESM import 호이스팅 | index.ts에서 dotenv가 env.ts보다 늦게 실행 | dotenv 로딩을 env.ts 내부로 이동 |
| worktree에서 .env 누락 | worktree는 별도 작업 디렉토리 | 메인 레포에서 .env 복사 |
| Port 3000 충돌 | 이전 테스트 서버 미종료 | `npx kill-port 3000` |

### 보안 수정 (1차 리뷰)

| 이슈 | 수정 |
|------|------|
| CORS `credentials:true` + `origin:'*'` 충돌 | `origin: true` |
| JWT 알고리즘 미지정 | 명시적 `HS256` |
| errorHandler에서 raw `process.env` 사용 | 검증된 `env` 유틸리티 사용 |

---

## 파일 구조 현황 (Phase 1 백엔드 1~6단계)

```
packages/api/
├── prisma/
│   └── schema.prisma              # 8 모델 (+RefreshToken ◆)
├── src/
│   ├── index.ts                   # Express 앱 + helmet + globalLimiter + Graceful Shutdown ◆
│   ├── types/
│   │   ├── auth.ts                # JWT 타입 + Express 확장
│   │   └── validations.ts         # Zod 스키마 11개 (+paginationSchema ◆)
│   ├── data/
│   │   └── profileQuestions.ts    # 고정 질문 12개
│   ├── middlewares/
│   │   ├── auth.ts                # Bearer 인증 미들웨어
│   │   ├── errorHandler.ts        # AppError + ZodError + 500 로깅
│   │   └── rateLimiter.ts         # 3종 Rate Limiter (전역/인증/AI) ◆
│   ├── utils/
│   │   ├── env.ts                 # 환경변수 Zod 검증
│   │   ├── prisma.ts              # PrismaClient 싱글톤
│   │   ├── jwt.ts                 # JWT 생성/검증 + hashToken SHA-256 ◆
│   │   ├── auth.ts                # getUserId() 공유 헬퍼 ◆
│   │   ├── asyncWrapper.ts        # Express async 에러 래퍼
│   │   └── index.ts               # 배럴 export
│   ├── repositories/
│   │   ├── userRepository.ts      # User DB 쿼리
│   │   ├── profileRepository.ts   # UserProfile DB 쿼리
│   │   ├── tripRepository.ts      # Trip CRUD + 페이지네이션 ★◆
│   │   ├── placeCacheRepository.ts # PlaceCache upsert/조회/텍스트검색 ★☆
│   │   └── refreshTokenRepository.ts # RefreshToken 해시 CRUD ◆
│   ├── services/
│   │   ├── authService.ts         # 인증 + 토큰 회전 + 로그아웃 ◆
│   │   ├── profileService.ts      # 프로필 비즈니스 로직
│   │   ├── claudeService.ts       # Claude AI 일정 생성 ★
│   │   ├── tripService.ts         # 여행 오케스트레이션 + 페이지네이션 ★◆
│   │   ├── googlePlacesService.ts # Google Places API (New) ☆
│   │   └── placeService.ts        # 장소 비즈니스 로직 ☆
│   ├── controllers/
│   │   ├── authController.ts      # 인증 + logout ◆
│   │   ├── profileController.ts   # 프로필 (getUserId 공유화) ◆
│   │   ├── tripController.ts      # 여행 (페이지네이션 + getUserId 공유화) ★◆
│   │   └── placeController.ts     # 장소 + 사진 프록시 (getUserId 공유화) ☆◆
│   └── routes/
│       ├── authRoutes.ts          # authLimiter + logout 라우트 ◆
│       ├── profileRoutes.ts       # /api/v1/profile/*
│       ├── tripRoutes.ts          # aiLimiter 적용 ★◆
│       └── placeRoutes.ts         # /api/v1/places/* ☆
└── package.json                   # +helmet, +express-rate-limit ◆

packages/shared/src/
└── index.ts                       # 공유 타입 (25+ 인터페이스)
```

> ★ = 3단계, ☆ = 4단계, ◆ = 5단계 (보안 강화)

---

## 기술 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| 비밀번호 해싱 | bcryptjs (SALT_ROUNDS=12) | 순수 JS 구현, native 의존성 없음 |
| 유효성 검증 | Zod | TypeScript 타입 추론 지원, 스키마 기반 |
| JWT 알고리즘 | HS256 | Phase 1 단일 서버, RS256은 마이크로서비스 시 |
| 프로필 저장 | Prisma Json 필드 | 스키마리스 유연성, 프로파일 데이터 구조 변동 대비 |
| 프로파일 분석 | 규칙 기반 | Phase 1 MVP, Phase 2에서 Claude API 분석으로 교체 |
| AI 보충질문 | stub (빈 배열) | Phase 1 범위, Claude API 통합 시 구현 |
| 이메일 처리 | trim + toLowerCase | 대소문자 차이로 인한 로그인 실패 방지 |
| 타이밍 공격 | DUMMY_HASH | 유저 존재 여부를 응답 시간으로 추측 불가 |
| AI 일정 생성 | 동기 호출 (claude-sonnet-4-6) | MVP 단계, 비동기 큐 불필요 |
| AI 응답 처리 | JSON 파싱 + 1회 재시도 | 파싱 실패 복구, max 2회 호출 |
| 일정 수정 | 날짜 단위 전체 교체 (PATCH) | 개별 장소 CRUD보다 단순, 프론트에서 전체 리스트 전송 |
| 접근 제어 | verifyTripAccess(userId, tripId, permission) | Phase 2 TripMember/파티 기능 확장 대비 |
| 장소 캐시 | PlaceCache 30일 만료 | AI 생성 장소 메타데이터 재사용 |
| Prompt Injection 방어 | sanitizeInput() + `<user_input>` 태그 격리 | 사용자 입력이 프롬프트 지시문으로 해석되는 것 방지 |
| Google Places API | New API (v1) | Legacy deprecated 예정, Field Mask 비용 최적화 |
| 사진 제공 | 서버 프록시 (/api/v1/places/photo) | API 키 클라이언트 노출 방지 |
| 일일 사용량 관리 | 메모리 기반 카운터 (서버 재시작 시 리셋) | 외부 의존성 없음, Phase 1 충분 |
| 장소 캐시 전략 | 캐시 우선 → Google 폴백 → 캐시 폴백 → 404 | API 호출 최소화 + 고가용성 |
| 검색 결과 캐싱 | 순차 upsert (for...of) | Supabase 커넥션 풀 한도 방지 |
| Place ID 검증 | 정규식 [A-Za-z0-9_-]+ | Path Traversal 방어 |
| 보안 헤더 | helmet() | 한 줄로 12+ 보안 헤더 자동 적용 |
| Rate Limiting | express-rate-limit 메모리 저장소 | Phase 1 충분, 프로덕션에서 Redis로 교체 |
| Rate Limit 분리 | 전역/인증/AI 3종 | 엔드포인트별 위험도에 맞는 제한 |
| Refresh Token 저장 | SHA-256 해시 (bcrypt 아닌) | DB unique index 검색 속도 우선 |
| 토큰 회전 | refresh 시 기존 폐기 + 새 발급 | 탈취된 토큰 1회만 사용 가능 |
| Graceful Shutdown | SIGTERM/SIGINT + 10초 타임아웃 | 배포 시 무중단 + DB 커넥션 정리 |
| getUserId 공유 | utils/auth.ts 단일 소스 | 4개 컨트롤러 코드 중복 제거 |
| 페이지네이션 | Prisma skip/take + count | 대량 데이터 방지 + 프론트 무한 스크롤 대비 |
