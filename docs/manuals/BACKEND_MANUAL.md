# 백엔드 매뉴얼

> 백엔드/API/서버/DB 관련 작업 시 이 매뉴얼을 읽을 것.

---

## 1. 기본 원칙

- **언어**: Node.js + TypeScript (strict mode)
- **프레임워크**: Express.js 또는 Fastify
- **ORM**: Prisma (PostgreSQL)
- **인증**: JWT (Access Token 15분 + Refresh Token 7일)

---

## 2. 폴더 구조

```
packages/api/
├── src/
│   ├── routes/          # 라우터 (얇게 유지)
│   ├── controllers/     # 요청/응답 처리
│   ├── services/        # 비즈니스 로직 (핵심)
│   ├── repositories/    # DB 접근 레이어
│   ├── middlewares/     # 인증, 검증, 에러 처리
│   ├── types/           # TypeScript 타입 정의
│   └── utils/           # 공통 유틸리티
├── prisma/
│   └── schema.prisma    # DB 스키마
└── .env                 # 환경변수 (절대 커밋 금지)
```

---

## 3. API 설계 규칙

### REST 엔드포인트 명명
```
GET    /api/v1/trips           # 목록 조회
GET    /api/v1/trips/:id       # 단건 조회
POST   /api/v1/trips           # 생성
PATCH  /api/v1/trips/:id       # 부분 수정
DELETE /api/v1/trips/:id       # 삭제
```

### 응답 형식 (항상 일관되게)
```typescript
// 성공
{
  success: true,
  data: T,
  message?: string
}

// 에러
{
  success: false,
  error: {
    code: string,      // 예: "TRIP_NOT_FOUND"
    message: string    // 사용자에게 보여줄 메시지
  }
}
```

---

## 4. 에러 처리 규칙

```typescript
// 모든 async 함수는 try-catch 필수
async function getTrip(id: string) {
  try {
    const trip = await tripRepository.findById(id);
    if (!trip) throw new AppError('TRIP_NOT_FOUND', 404);
    return trip;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('INTERNAL_ERROR', 500);
  }
}
```

- `AppError` 클래스를 만들어 일관된 에러 처리.
- 절대로 에러를 조용히 삼키지 말 것 (empty catch block 금지).
- 운영 환경에서 스택 트레이스 노출 금지.

---

## 5. 보안 규칙

- 모든 사용자 입력은 `zod` 또는 `joi`로 검증.
- SQL은 Prisma를 통해서만 실행 (raw query 최소화).
- Rate limiting 필수 (특히 AI 호출 엔드포인트).
- CORS는 허용 도메인 명시적 지정.
- 민감 정보 로그 출력 금지 (비밀번호, API 키, 개인정보).

---

## 6. DB 스키마 원칙

- 테이블명은 snake_case 복수형 (예: `user_profiles`, `travel_itineraries`).
- 모든 테이블에 `created_at`, `updated_at` 필드 포함.
- 소프트 삭제 사용 시 `deleted_at` 필드 추가.
- 개인정보 컬럼은 암호화 고려 (여행 취향, 성향 데이터).

---

## 7. 환경변수 목록

```env
# 서버
PORT=3000
NODE_ENV=development

# DB
DATABASE_URL=postgresql://...

# AI
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_PLACES_API_KEY=...

# 인증
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# 캐시
REDIS_URL=redis://...
```
