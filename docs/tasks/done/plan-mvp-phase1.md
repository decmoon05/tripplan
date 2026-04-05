# MVP Phase 1 개발 계획서

> 작성일: 2026-03-09
> 상태: 진행중 (Task 1~4 완료, Task 5~9 대기)
> 관련 체크리스트: `./checklist-mvp-phase1.md`
> 관련 맥락 노트: `./context-mvp-phase1.md`

## 1. 목표

- PRD Phase 1 MVP 기능을 Mock Data 기반으로 구현
- 전체 플로우: 랜딩 → 성향 입력 → 여행 생성 → AI 일정 생성 → 타임라인 뷰 → 편집/재생성

## 2. 범위

### 포함
- 사용자 성향 입력 (MBTI, 여행 페이스, 식성, 예산)
- 여행 생성 + Mock AI 일정 생성
- 일정 타임라인 뷰
- 지도 뷰 (번호 리스트, Google Maps는 Phase 2)
- 편집 + 재생성
- 에러/로딩 상태, 네비게이션
- DB 마이그레이션 (Phase 2 대비)

### 제외
- 실제 AI API 연동 (Mock으로 대체)
- 실제 Google Places API 연동
- Supabase Auth 연동 (Phase 2)
- 테스트 코드 (별도 작업)

## 3. 기술 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 데이터 저장 | Zustand + localStorage persist | Phase 1은 DB 없이 동작, 새로고침 유지 |
| AI 시뮬레이션 | setTimeout 1.5초 + 템플릿 선택 | 로딩 UX 테스트 가능 |
| 지도 뷰 | 번호 리스트 (실제 지도 X) | Phase 2에서 Google Maps 교체, 의존성 최소화 |
| 인증 | 생략 (mock userId) | Phase 2에서 Supabase Auth 연동 |

## 4. 파일 구조

```
src/
├── app/page.tsx (수정: 랜딩)
├── app/onboarding/page.tsx (신규)
├── app/trips/new/page.tsx (신규)
├── app/trips/[tripId]/page.tsx (신규)
├── app/api/v1/trips/route.ts (신규)
├── app/api/v1/ai/generate/route.ts (신규)
├── components/features/profile/ (신규: 5스텝 폼)
├── components/features/trip-creator/ (신규)
├── components/providers/QueryProvider.tsx (신규)
├── components/ui/ (신규: StepIndicator, SelectionCard)
├── lib/services/ (신규: ai, trip)
├── lib/validators/ (신규: profile, trip)
├── lib/errors/ (신규: appError, handler)
├── lib/supabase/ (신규: client, server)
├── mocks/ (신규: profiles, trips, tripItems)
├── stores/ (신규: profileStore, tripStore)
├── types/ (신규: database, api)
└── middleware.ts (수정: Phase 1 호환)
```

## 5. 단계별 작업

1. [x] Task 1: 기반 설정
2. [x] Task 2: Zod 스키마 + Mock 데이터
3. [x] Task 3: 사용자 성향 입력 폼
4. [x] Task 4: 여행 생성 + Mock AI
5. [ ] Task 5: 타임라인 뷰
6. [ ] Task 6: 지도 뷰 (번호 리스트)
7. [ ] Task 7: 편집 + 재생성
8. [ ] Task 8: 마무리
9. [ ] Task 9: DB 마이그레이션

## 6. 검증 기준

- npm run build 성공
- npm run lint 에러 없음
- 전체 플로우 동작 확인
- 새로고침 후 데이터 유지
