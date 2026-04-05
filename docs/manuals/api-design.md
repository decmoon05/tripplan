# API 설계 가이드

> 이 매뉴얼은 REST API 엔드포인트 설계 시 참조한다.
> 관련 매뉴얼: `backend.md`, `error-handling.md`, `security.md`

## URL 설계 원칙

- 리소스 중심 URL: 동사 금지, 명사 복수형 사용
- 계층 관계는 중첩으로 표현 (최대 2단계)
- 소문자, 하이픈 사용 (언더스코어, camelCase 금지)

```
좋은 예:
  GET    /api/v1/trips
  GET    /api/v1/trips/:tripId
  POST   /api/v1/trips
  PUT    /api/v1/trips/:tripId
  DELETE /api/v1/trips/:tripId
  GET    /api/v1/trips/:tripId/spots

나쁜 예:
  GET    /api/v1/getTrips
  POST   /api/v1/createTrip
  GET    /api/v1/trips/:tripId/spots/:spotId/reviews/:reviewId  (3단계 중첩)
```

## HTTP 메서드 사용

| 메서드 | 용도 | 멱등성 |
|--------|------|--------|
| GET | 조회 | O |
| POST | 생성 | X |
| PUT | 전체 수정 | O |
| PATCH | 부분 수정 | O |
| DELETE | 삭제 | O |

## 상태 코드 사용

| 상태코드 | 의미 | 사용 시점 |
|----------|------|-----------|
| 200 | 성공 | 조회, 수정 성공 |
| 201 | 생성됨 | POST로 리소스 생성 성공 |
| 204 | 내용 없음 | DELETE 성공 |
| 400 | 잘못된 요청 | 입력 검증 실패 |
| 401 | 미인증 | 토큰 없음/만료 |
| 403 | 권한 없음 | 인가 실패 |
| 404 | 없음 | 리소스 미존재 |
| 409 | 충돌 | 중복 데이터 |
| 500 | 서버 에러 | 예상치 못한 오류 |

## 페이지네이션

```
GET /api/v1/trips?page=1&limit=20&sort=created_at&order=desc
```

응답:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

## URL → 파일 경로 매핑 (Next.js App Router)

Next.js 파일 시스템 라우팅에 따라 URL이 파일 경로로 매핑된다:

| URL | 파일 경로 |
|-----|-----------|
| `/api/v1/trips` | `src/app/api/v1/trips/route.ts` |
| `/api/v1/trips/:tripId` | `src/app/api/v1/trips/[tripId]/route.ts` |
| `/api/v1/ai/generate` | `src/app/api/v1/ai/generate/route.ts` |

- 각 `route.ts`에서 `GET`, `POST`, `PUT`, `PATCH`, `DELETE` 함수를 named export
- 하나의 route 파일에 여러 HTTP 메서드 핸들러 정의 가능

```typescript
// src/app/api/v1/trips/route.ts
export async function GET(request: NextRequest) { /* 목록 조회 */ }
export async function POST(request: NextRequest) { /* 생성 */ }

// src/app/api/v1/trips/[tripId]/route.ts
export async function GET(request: NextRequest, { params }: { params: { tripId: string } }) { /* 단건 조회 */ }
export async function PUT(request: NextRequest, { params }: { params: { tripId: string } }) { /* 수정 */ }
export async function DELETE(request: NextRequest, { params }: { params: { tripId: string } }) { /* 삭제 */ }
```

## 버전 관리

- URL 경로에 버전 포함: `/api/v1/`
- 주요 변경 시 버전 업: `/api/v2/`
- 기존 버전은 최소 6개월 유지

## 외부 API 비용 최적화

> **API 호출 비용이 수익에 직접 영향. 상세 비용 모델: `docs/prd/api-cost-model.md`**

### Google Places API
- **필드 마스크 필수:** `X-Goog-FieldMask` 헤더로 필요한 필드만 요청
- **세션 토큰:** Autocomplete → Place Details 체인 시 세션 토큰 사용
- **클라이언트 캐시:** 동일 place_id 상세 정보는 세션 스토리지에 30분 캐시
- **Nearby Search 최소화:** 가능하면 Text Search 1회로 대체

### AI API
- **토큰 최적화:** 시스템 프롬프트를 간결하게 유지, 불필요한 컨텍스트 제거
- **모델 분기:** 단순 작업(분류, 추출)은 mini/haiku 모델, 복잡한 생성은 풀 모델
- **응답 캐싱:** 동일 조건(목적지+성향+일수) 일정은 DB에 캐시하여 재사용

### 무료 사용자 API 호출 제한
- 무료 사용: 월 2회 일정 생성
- Rate Limit: 사용자별 분당 최대 10회 API 호출

## 금지 사항

- URL에 동사 사용 금지
- 3단계 이상 URL 중첩 금지
- GET 요청으로 데이터 변경 금지
- 200 OK로 에러 응답 금지
- **Google Places API 필드 마스크 없이 호출 금지**
