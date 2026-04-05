# _legacy/planner — v4 3단 군집 트리 파이프라인

v4 실험적 구현의 스냅샷. v5 재설계 시 참조용.

- **수정 금지** — 참조/비교용으로만 사용
- **원본 브랜치**: feat/v4-cluster-architecture
- **스냅샷 일자**: 2026-04-05
- **포함 내용**: 16개 모듈 (pipeline, dayAssigner, placeAssigner, routeOptimizer, timeCalculator, scorer, filter, verifier, regionAllocator, dayContext, aiAdapter, promptPlanner, tripItemMapper, types, weights, index)

## v4에서 발견된 주요 문제 (v5에서 해결 필요)

1. 오후 시간대 공백 (13~17시 비어있음) — dinner 밀기 로직 문제
2. attraction 부족, 식당/카페 편향 — 검증 통과율 카테고리 불균형
3. 2단계/3단계 순서 문제 — 아이템 위주 사용자(Case A) 미지원
4. dayAssigner의 area 수 결정이 사전적 — AI 결과 기반이어야 함
5. AI 할루시네이션 감지 부족

## 참조 문서

- docs/v4_architecture_design.md
- docs/v4_pipeline_decisions_summary.md
- docs/tasks/active/v4-pipeline-decisions-sync.md
- docs/tasks/active/e3-kansai-test-result.md
