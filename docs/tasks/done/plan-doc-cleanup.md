# 문서 정비 및 기획 보강 계획서

> 작성일: 2026-03-08
> 관련 작업: Gemini 대화 검토 후속 — 시스템 연동 복구 + 매뉴얼 품질 개선 + PRD 보강

## 목표
- PRD 문서가 시스템(CLAUDE.md, _index.md, 에이전트 레지스트리)에 연동되지 않은 "고아" 상태 해소
- 매뉴얼에 볼트온된 섹션들을 기존 구조에 통합
- PRD에 누락된 경쟁 참고, 성공 지표, 리스크 섹션 추가

## Phase 1: 시스템 연동 복구 (4파일)
- CLAUDE.md에 PRD 참조 행 추가
- _index.md에 라우팅 3행 추가 + 줄 수 수정
- _agent-registry.md Planning Agent에 PRD 참조 추가
- checklist-gemini-review-fixes.md 완료 처리

## Phase 2: 매뉴얼 품질 개선 (4파일)
- backend.md 구조 통합 (외부 API 연동 묶기)
- security.md 섹션 순서 재배열
- frontend.md 외부 API 클라이언트 처리 추가
- error-handling.md 외부 API 에러 처리 추가

## Phase 3: PRD 보강 (3파일)
- tripplan-prd.md 3개 섹션 추가
- api-cost-model.md 초기 고정비 + scope 명시
- legal-compliance.md 데이터 거주지 추가
