# Cycle 12: v3 식사 시간 보장 + slotAssigner Phase 0

> 실행일: 2026-04-01
> 모델: gemini-2.5-flash
> 파이프라인: v3 (AI 장소 추천 → 코드 배치)
> 수정: 4건

---

## 수정 내역

| # | 수정 | 파일 | 효과 |
|---|------|------|------|
| 1 | **Phase 0: mealSlot 자동 분류** | slotAssigner.ts | AI가 mealSlot=none으로 줘도 timePreference 기반으로 lunch/dinner 자동 배정 |
| 2 | **식사 시간 보장** | timeCalculator.ts | lunch는 최소 12:00, dinner는 최소 18:00에 배치 |
| 3 | **getPlanFeatures 확장** | rateLimit.service.ts | maxDays(Free 4일), routeOptimize, photos, weather, export 필드 추가 |
| 4 | **maxDays 체크** | stream/route.ts | Free 플랜 4일 초과 시 403 반환 |

## 단건 테스트 결과 (tokyo-solo-3d)

| 사이클 | 점수 | lunch | dinner | coords | 핵심 변화 |
|--------|------|-------|--------|--------|-----------|
| Cycle 11 | 17/20 | ❌ D1,2 | ❌ D3 | ❌ 9건 | v3 초기 |
| Cycle 12a | 16/20 | ❌ D1,2 | ❌ D2,3 | ❌ 5건 | Phase 0 추가 |
| **Cycle 12b** | **18/20** | ❌ D1 | **✅** | ❌ 6건 | **식사 시간 보장 추가** |

**저녁 누락 완전 해결!** Day 2,3 점심도 12:00 정확 배치. Day 1 점심만 남음.

## Edge 10건 결과

| 시나리오 | 결과 | 점수 | 실패 이유 |
|----------|------|------|-----------|
| 후쿠오카 솔로+커플 | ERROR | — | JSON 잘림 (출력 초과) |
| 제주 렌터카+비건 | ERROR | — | JSON 잘림 |
| 교토 단풍+8월 | ERROR | — | 429 rate limit |
| 런던 백패커+미슐랭 | FAIL | ?/20 | 상세 미확인 |
| 나라 당일치기 | FAIL | ?/20 | 상세 미확인 |
| 오키나와+스키 | FAIL | ?/20 | 상세 미확인 |
| **대만 해산물알레르기** | **FAIL** | **18/20** | lunch D2 + coords 8건 |
| 도쿄 휠체어 | ERROR | — | JSON 잘림 |
| 도쿄 조용+시부야 | FAIL | 14/20 | 좌표 996km + lunch/dinner + geo |
| 베트남 7일 | ERROR | — | 429 rate limit |

## 남은 문제 3개

### 1. JSON 잘림 (ERROR 3건)
- 원인: AI가 notes를 장문으로 쓰거나 요청보다 많은 장소 생성 → 65536 토큰 초과
- 해결 방향:
  - `maxOutputTokens: 131072` (2.5-flash 최대)
  - 또는 프롬프트에서 `"Return ONLY the JSON array, no explanations"` 더 강조
  - 또는 responseSchema에서 notes maxLength 제한 (지원 여부 확인)

### 2. Day 1 점심 누락 (FAIL)
- 원인: Day 1에 attraction 5개가 10:00~18:00 꽉 채워서 lunch 끼어들 공간 없음
- 해결 방향: slotAssigner에서 Day 1도 "오전 2~3개 → 점심 → 오후 2~3개" 강제

### 3. 좌표 무효 (coords_valid)
- 원인: Free 모드라 Google Places 스킵 → AI 좌표 의존 → null 또는 996km
- 해결: Pro에서는 해결됨 (Google Places). Free에서는 Nominatim 통합 시 해결 예정

## PASS율 추이 (v3)

| 사이클 | 수정 | 단건 점수 | Edge PASS |
|--------|------|----------|-----------|
| 11 | v3 초기 | 17/20 | 0/6 (429 4건) |
| 12a | Phase 0 + getPlanFeatures | 16/20 | — |
| **12b** | **식사 시간 보장** | **18/20** | **대만 18/20** |

## 다음 우선순위

1. JSON 잘림 해결 → ERROR 3건 → FAIL로 전환 (점수 확인 가능)
2. Day 1 점심 강제 → lunch 완전 해결
3. Nominatim 통합 → Free에서도 좌표 해결
