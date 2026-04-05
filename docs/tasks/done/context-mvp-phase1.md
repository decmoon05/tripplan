# MVP Phase 1 맥락 노트

> 작성일: 2026-03-09
> 관련 계획서: `./plan-mvp-phase1.md`

## 1. 왜 이렇게 결정했는가

| 결정 사항 | 선택지 | 최종 선택 | 이유 |
|-----------|--------|-----------|------|
| 데이터 관리 | A) Mock만 B) 실제 DB C) Hybrid | C) Hybrid | 타입은 DB 기반, 런타임은 Zustand. Phase 2 전환 용이 |
| 폼 라이브러리 | react-hook-form vs Formik | react-hook-form | 번들 작고 RHF+Zod 통합 성숙 |
| 상태 관리 | Context vs Zustand vs Jotai | Zustand | persist 미들웨어로 localStorage 연동 간편 |
| AI 시뮬레이션 | 즉시 반환 vs 딜레이 | 1.5초 딜레이 | 실제 UX에 가깝게 로딩 상태 테스트 |

## 2. 제약 조건

- Phase 1에서 Supabase 인스턴스 없이 동작해야 함 → 미들웨어 수정 필요했음
- Zod v4 사용 중 (`zod/v4` import path)
- Next.js 16에서 middleware가 deprecated 경고 발생 (proxy로 전환 권장)

## 3. 참고 자료 위치

| 자료 | 위치 |
|------|------|
| 백엔드 매뉴얼 | `docs/manuals/backend.md` |
| 프론트엔드 매뉴얼 | `docs/manuals/frontend.md` |
| PRD | `docs/prd/tripplan-prd.md` |
| 계획 파일 | `.claude/plans/snoopy-wobbling-noodle.md` |

## 4. 주의 사항 및 함정

- react-hook-form의 `watch()`가 React Compiler 경고 발생 (lint 경고 1개, 무해)
- Zustand persist는 SSR에서 hydration mismatch 가능 → 클라이언트 컴포넌트에서만 사용
- `createTripSchema`의 refine은 Zod v4에서 정상 동작 확인됨

## 5. 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|-----------|------|
| 2026-03-09 | 초기 작성 | Task 1~4 완료 후 소급 작성 |
