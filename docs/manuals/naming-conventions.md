# 네이밍 컨벤션 가이드

> 이 매뉴얼은 파일명, 변수명, 함수명, 클래스명 등을 결정할 때 참조한다.

## 파일명

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `TripCard.tsx`, `MapView.tsx` |
| 훅 파일 | camelCase, use 접두사 | `useTripEditor.ts` |
| 유틸리티 | camelCase | `dateFormatter.ts` |
| 서버 모듈 | camelCase | `tripService.ts`, `tripController.ts` |
| 테스트 파일 | 원본명.test.확장자 | `TripCard.test.tsx` |
| 타입 정의 | camelCase | `tripTypes.ts` |
| 상수 파일 | camelCase | `tripConstants.ts` |

## 변수/함수명

| 대상 | 규칙 | 예시 |
|------|------|------|
| 일반 변수 | camelCase | `tripPlan`, `startDate` |
| 상수 | UPPER_SNAKE_CASE | `MAX_TRIP_DAYS`, `API_BASE_URL` |
| 함수 | camelCase, 동사로 시작 | `getTripById`, `createTripPlan` |
| 불리언 | is/has/can 접두사 | `isActive`, `hasPermission` |
| 이벤트 핸들러 | handle 접두사 | `handleSubmit`, `handleTripDelete` |
| 콜백 Props | on 접두사 | `onSubmit`, `onTripDelete` |

## 클래스/타입명

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `TripService`, `AuthMiddleware` |
| 인터페이스 | PascalCase (I 접두사 금지) | `TripPlan`, `UserProfile` |
| 타입 별칭 | PascalCase | `TripStatus`, `ApiResponse` |
| Enum | PascalCase (멤버도 PascalCase) | `TripStatus.InProgress` |

## 금지 사항

- 한 글자 변수명 금지 (루프 인덱스 `i`, `j` 제외)
- 축약어 남발 금지 (`btn` → `button`, `msg` → `message`)
- 헝가리안 표기법 금지 (`strName`, `intCount`)
- 의미 없는 이름 금지 (`data`, `temp`, `result` 단독 사용)
