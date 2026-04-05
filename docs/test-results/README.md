# AI 일정 생성 품질 테스트 결과

> 기간: 2026-03-29 ~ 2026-03-31
> 총 테스트: 70건+ (30 엣지케이스 + 8 재검증 + 32 2.5-flash)
> AI 모델: 3.1-pro(금지) → 3-flash → **2.5-flash**(현재 메인)
> 비용: ~$50 (3.1-pro 사고) + $0 (이후 무료 키)
> 프롬프트: v1(텍스트) → v4(자연어+JSON 하이브리드)
> 파이프라인: v1(일괄) → **v2(하루 단위 생성+검증+재생성)**

## 성과 요약

| 지표 | Cycle 1 | Cycle 5 (3-flash) | Cycle 10 (2.5-flash+v2) |
|------|---------|-------------------|------------------------|
| **PASS율** | 0% | ~80% | **40%** (식사 기준 80%) |
| **식사 통과율** | 17% | 100% | **80%** (augment 수정) |
| **시간 버그** | 3건 | 0건 | **0건** |
| **좌표 무효** | — | 0건 | **4건** (2.5-flash 한계) |
| **코드 수정 누적** | — | 16건 | **22건** |

### 최대 미해결 문제
- **좌표 무효** (4/6 FAIL의 원인) — 2.5-flash가 좌표를 안 주는 모델 한계. Pro/Places로 보완 가능
- **점심 누락** (2건) — findFreeSlot 범위 확장 필요
- **geo 비정상** (2건) — 627km, 879km 엉뚱한 좌표 → null 치환 필요

## 리포트 목록

| 파일 | 내용 |
|------|------|
| [cycle-1-report.md](cycle-1-report.md) | 사이클 1: 10건 엣지케이스, 0% PASS, 문제 발견 5건 |
| [cycle-2-report.md](cycle-2-report.md) | 사이클 2: 10건 새 시나리오, 10% PASS, 25:27 시간 버그 발견 |
| [cycle-3-report.md](cycle-3-report.md) | 사이클 3: 10건 새 시나리오, 20% PASS, -10:-46 버그 발견 |
| [cycle-4-fix-report.md](cycle-4-fix-report.md) | 근본 수정 7건 + 재검증 5건, 60% PASS |
| [cycle-5-hybrid-report.md](cycle-5-hybrid-report.md) | 하이브리드 프롬프트 + 오탐 수정, ~80% PASS |
| [cycle-6-25flash-report.md](cycle-6-25flash-report.md) | **gemini-2.5-flash 전환, Grounding 수정, 20% PASS** |
| [cycle-7-edge2-report.md](cycle-7-edge2-report.md) | edge2 테스트 + 코드 수정 5건 (augment/geo/drive/딜레이) |
| [cycle-7-flash-lite-report.md](cycle-7-flash-lite-report.md) | flash-lite 모델 품질 비교 (좌표 17건 무효 → 부적합) |
| [cycle-8-25flash-report.md](cycle-8-25flash-report.md) | v2 파이프라인 + 2.5-flash, 40% PASS |
| [cycle-10-augment-fix-report.md](cycle-10-augment-fix-report.md) | **r.id crash 1줄 수정 → 식사 80% 해결, PASS 40%** |
| [CHANGELOG-AI-IMPROVEMENTS.md](CHANGELOG-AI-IMPROVEMENTS.md) | **전체 개선 이력 (Cycle 1~10, 22건 코드 수정)** |

## 핵심 수정 사항

1. **프롬프트 텍스트→JSON 구조화** — AI 규칙 준수율 향상
2. **`augmentMissingMeals()`** — 식사 누락 시 자동 보강 (안전망)
3. **`toHHMM()` + 시간 클램프** — 25:27, -10:-46 시간 버그 완전 해결
4. **transit 180분 캡** — 도시간 793분 이동 비현실성 해결
5. **계절 데이터베이스** — 10개 계절 이벤트 패턴 (단풍, 벚꽃, 스키 등)
6. **검증 오탐 수정** — transit_variety, closedDays, duplicate 3건

## 테스트 인프라

- `test/scenarios/edge/` — 사이클 1 시나리오 10개
- `test/scenarios/edge2/` — 사이클 2 시나리오 10개
- `test/scenarios/edge3/` — 사이클 3 시나리오 10개
- `test/results/` — 생성 결과 JSON (gitignore)
- `scripts/test_scenarios.py` — Python CLI 테스트 러너
- `src/app/api/v1/admin/test-generate/` — 테스트 전용 API
- `src/components/features/admin/TestPanel.tsx` — Admin 🧪 테스트 탭

## 논문 활용 시

이 데이터는 다음 주제에 활용 가능:
- LLM 기반 여행 계획 시스템의 품질 보증 방법론
- 프롬프트 엔지니어링: 텍스트 vs JSON 구조화 효과 비교
- AI 출력의 방어적 후처리(defensive post-processing) 패턴
- 자동화된 AI 품질 테스트 파이프라인 설계
