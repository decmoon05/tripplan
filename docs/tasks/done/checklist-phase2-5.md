# Phase 2~5 전체 구현 체크리스트

> 작성일: 2026-03-29
> 진행률: 전체 완료 ✅

---

## Phase 2 — 실용성 확보

### 2-1. 준비물 체크리스트
- [x] `supabase/migrations/20260329000001_trip_checklists.sql` (RLS 포함)
- [x] `src/app/api/v1/trips/[tripId]/checklist/route.ts` (GET, POST + 레이트리밋 + 아이템 길이 검증)
- [x] `src/app/api/v1/trips/[tripId]/checklist/[itemId]/route.ts` (PUT toggle, DELETE)
- [x] `src/hooks/useChecklist.ts` (optimistic toggle)
- [x] `src/components/features/trip-view/ChecklistPanel.tsx` (카테고리 필터, 진행바, 기본 아이템)
- [x] TripDetailView에 탭(일정/준비물/예산/사진) 추가

### 2-2. 인쇄/PDF 내보내기
- [x] `src/components/features/trip-view/PrintButton.tsx` (window.print())
- [x] `@media print` CSS 스타일 추가 (nav/map 숨김, 타임라인만 출력)

### 2-3. ICS 캘린더 내보내기
- [x] `src/lib/utils/ics.ts` (RFC 5545 준수, CRLF 이스케이핑 — ICS 헤더 인젝션 수정)
- [x] `src/app/api/v1/trips/[tripId]/export/route.ts` (인증 + 파일명 sanitize)
- [x] `src/components/features/trip-view/CalendarExportButton.tsx`

### 2-4. 예산 관리 강화
- [x] `supabase/migrations/20260329000002_trip_expenses.sql` (RLS 포함)
- [x] `src/app/api/v1/trips/[tripId]/expenses/route.ts` (CRUD + 통화/금액/날짜/메모 검증)
- [x] `src/app/api/v1/trips/[tripId]/expenses/[expenseId]/route.ts` (PUT, DELETE)
- [x] `src/hooks/useExpenses.ts`
- [x] `src/components/features/trip-view/BudgetPanel.tsx` (예상 vs 실제 비용 비교)

---

## Phase 3 — 완성도 확보

### 3-1. 숙소 추천
- [x] `src/components/features/trip-view/AccommodationCard.tsx` (Google Maps 링크 포함)
- [x] TripDetailView Trip Overview에 숙소 추천 섹션 추가

### 3-2. 경로 최적화
- [x] `src/lib/utils/routeOptimizer.ts` (Haversine 거리 + Greedy nearest-neighbor)
- [x] `src/app/api/v1/trips/[tripId]/optimize-route/route.ts` (dayNumber 타입 검증)
- [x] DayColumn에 "동선 최적화" 버튼 추가

### 3-3. 알림/리마인더
- [x] `supabase/migrations/20260329000003_trip_notifications.sql`
- [x] `src/app/api/v1/trips/[tripId]/reminder/route.ts` (GET, POST)
- [x] `src/components/features/trip-view/ReminderToggle.tsx`
- [!] 실제 이메일 발송: Supabase Edge Functions + Resend 연동 필요 (별도 구현)

---

## Phase 4 — 차별화

### 4-1. Travel Room 실시간 동기화
- [x] `src/hooks/useRoomRealtime.ts` (Supabase Realtime postgres_changes)
- [x] RoomView에 realtime hook 연결

### 4-2. Travel Room 투표
- [x] `supabase/migrations/20260329000004_room_votes.sql`
- [x] `src/app/api/v1/rooms/[roomId]/votes/route.ts` (topic/value 길이 검증)
- [x] `src/components/features/rooms/VoteButton.tsx` (upsert — 1인 1투표)

### 4-3. Travel Room 채팅
- [x] `supabase/migrations/20260329000005_room_messages.sql` (DB level 1000자 제한)
- [x] `src/app/api/v1/rooms/[roomId]/messages/route.ts` (cursor pagination + before 검증 + 레이트리밋)
- [x] `src/hooks/useRoomChat.ts` (Supabase Realtime INSERT 구독)
- [x] `src/components/features/rooms/ChatPanel.tsx`

### 4-4. 마이페이지 강화
- [x] `src/components/features/mypage/TripHistory.tsx`
- [x] `src/components/features/mypage/TravelStats.tsx` (방문 국가, 총 여행일수, 상태 분포)
- [x] 마이페이지에 탭(프로필|여행 이력|통계) 추가

### 4-5. 이전 여행 기반 평점
- [x] `supabase/migrations/20260329000006_trip_ratings.sql`
- [x] `src/app/api/v1/trips/[tripId]/ratings/route.ts` (GET, POST/PUT upsert)
- [x] TimelineCard에 StarRating 컴포넌트 추가

---

## Phase 5 — 확장

### 5-1. PWA
- [x] `public/manifest.json` (name, icon, theme_color, standalone)
- [x] `public/sw.js` (Cache-first 정적 자원, Network-first /trips/* 페이지)
- [x] `src/components/ServiceWorkerRegister.tsx`
- [x] `next.config.ts` 헤더 추가
- [!] `public/icon-192.png`, `public/icon-512.png` — 실제 아이콘 파일 추가 필요

### 5-2. 사진 갤러리
- [x] `supabase/migrations/20260329000007_trip_photos.sql` (RLS 포함)
- [x] `src/app/api/v1/trips/[tripId]/photos/route.ts` (signed upload URL + content-type/ext 검증 + path traversal 방지)
- [x] `src/components/features/trip-view/PhotoGallery.tsx` (lightbox, day 필터, 업로드)
- [!] Supabase Storage 버킷 `trip-photos` 수동 생성 필요

---

## 보안 리뷰 수정 이력 (2026-03-29)

| 항목 | 심각도 | 수정 내용 |
|------|--------|-----------|
| ICS 헤더 인젝션 | HIGH | `escapeICS()`: `[\r\n]` → `\\n`, `:` → `\\:` 이스케이핑 추가 |
| 파일명 인젝션 (export) | MEDIUM | `safeDest` 정규식으로 특수문자 제거, 40자 제한 |
| expenses 유효성 검증 | MEDIUM | 통화 whitelist, 금액 상한, 메모 500자, 날짜 형식 |
| votes 길이 제한 | MEDIUM | topic/value 100자 제한 |
| photos 파일 업로드 | MEDIUM | 허용 MIME 타입 whitelist, 확장자 검증, path traversal 차단 |
| photos caption | MEDIUM | 500자 제한 |
| messages before cursor | LOW | ISO 8601 형식 검증 |
| optimize-route dayNumber | LOW | 타입 및 정수 검증 |
| 레이트리밋 추가 | MEDIUM | checklist write, messages write, photos write, optimize-route, export |

## 완료 후 검증
- [x] `npx tsc --noEmit` — 0 errors
- [x] 코드 리뷰 완료
- [x] 보안 리뷰 + 수정 완료
