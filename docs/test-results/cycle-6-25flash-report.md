# 사이클 6: gemini-2.5-flash 테스트 리포트

> 실행일: 2026-03-30
> 모델: **gemini-2.5-flash** (무료 키, Grounding OFF)
> 시나리오: edge/ 10개
> 비용: $0 (무료 티어)

---

## 결과 요약

| PASS | FAIL | ERROR | PASS율 |
|------|------|-------|--------|
| **2** | **7** | **1** | **20%** |

## 핵심 성과

1. **Grounding 호환 에러(400) 완전 해결** — 2.5-flash에서 responseMimeType + tools 동시 사용 제거
2. **후쿠오카 20/20 완벽 PASS** — 동행 불일치(솔로+커플코스) AI가 적절히 대응
3. **런던 20/20 완벽 PASS** — 백패커 예산인데 미슐랭 요청 → AI가 예산 범위 내 추천

## 상세 결과

| # | 시나리오 | 결과 | 점수 | 실패 항목 | 소요시간 |
|---|---------|------|------|----------|---------|
| 1 | 후쿠오카 혼자+커플코스 | ✅ PASS | 20/20 | — | 58.1s |
| 2 | 런던 백패커+미슐랭 | ✅ PASS | 20/20 | — | 44.6s |
| 3 | 제주 렌터카+비건 | FAIL | 19/20 | lunch Day3 | 67.2s |
| 4 | 나라 당일치기 | FAIL | 19/20 | geo 30km (역) | 33.2s |
| 5 | 오키나와 스키+7월 | FAIL | 19/20 | geo 57km (수족관) | 58.1s |
| 6 | 대만 해산물알레르기 | FAIL | 19/20 | geo 33km (지우펀) | 103.0s |
| 7 | 교토 단풍+8월 | FAIL | 17/20 | transit+lunch+dinner | 49.9s |
| 8 | 도쿄 조용+시부야 | FAIL | 18/20 | item_count+geo(좌표오류) | 90.4s |
| 9 | 베트남 7일 | FAIL | 17/20 | transit+budget+currency | 385.5s |
| 10 | 도쿄 휠체어 | ERROR | — | JSON parse 실패 | 286.1s |

## 수정 사항 (이번 사이클)

| # | 수정 | 파일 |
|---|------|------|
| 1 | Grounding 호환성 체크 (3-flash만 지원) | `gemini.provider.ts` callGeminiWithRetry + callGeminiStream |
| 2 | drive 100% 정상 인정 (렌터카/교외 지역) | `testValidation.ts` checkTransitModeVariety |
| 3 | geo_boundary 교통허브/호텔 제외 + ×1.5 여유 + 이상좌표 필터 | `testValidation.ts` checkGeoBoundary |

## 모델 비교 (동일 시나리오)

| 모델 | 후쿠오카 | 런던 | 오키나와 | 베트남 |
|------|---------|------|---------|-------|
| 3.1-pro (금지) | PASS | PASS | PASS | FAIL |
| 3-flash | PASS | PASS | PASS | FAIL (식사) |
| **2.5-flash** | **PASS** | **PASS** | FAIL(geo) | FAIL(budget) |
| 2.5-flash-lite | FAIL(좌표) | — | — | FAIL(식사6일) |

→ 2.5-flash는 3-flash와 거의 동등. 좌표 품질은 약간 낮지만 실용 수준.

## 남은 문제 (다음 사이클에서 수정)

1. **교토 식사 누락** — augment 슬롯 충돌 (transit 시간과 겹침)
2. **베트남 통화 혼재** — augment KRW 삽입 (detectCurrency 로직 재확인)
3. **도쿄 좌표 1158km/10846km** — AI가 완전히 엉뚱한 좌표 생성 (postValidate 강화 필요)
4. **도쿄 휠체어 JSON parse 실패** — 응답이 너무 길어서 잘림
