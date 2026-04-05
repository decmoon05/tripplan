# 여행 라이프사이클 완성 체크리스트

> 완료일: 2026-03-29

## 1단계: Trip 상태에 completed 추가
- [x] `TripStatus`에 `'completed'` 추가 (`database.ts`)
- [x] Zod validator에 `'completed'` 추가 (`tripItem.ts`)
- [x] DB 마이그레이션 작성 (`20260329000010_trip_completed_status.sql`)
- [x] TripDetailView에 "다녀왔어요" 버튼 + completed 뱃지
- [x] TripCard에 상대 날짜 표시 (D-3, 여행 중, 다녀옴)
- [x] STATUS_LABELS에 completed 추가

## 2단계: 여행 중 기능
- [x] DayColumn에 `isToday` prop + 📍 오늘 뱃지
- [x] 오늘 Day 자동 스크롤 (`scrollIntoView`)
- [x] TripDetailView에서 여행 중 모드 감지 + todayDayNumber 계산
- [x] InlineTimelineContent → DayColumn에 isToday 전달
- [x] TripDetailView 헤더에 "🧳 여행 중 · Day N" 표시

## 3단계: 여행 후 일괄 평가 모달
- [x] `TripReviewModal.tsx` 생성 (카드 스와이프 방식)
- [x] 5점 별점 + 한줄 메모 + 건너뛰기
- [x] ratings API에 memo 필드 추가 (입력 새니타이징)
- [x] DB 마이그레이션에 memo 컬럼 추가
- [x] "다녀왔어요" 클릭 → 리뷰 모달 → 완료 후 status 변경

## 4단계: 이전 여행 참조 (AI 프롬프트)
- [x] `cityNormalize.ts` 생성 (30개 도시 한/영/현지어 매핑)
- [x] `GET /api/v1/trips/history?destination=` API 생성
- [x] AI generate stream route에서 이전 여행 자동 조회
- [x] `buildPreviousExperienceSection()` — 만족도 기반 프롬프트 생성
- [x] `buildUserPrompt()`에 previousVisits 파라미터 추가
- [x] `AIProviderStreaming` 인터페이스에 previousVisits 추가

## 5단계: 트립 생성 시 이전 여행 표시
- [x] PlaceExperienceCards에서 `/api/v1/trips/history` 호출
- [x] 이전 방문 장소 자동 선호도 설정 (4~5점→재방문, 1~2점→제외)
- [x] "이전에 방문하셨네요" 배너 UI

## 보안 리뷰
- [x] history API: 인증 + 레이트리밋 + 입력 검증 확인
- [x] ratings API: memo 새니타이징 (제어문자/HTML태그 제거, 200자 제한)
- [x] AI prompt: placeNameSnapshot/memo 새니타이징 확인
- [x] 모든 DB 호출: Supabase SDK 파라미터화 쿼리 확인
