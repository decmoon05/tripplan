# Phase 2 핵심 연동 개발 체크리스트

## Task 1: Supabase Auth 인프라
- [x] `src/types/auth.ts` — AuthUser, AuthSession 타입
- [x] `src/lib/validators/auth.ts` — loginSchema, signupSchema
- [x] `src/lib/supabase/auth.ts` — signUp, signIn, signOut, getUser 래퍼
- [x] `src/types/database.ts` — UserProfile에 userId 필드 추가

## Task 2: Auth UI
- [x] `src/components/features/auth/LoginForm.tsx`
- [x] `src/components/features/auth/SignupForm.tsx`
- [x] `src/app/auth/login/page.tsx`
- [x] `src/app/auth/signup/page.tsx`
- [x] `src/app/auth/callback/route.ts`
- [x] `src/components/ui/Header.tsx` — 인증 상태 UI

## Task 3: 미들웨어 보호 경로
- [x] `src/middleware.ts` — 보호 경로 분기 로직

## Task 4: Trip Service DB 연동
- [x] `src/lib/supabase/helpers.ts` — snake_case ↔ camelCase
- [x] `src/lib/services/trip.service.ts` — Supabase DB 호출
- [x] `src/app/api/v1/trips/route.ts` — GET 추가, auth 검증
- [x] `src/app/api/v1/trips/[tripId]/route.ts` — GET/PATCH/DELETE
- [x] `src/app/api/v1/trips/[tripId]/items/route.ts` — GET/POST/PATCH/DELETE

## Task 5: TanStack Query 훅
- [x] `src/lib/api/trips.ts` — fetch 래퍼
- [x] `src/hooks/useTrips.ts`
- [x] `src/hooks/useTripDetail.ts`
- [x] `src/hooks/useTripMutations.ts`
- [x] 컴포넌트 교체 (TripDetailView, TripCreatorForm, editors, TimelineCard, DayColumn)

## Task 6: Profile DB 동기화
- [x] `src/lib/services/profile.service.ts`
- [x] `src/app/api/v1/profile/route.ts`
- [x] `src/hooks/useProfile.ts`
- [x] ProfileForm 수정 — 완료 시 DB 저장
- [x] profileStore — 폼 임시 상태 전용으로 유지

## 검증
- [x] `npm run build` 성공
- [x] `npx eslint src/` 에러 없음 (1 warning: React Hook Form watch — Phase 1부터 존재)
