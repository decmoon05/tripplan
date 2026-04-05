# 에러 처리 가이드

> 이 매뉴얼은 에러/예외 처리 코드 작성 시 참조한다.
> 관련 매뉴얼: `backend.md`, `security.md`

## 에러 계층 구조

커스텀 에러 클래스를 계층적으로 정의한다:

```
AppError (기본)
├── ValidationError    (400)
├── AuthenticationError (401)
├── ForbiddenError     (403)
├── NotFoundError      (404)
├── ConflictError      (409)
└── InternalError      (500)
```

- 모든 커스텀 에러는 `code`(문자열), `statusCode`(숫자), `message`(문자열) 포함
- 예: `new NotFoundError('TRIP_NOT_FOUND', '여행 계획을 찾을 수 없습니다')`

## 에러 응답 형식

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TRIP_NOT_FOUND",
    "message": "여행 계획을 찾을 수 없습니다"
  }
}
```

- 프로덕션에서는 stack trace 절대 노출 금지
- 내부 에러(DB 에러 등)는 일반 메시지로 변환하여 응답

## 에러 처리 위치

| 계층 | 처리 방식 |
|------|-----------|
| Controller | 커스텀 에러를 throw. try-catch로 감싸지 않음 |
| Service | 비즈니스 규칙 위반 시 커스텀 에러 throw |
| Repository | DB 에러를 커스텀 에러로 변환하여 throw |
| 글로벌 핸들러 | 최종 catch-all. 로깅 + 응답 포맷팅 |

## 로깅 규칙

- 에러 로그에 포함: timestamp, error code, message, stack trace, request ID
- 에러 로그에 포함 금지: 비밀번호, 토큰, 개인정보
- 로그 레벨: error(장애), warn(주의), info(정보), debug(개발용)

## 외부 API 에러 처리

### Google Places API 실패
- 장소 상세 조회 실패 → DB에 저장된 `place_name_snapshot` 표시 + "장소 정보를 불러올 수 없습니다" 안내
- Autocomplete 실패 → 검색 입력란에 안내 메시지, 수동 입력 허용

### AI API 실패 (GPT-4o / Claude)
- 1회 자동 재시도 후 실패 시 → "일정 생성에 실패했습니다. 잠시 후 다시 시도해주세요" 안내
- 타임아웃: 120초 (게이트웨이/직접 API 공통, 상세: `ai-gateway.md`)

### PG 결제 실패 (Phase 3)
- PG사 에러코드를 사용자 친화적 메시지로 매핑
- 결제 실패 시 트랜잭션 상태를 `failed`로 기록

### 재시도 정책
- 최대 재시도: 2회
- 백오프: 지수 백오프 (1초 → 2초)
- **4xx 에러는 재시도하지 않음** (클라이언트 오류이므로 재시도 무의미)
- 5xx 에러만 재시도 대상

## 금지 사항

- 빈 catch 블록 금지 (`catch(e) {}`)
- console.log로 에러 출력 금지 (로거 사용)
- 사용자에게 원본 에러 메시지 노출 금지
- catch 후 아무 처리 없이 null 반환 금지
