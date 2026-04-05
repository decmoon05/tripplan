# UX 개선 체크리스트

## 이슈 #5: 대시보드 (여행 목록) ✅
- [x] `src/app/dashboard/page.tsx` 신규 생성
- [x] `src/components/features/dashboard/TripCard.tsx` 신규 생성
- [x] `src/components/ui/Header.tsx` — "내 여행" 링크 + 로고 → /dashboard
- [x] `src/components/features/trip-view/TripDetailView.tsx` — 뒤로 가기 → /dashboard

## 이슈 #1: 마이페이지 ✅
- [x] `src/app/mypage/page.tsx` 신규 생성
- [x] `src/components/features/profile/ProfileForm.tsx` — isEdit 모드 추가
- [x] `src/components/ui/Header.tsx` — 마이페이지 링크 추가

## 이슈 #3: 자동 진행 ✅
- [x] `src/components/features/trip-creator/TripCreatorForm.tsx` — auto-advance 로직

## 이슈 #7: 지도+타임라인 동시 표시 ✅
- [x] `src/components/features/trip-view/TripView.tsx` — 데스크톱 분할 + 모바일 토글
- [x] `src/components/features/map/MapView.tsx` — 선택 마커 하이라이트 + 콜백
- [x] `src/components/features/trip-view/TimelineView.tsx` — hover/클릭 이벤트 전달
- [x] `src/components/features/trip-view/TimelineCard.tsx` — hover 상태 prop
- [x] `src/components/features/trip-view/DayColumn.tsx` — highlight props 전달
- [x] `src/app/trips/[tripId]/page.tsx` — max-w-6xl로 확장

## 이슈 #6: 비행기/숙소 고려 ✅
- [x] `src/lib/validators/profile.ts` — arrivalTime, hotelArea 추가
- [x] `src/components/features/trip-creator/TripCreatorForm.tsx` — 입력 필드 추가
- [x] `src/lib/services/ai/prompt.ts` — 도착시간/숙소 프롬프트 반영 (buildProfileSection + buildChunkPrompt)

## 이슈 #2: 커스텀 관심사/식성 ✅
- [x] DB 마이그레이션 — `supabase/migrations/20260320000002_custom_preferences.sql`
- [x] `src/lib/validators/profile.ts` — customFoodPreference, customInterests 필드
- [x] `src/types/database.ts` — UserProfile 타입 확장
- [x] `src/components/features/profile/steps/FoodStep.tsx` — 자유 입력 UI
- [x] `src/components/features/profile/steps/InterestsStep.tsx` — 자유 입력 UI
- [x] `src/components/features/profile/ProfileForm.tsx` — 커스텀 props 전달 + 요약 표시
- [x] `src/stores/profileStore.ts` — 커스텀 필드 추가 (version 4)
- [x] `src/hooks/useProfile.ts` — 커스텀 필드 전달
- [x] `src/lib/services/profile.service.ts` — 커스텀 필드 저장
- [x] `src/lib/services/ai/prompt.ts` — 커스텀 값 프롬프트 반영 (3곳)
- [x] `src/mocks/profiles.ts` — mock 데이터 업데이트
- [x] `src/app/mypage/page.tsx` — 커스텀 필드 로드

## 이슈 #4: 장소 이미지/설명 ✅
- [x] DB 마이그레이션 — `supabase/migrations/20260320000003_place_photo_reference.sql`
- [x] `src/lib/services/googlePlaces.service.ts` — photoReference 수집 (photos 필드 추가)
- [x] `src/lib/services/ai/popularPlaces.ts` — PopularPlace.photoReference 추가
- [x] `src/components/features/trip-creator/PlaceExperienceCards.tsx` — 이미지+설명 UI

## 이슈 #6b: Google Maps API 에러
- 코드 변경 불필요 (Cloud Console 설정만)
