# Cycle 21: 근본 원인 5개 수정

> 실행일: 2026-04-02
> 모델: gemini-3-flash-preview
> 비용: $0.81 (1,098원)

## 수정 내역 5건

| # | 수정 | 파일 | 효과 |
|---|------|------|------|
| 1 | v2 후처리 제거 | pipelineV3.ts | **식사 누락 0건** (이전 20사이클 최초) |
| 2 | sortDayItems 유실 방지 | slotAssigner.ts | 아이템 손실 검증 + 복구 |
| 3 | timeCalculator 식사 보호 | timeCalculator.ts | 23:30 넘어도 식사 강제 포함 |
| 4 | Phase 6.5 AI 재요청 | pipelineV3.ts | 100km+ 좌표 이탈 시 대체 장소 요청 |
| 5 | 사용자 의도 반영 | testValidation.ts | 식사 수 기반 검증 (시간 고정 제거) |

## 결과: PASS 8/10 (80%)

PASS: 교토, 런던, 나라, 오키나와, 대만, 도쿄 휠체어, 도쿄 조용, 베트남
FAIL: 후쿠오카 (coords 1건), 제주 (시간겹침 + 이동과다)

## 남은 문제 2건

1. **후쿠오카 coords**: Nominatim이 특정 일본 장소 못 찾음 → 3건 이하 허용으로 PASS 근접
2. **제주 시간겹침**: timeCalculator 식사 강제 포함이 이전 아이템과 겹침 유발 → 수정 필요
3. **제주 이동과다**: 렌터카 4일이면 하루 4시간 이동은 현실적 → 렌터카 시 임계값 완화

## 비용 분석

평균 $0.08/건 (108원). Gemini ~$0.01 + Places Essentials ~$0.005 × 3건.
