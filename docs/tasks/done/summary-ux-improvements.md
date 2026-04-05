# UX 개선 작업 요약 (2026-03-20)

## 개요

사용자 실사용 중 발견된 7가지 UX 불편사항을 전수 개선.
모든 이슈 구현 완료, `npx next build` 통과 확인.

---

## 이슈 #5: 대시보드 (여행 목록)

**문제**: 저장된 여행을 다시 볼 수 있는 목록 페이지 부재
**해결**: `/dashboard` 라우트 신규 생성

| 작업 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/app/dashboard/page.tsx` | 여행 목록 페이지 — 최신순 정렬, 삭제(확인 대화), 빈 상태 CTA |
| 신규 | `src/components/features/dashboard/TripCard.tsx` | 여행 카드 — 목적지, 날짜, 상태 뱃지, 일수, 삭제 |
| 수정 | `src/components/ui/Header.tsx` | 로고 → /dashboard, "내 여행" 링크 추가 |
| 수정 | `src/components/features/trip-view/TripDetailView.tsx` | 뒤로가기 → /dashboard |

---

## 이슈 #1: 마이페이지

**문제**: 온보딩 후 프로필 확인/수정 불가
**해결**: `/mypage` 라우트 + ProfileForm isEdit 모드

| 작업 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/app/mypage/page.tsx` | DB 프로필 로드 → Zustand 동기화 → ProfileForm(isEdit) |
| 수정 | `src/components/features/profile/ProfileForm.tsx` | `isEdit` prop: 기존값 pre-fill, "프로필 저장" 버튼, 토스트 |
| 수정 | `src/components/ui/Header.tsx` | "마이페이지" 링크 추가 |

---

## 이슈 #3: 자동 진행 (Auto-advance)

**문제**: Pace/Budget/Companion 선택 시 "다음" 버튼을 별도로 눌러야 함 (2번 클릭)
**해결**: 옵션 클릭 즉시 300ms 후 자동 진행

| 작업 | 파일 | 내용 |
|------|------|------|
| 수정 | `src/components/features/trip-creator/TripCreatorForm.tsx` | `useRef` + `useCallback` 패턴으로 stale closure 방지, 300ms debounce |

**기술 세부**: `handlePrefNextRef` 패턴 — React state 전파 후 `canProceedPref()` 체크

---

## 이슈 #7: 지도 + 타임라인 동시 표시

**문제**: 3탭(타임라인/지도/리스트)이라 동시에 볼 수 없음
**해결**: 데스크톱 좌우 분할, 모바일 탭 토글

| 작업 | 파일 | 내용 |
|------|------|------|
| 수정 | `src/components/features/trip-view/TripView.tsx` | `lg:grid-cols-2` 분할, `highlightedItemId` 공유 상태 |
| 수정 | `src/components/features/map/MapView.tsx` | 마커 하이라이트 (scale 1.4 + ring), `onMarkerClick` 콜백 |
| 수정 | `src/components/features/trip-view/TimelineView.tsx` | hover/click 이벤트 전달 |
| 수정 | `src/components/features/trip-view/TimelineCard.tsx` | `isHighlighted`, `onHover`, `onClick` props, scroll-to ID |
| 수정 | `src/components/features/trip-view/DayColumn.tsx` | highlight props 전달 |
| 수정 | `src/app/trips/[tripId]/page.tsx` | `max-w-2xl` → `max-w-6xl` |

---

## 이슈 #6: 비행기 도착시간 / 숙소 위치

**문제**: AI가 Day 1 항상 오전 9시 시작, 숙소 위치 미고려
**해결**: 여행 생성 폼에 도착시간/숙소지역 입력 추가 → AI 프롬프트 반영

| 작업 | 파일 | 내용 |
|------|------|------|
| 수정 | `src/lib/validators/profile.ts` | `ARRIVAL_TIMES` enum, `arrivalTime`, `hotelArea` 필드 |
| 수정 | `src/components/features/trip-creator/TripCreatorForm.tsx` | 도착시간 4옵션 선택 + 숙소지역 텍스트 입력 |
| 수정 | `src/lib/services/ai/prompt.ts` | `buildProfileSection`: 도착시간/숙소 섹션, `buildChunkPrompt`: Day1 조건부 적용 |

---

## 이슈 #2: 커스텀 관심사 / 식성

**문제**: 고정 enum만 선택 가능, 사용자 정의 입력 불가
**해결**: 자유 입력 텍스트 필드 추가 (식성 100자, 관심사 200자)

| 작업 | 파일 | 내용 |
|------|------|------|
| 신규 | `supabase/migrations/20260320000002_custom_preferences.sql` | `custom_food_preference`, `custom_interests` 컬럼 |
| 수정 | `src/lib/validators/profile.ts` | `customFoodPreference`, `customInterests` Zod 스키마 |
| 수정 | `src/types/database.ts` | `UserProfile` 타입 확장 |
| 수정 | `src/components/features/profile/steps/FoodStep.tsx` | "기타" 자유 입력 UI |
| 수정 | `src/components/features/profile/steps/InterestsStep.tsx` | "기타" 자유 입력 UI |
| 수정 | `src/components/features/profile/ProfileForm.tsx` | 커스텀 props 전달 + 요약 표시 |
| 수정 | `src/stores/profileStore.ts` | 커스텀 필드 추가, version 3→4 |
| 수정 | `src/hooks/useProfile.ts` | `saveProfile`에 커스텀 필드 전달 |
| 수정 | `src/lib/services/profile.service.ts` | upsert에 커스텀 필드 포함 |
| 수정 | `src/lib/services/ai/prompt.ts` | 커스텀 값을 기존 식성/관심사에 병합 (3곳) |
| 수정 | `src/mocks/profiles.ts` | mock 데이터에 커스텀 필드 추가 |
| 수정 | `src/app/mypage/page.tsx` | 커스텀 필드 DB→Store 로드 |

---

## 이슈 #4: 장소 카드 이미지/설명

**문제**: PlaceExperienceCards에 이미지 없음, 설명 부족
**해결**: Google Places Photo API 연동 + 카테고리별 폴백

| 작업 | 파일 | 내용 |
|------|------|------|
| 신규 | `supabase/migrations/20260320000003_place_photo_reference.sql` | `place_cache.photo_reference` 컬럼 |
| 수정 | `src/lib/services/googlePlaces.service.ts` | `PLACE_FIELD_MASK`에 photos 추가, `photoReference` 수집 |
| 수정 | `src/lib/services/ai/popularPlaces.ts` | `PopularPlace.photoReference` 추가 |
| 수정 | `src/components/features/trip-creator/PlaceExperienceCards.tsx` | 썸네일 이미지 + 그라디언트 오버레이 + 카테고리 아이콘 폴백 |

---

## 이슈 #6b: Google Maps API 에러

**문제**: `ApiNotActivatedMapError` — Maps JavaScript API 미활성화
**해결**: 코드 변경 없음 — Google Cloud Console에서 Maps JavaScript API 활성화 필요

---

## 변경 통계

| 구분 | 수량 |
|------|------|
| 신규 파일 | 5개 (페이지 2, 컴포넌트 1, 마이그레이션 2) |
| 수정 파일 | 17개 |
| DB 마이그레이션 | 2개 (custom_preferences, place_photo_reference) |
| 빌드 결과 | ✅ 통과 |

## 신규 라우트

| 경로 | 설명 |
|------|------|
| `/dashboard` | 여행 목록 대시보드 |
| `/mypage` | 프로필 확인/수정 |

## 주요 기술 결정

1. **Auto-advance**: `useRef` + 300ms debounce로 React 상태 전파 타이밍 해결
2. **지도 분할**: CSS Grid (`lg:grid-cols-2`) + sticky 맵, 모바일은 탭 토글 유지
3. **마커 하이라이트**: `AdvancedMarkerElement`의 pin content에 CSS transform 직접 적용
4. **Photo URL**: Google Places (New) API — `places/{id}/photos/{ref}/media` 엔드포인트
5. **ProfileForm 재사용**: `isEdit` prop으로 온보딩/마이페이지 양쪽에서 동일 컴포넌트 사용

---

## 코드 리뷰 결과

| 파일 | 상태 | 비고 |
|------|------|------|
| dashboard/page.tsx | ✅ | 이상 없음 |
| TripCard.tsx | ✅ | 이상 없음 |
| mypage/page.tsx | ✅ | 이상 없음 |
| TripCreatorForm.tsx | ⚠️ | feasibility-check silent catch — 의도된 설계 (선택적 사전 검사) |
| TripView.tsx | ✅ | 이상 없음 |
| MapView.tsx | ✅ | marker.position null 체크 이미 존재 (line 177) |
| PlaceExperienceCards.tsx | ⚠️ | NEXT_PUBLIC_ API key가 img src에 노출 — Google 정책상 불가피, Cloud Console에서 HTTP 리퍼러 제한 필요 |

### 보안 점검 결과 (발견 8건, 수정 3건)

**즉시 수정 완료:**

| 위험도 | 내용 | 수정 파일 |
|--------|------|-----------|
| 높음 | `/dashboard`, `/mypage` 미들웨어 인증 보호 누락 | `src/middleware.ts` — PROTECTED_PATHS에 추가 |
| 높음 | `specialNote` prompt injection 방어 누락 (제어문자/구분자 미제거) | `src/lib/services/ai/prompt.ts` — sanitization 추가 (2곳) |
| 중간 | `placeName` prompt injection 방어 누락 | `src/lib/services/ai/prompt.ts` — sanitize 함수 적용 (2곳) |

**확인된 안전 항목:**
- **XSS**: React JSX 자동 이스케이프. `dangerouslySetInnerHTML` 미사용
- **API 키**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`는 클라이언트 노출 설계. Cloud Console 도메인 제한 필요
- **입력 검증**: Zod 스키마로 서버/클라이언트 모두 검증. `maxLength` 적용
- **인증**: getAuthUser()로 토큰 검증, RLS 정책 적용, 역할 자가 승격 방지 트리거
- **SQL Injection**: Supabase SDK 파라미터 바인딩 보장
- **Rate Limiting**: Auth POST에 IP 기반 15분/10회 제한

**잔여 권장사항 (코드 변경 불요, 환경 설정):**
- Google Cloud Console에서 API 키 HTTP Referer 제한 설정
- DB `custom_food_preference`/`custom_interests`에 CHECK constraint 추가 고려
