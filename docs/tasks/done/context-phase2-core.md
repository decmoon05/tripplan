# Phase 2 핵심 연동 - 맥락 노트

## 주요 결정 사항

### 1. getAuthUser() 공통 유틸 추출
- 4개 Route Handler에서 동일한 인증 검증 패턴이 반복됨
- `src/lib/auth/getAuthUser.ts`로 추출하여 DRY 원칙 준수
- Supabase 서버 클라이언트 생성 + `auth.getUser()` + AppError throw를 캡슐화

### 2. 서비스 레이어에 userId 필터 추가 (보안 감사 후 수정)
- 초기 구현: RLS에만 의존하여 `getTrip(supabase, tripId)`로 조회
- 리뷰 피드백: RLS 비활성화/버그 시 IDOR 취약점 발생 가능
- 수정: `getTrip(supabase, tripId, userId)` → `.eq('user_id', userId)` 필터 추가
- `updateTrip`, `deleteTrip`, `generateTripItems` 모두 userId 인자 추가

### 3. Body 검증 스키마 도입 (보안 감사 후 수정)
- `src/lib/validators/tripItem.ts` 신규 생성
- `updateTripSchema`: `.strict()`로 허용 필드 외 거부 (Mass Assignment 방어)
- `createTripItemSchema`: XSS sanitize(replace `<>`) + 범위 검증
- `updateTripItemSchema`: itemId UUID 형식 검증 포함

### 4. fetchApi DELETE 응답 처리
- 원래: `!json.success || json.data === null` → DELETE 성공 시에도 에러 throw
- 수정: `!json.success`만 확인, `data`는 `as T`로 반환
- Content-Type 헤더도 body가 있는 경우에만 설정

### 5. Store → TanStack Query 전환 전략
- 읽기 먼저 교체: TripDetailView → `useTripDetail` 훅
- 쓰기 교체: 모든 mutation → `useTripMutations` 훅
- tripStore는 더 이상 어디에서도 import하지 않음
- profileStore는 폼 임시 상태 전용으로 유지 (DB 동기화는 `useSaveProfile` 훅)

### 6. Open Redirect 방어
- `/auth/callback`의 `next` 파라미터: `//evil.com` 형태의 protocol-relative URL 차단
- 검증: `startsWith('/')` && `!startsWith('//')`

## 변경 파일 목록 (총 30+ 파일)

### 신규 생성 (18개)
- `src/types/auth.ts`
- `src/lib/validators/auth.ts`
- `src/lib/validators/tripItem.ts`
- `src/lib/supabase/auth.ts`
- `src/lib/supabase/helpers.ts`
- `src/lib/auth/getAuthUser.ts`
- `src/lib/services/profile.service.ts`
- `src/lib/api/trips.ts`
- `src/hooks/useTrips.ts`
- `src/hooks/useTripDetail.ts`
- `src/hooks/useTripMutations.ts`
- `src/hooks/useProfile.ts`
- `src/components/features/auth/LoginForm.tsx`
- `src/components/features/auth/SignupForm.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/signup/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/api/v1/trips/[tripId]/route.ts`
- `src/app/api/v1/trips/[tripId]/items/route.ts`
- `src/app/api/v1/profile/route.ts`

### 수정 (12개)
- `src/types/database.ts` — UserProfile에 userId 추가
- `src/middleware.ts` — 보호 경로 분기
- `src/lib/services/trip.service.ts` — Mock → Supabase DB, userId 필터
- `src/app/api/v1/trips/route.ts` — GET 추가, auth 검증
- `src/app/api/v1/ai/generate/route.ts` — auth + userId 전달
- `src/components/ui/Header.tsx` — 인증 상태 UI
- `src/components/features/trip-view/TripDetailView.tsx` — Store → hook
- `src/components/features/trip-view/TimelineView.tsx` — allItems prop
- `src/components/features/trip-view/DayColumn.tsx` — allItems prop, existingCount
- `src/components/features/trip-view/TimelineCard.tsx` — hook + reorder async
- `src/components/features/trip-creator/TripCreatorForm.tsx` — mutation
- `src/components/features/trip-editor/*.tsx` — mutation + 에러 처리
- `src/components/features/profile/ProfileForm.tsx` — DB 저장
- `src/mocks/profiles.ts` — userId 추가
- `supabase/migrations/...rls_policies.sql` — DELETE 정책 추가

## 리뷰/보안 감사 결과 (수정 완료)
- Critical 4건: Open Redirect, PATCH Mass Assignment, POST/PATCH 검증 누락, IDOR
- High 4건: AI generate IDOR, 서비스 userId 필터, POST/PATCH items 검증
- Major 5건: DELETE 응답 버그, Reorder race condition, EditItemModal state, getAuthUser 중복, 모달 에러 처리
- Medium/Low 3건: 로그인 에러 메시지, DELETE RLS, 미사용 함수 제거
