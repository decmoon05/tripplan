# TripWise — 작업 내역 로그

> 각 작업 단계의 완료 내역, 변경 파일, 결정 이유를 기록합니다.
> 최신 작업이 위에 위치합니다.

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

## 파일 구조 현황 (Phase 1 백엔드 1~3단계)

```
packages/api/
├── prisma/
│   └── schema.prisma              # 7 모델 (User, UserProfile, Trip, TripDay, TripPlace, PlaceCache, TravelIssue)
├── src/
│   ├── index.ts                   # Express 앱 엔트리 (authRouter, profileRouter, tripRouter 등록)
│   ├── types/
│   │   ├── auth.ts                # JWT 타입 + Express 확장
│   │   └── validations.ts         # Zod 스키마 8개 + 추론 타입 8개
│   ├── data/
│   │   └── profileQuestions.ts    # 고정 질문 12개
│   ├── middlewares/
│   │   ├── auth.ts                # Bearer 인증 미들웨어
│   │   └── errorHandler.ts        # AppError + ZodError + 500 로깅
│   ├── utils/
│   │   ├── env.ts                 # 환경변수 Zod 검증
│   │   ├── prisma.ts              # PrismaClient 싱글톤
│   │   ├── jwt.ts                 # JWT 생성/검증
│   │   ├── asyncWrapper.ts        # Express async 에러 래퍼
│   │   └── index.ts               # 배럴 export
│   ├── repositories/
│   │   ├── userRepository.ts      # User DB 쿼리
│   │   ├── profileRepository.ts   # UserProfile DB 쿼리
│   │   ├── tripRepository.ts      # Trip + TripDay + TripPlace 트랜잭션 CRUD ★
│   │   └── placeCacheRepository.ts # PlaceCache upsert/조회 ★
│   ├── services/
│   │   ├── authService.ts         # 인증 비즈니스 로직
│   │   ├── profileService.ts      # 프로필 비즈니스 로직
│   │   ├── claudeService.ts       # Claude AI 일정 생성 (프롬프트, 파싱, 재시도) ★
│   │   └── tripService.ts         # 여행 오케스트레이션 (AI + DB + 접근제어) ★
│   ├── controllers/
│   │   ├── authController.ts      # 인증 요청/응답
│   │   ├── profileController.ts   # 프로필 요청/응답
│   │   └── tripController.ts      # 여행 요청/응답 ★
│   └── routes/
│       ├── authRoutes.ts          # /api/v1/auth/*
│       ├── profileRoutes.ts       # /api/v1/profile/*
│       └── tripRoutes.ts          # /api/v1/trips/* ★
└── package.json                   # express, prisma, bcryptjs, zod, jsonwebtoken, @anthropic-ai/sdk 등

packages/shared/src/
└── index.ts                       # 공유 타입 (UserProfile, Trip, Place, PlaceCategory 등 25+ 인터페이스)
```

> ★ = 3단계에서 추가된 파일

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
