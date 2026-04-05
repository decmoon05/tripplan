# Phase 2 Task 7~8 + UI 개선 체크리스트

## Task 7: AI API 실제 연동
- [x] openai, @anthropic-ai/sdk 패키지 설치
- [x] `src/lib/services/ai/types.ts` — AIProvider 인터페이스, AIGeneratedItem
- [x] `src/lib/services/ai/prompt.ts` — 프로필 기반 시스템/유저 프롬프트 빌더
- [x] `src/lib/services/ai/parseResponse.ts` — JSON 파서 + Zod 검증
- [x] `src/lib/services/ai/openai.provider.ts` — OpenAI (gpt-4o-mini 기본)
- [x] `src/lib/services/ai/claude.provider.ts` — Claude (claude-sonnet-4-6 기본)
- [x] `src/lib/services/ai.service.ts` — Strategy 패턴 (AI_PROVIDER 환경변수)
- [x] build 통과

## Task 8: Rate Limiting
- [x] `supabase/migrations/20260310000001_api_usage_log.sql` — 테이블 + RLS
- [x] `src/lib/services/rateLimit.service.ts` — 일별 한도 체크/기록
- [x] `src/app/api/v1/ai/generate/route.ts` — 생성 전 체크, 성공 후 기록
- [x] build 통과

## UI/UX 개선 (사용자 피드백 반영)
- [x] Hydration 에러 — `suppressHydrationWarning` (브라우저 확장 대응)
- [x] 다크모드 제거 — `prefers-color-scheme: dark` 삭제
- [x] 블루 테마 통일 — 20+ 파일에서 `bg-black` → `var(--color-primary)` (#4361ee)
  - globals.css, Button, Header, StepIndicator, SelectionCard
  - MbtiStep, FoodStep, ProfileForm (다음 버튼)
  - TimelineCard, DayColumn, TripView 탭, PlaceListView
  - LoginForm, SignupForm (input 포커스 + 버튼 + 링크)
  - EditItemModal, AddItemModal (input 포커스)
  - 랜딩 페이지
- [x] 날짜 입력 — `min`/`max` 속성 (오늘~1년 후, 달력 UI, 6자리 연도 방지)
- [x] 귀국일 — `min={startDate}` 로 출발일 이전 선택 불가
- [x] 여행 기간 — 5일 → 30일 제한 (validator + form 동시 수정)
- [x] Mock AI 확장 — 3일 이후 성향 기반 동적 생성 (pace→일정수, budget→비용 반영)
- [x] 비용 설명 추가 — "입장료+식비+교통비+카페 등 포함 (숙박비 별도)"
- [x] 여행 확정 버튼 — `useUpdateTrip` 훅 + status→confirmed + 완료 메시지
- [x] 상태 뱃지 색상 — draft(회색), generated(파랑), confirmed(초록)
- [x] 버튼 클릭 영역 확대 — 회원가입/로그인 `py-3`

## 검증
- [x] `npm run build` 성공
- [x] `npm run lint` 에러 없음 (기존 1 warning만)
- [x] Supabase 로컬 실행 + 마이그레이션 적용 완료

## 커밋 이력
- `469a01b` feat: AI API 실제 연동 + Rate Limiting (Phase 2 Task 7~8)
- (미커밋) fix: UI/UX 개선 — 블루 테마 + 날짜/기간 제한 + 여행 확정
