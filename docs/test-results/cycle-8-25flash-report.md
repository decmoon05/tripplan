# 사이클 8: gemini-2.5-flash 테스트 + 수정

> 실행일: 2026-03-31
> 모델: gemini-2.5-flash (무료 키)
> 시나리오: edge 10개 (순차, 15초 딜레이)

---

## 결과: 4/10 PASS (40%)

| # | 시나리오 | 결과 | 시간 | 실패 원인 |
|---|---------|------|------|----------|
| 1 | 후쿠오카 솔로+커플코스 | ✅ PASS | 83s | — |
| 2 | 제주 렌터카+비건 | ❌ FAIL | 57s | 렌터카 비용 아이템 0분 (duration) |
| 3 | 교토 단풍+8월 | ❌ ERROR | 252s | JSON 파싱 실패 (126KB 잘림) |
| 4 | 런던 백패커+미슐랭 | ✅ PASS | 47s | — |
| 5 | 나라 당일치기 | ✅ PASS | 31s | — |
| 6 | 오키나와+스키 | ❌ FAIL | 45s | augment 시간 충돌 + intercity |
| 7 | 대만 해산물알레르기 | ✅ PASS | 78s | — |
| 8 | 도쿄 휠체어 | ❌ ERROR | 241s | JSON 파싱 실패 (105KB 잘림) |
| 9 | 도쿄 조용+시부야 | ❌ FAIL | 51s | augment 포함 5.3개/일 (상한 5.25) |
| 10 | 베트남 7일 | ❌ FAIL | 207s | augment 시간 충돌 |

---

## 실패 원인 분석

### 반복 패턴 3가지

| 패턴 | 건수 | 원인 | 수정 |
|------|------|------|------|
| **augment 시간 충돌** | 3건 | 점심 추가 후 allDayItems에 미반영 → 저녁이 점심과 겹침 | `allDayItems.push()` 추가 |
| **JSON 잘림** | 2건 | maxOutputTokens 미설정 → 기본 8192 토큰 | `maxOutputTokens: 32768` 명시 |
| **augment 카운트 포함** | 1건 | augment 식사가 아이템 수에 포함 → 상한 초과 | augment 아이템 카운트 제외 |

---

## 코드 수정 3건

| # | 파일 | 수정 |
|---|------|------|
| 1 | `itineraryValidation.ts` | augment 점심 추가 후 `allDayItems.push()` → 저녁 슬롯이 점심과 안 겹침 |
| 2 | `gemini.provider.ts` | `maxOutputTokens: 32768` 추가 (non-streaming + streaming 모두) |
| 3 | `testValidation.ts` | item_count_matches_pace에서 augment 아이템("현지 점심/저녁 식당") 제외 |

---

## 모델 비교 (동일 edge 10 시나리오)

| 모델 | PASS | 비용 | 비고 |
|------|------|------|------|
| gemini-3.1-pro-preview | ~80% | $1.50/건 | 🚫 금지 |
| gemini-3-flash-preview | ~80% | 무료 | RPM 제한 |
| **gemini-2.5-flash** | **40%** | **무료** | 현재 — 수정 후 재테스트 필요 |
| gemini-2.5-flash-lite | ~10% | 무료 | 좌표 품질 너무 낮음 |

---

## 예상 PASS율 (수정 후)

수정으로 해결되는 3건: 오키나와(시간충돌), 도쿄조용(카운트), 베트남(시간충돌)
JSON 잘림 2건: maxOutputTokens 32K로 해결 예상
제주 duration 0분: 이건 AI가 "비용 아이템"을 넣은 건데, 검증에서 비활동 아이템 허용 필요

→ **수정 후 예상: 7~8/10 PASS (70~80%)**

---

## 누적 통계

| 사이클 | 모델 | PASS율 | 핵심 수정 |
|--------|------|--------|----------|
| 1~3 | 3.1-pro | 0~20% | 프롬프트/검증 기반 |
| 4~5 | 3-flash | 60~80% | JSON 하이브리드 + augment |
| 6 | 2.5-flash | 20% | Grounding 호환 수정 |
| 7 | flash-lite | 10% | 모델 품질 부적합 확인 |
| **8** | **2.5-flash** | **40%** | augment 시간충돌 + maxOutputTokens + 카운트 |
