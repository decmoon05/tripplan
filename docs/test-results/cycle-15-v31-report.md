# v3.1 Cycle 14~15: 데이터 인프라 구축 + restaurantResolver

> 실행일: 2026-04-02
> 모델: gemini-2.5-flash
> 파이프라인: v3.1

---

## v3.1에서 추가된 인프라

| 컴포넌트 | 역할 | 비용 |
|----------|------|------|
| **Geoapify** (신규) | 좌표 검색 (5req/sec, Nominatim 대비 5배 빠름) | $0 (3000건/일) |
| **Nominatim** (fallback) | Geoapify 실패 시 좌표 검색 | $0 |
| **Overpass** (개선) | 영업시간 + 2개씩 병렬 처리 | $0 |
| **OSRM** (개선) | 이동시간 (5초 타임아웃) | $0 |
| **osm-hours-parser** (신규) | "Mo-Fr 09:00-18:00" → "월~금 09:00-18:00" + closedDays | — |
| **concurrency.ts** (신규) | batchedConcurrency 유틸 | — |
| **restaurantResolver** (신규) | 좌표 null 식당 → Overpass로 실제 식당 교체 | $0 |

## Cycle 14 결과 (restaurantResolver 적용)

| 시나리오 | 점수 | 실패 |
|----------|------|------|
| 후쿠오카 | 18/20 | lunch, coords |
| 제주 | 18/20 | lunch, coords |
| 교토 | 18/20 | lunch, coords |
| **런던** | **19/20** | lunch만 |
| 나라 | ERROR | 504 타임아웃 |
| 오키나와 | 18/20 | lunch, dinner |
| 대만 | 18/20 | lunch, coords |
| 도쿄 휠체어 | ERROR | 429 |
| 도쿄 조용 | 18/20 | lunch, coords |
| 베트남 | 16/20 | dur, lunch, dinner, coords |

**coords_valid 대폭 개선!** restaurantResolver 효과 — 대부분 1~2건만 남음.

## Cycle 15 결과 (Phase 5.5 식사 강제 삽입 — 실패)

Phase 5.5에서 placeholder 식당 강제 삽입 → **역효과** (런던 19→16):
- placeholder에 좌표 null → coords_valid 추가 실패
- sufficient_duration 실패 (시간 계산 후 30분 미만)
- 관광지 삭제로 일정 품질 하락

→ **Phase 5.5 제거**. 대신 slotAssigner fallback에서 **휴무일 무시** 옵션 추가.

## 근본 원인 분석: lunch 누락

```
Phase 1: AI가 restaurant 7개 생성 (7일 기준)
Phase 0: mealSlot 자동 분류 → lunch 3, dinner 4 등
Phase 3: checkMealShortage → "충분" 판단 (총 수만 봄)
Phase 4: findBestMeal(lunches, day, used, isOpenOnDay)
  → Day 3에 배정할 lunch가 없음 (2개는 이미 Day 1,2에 사용, 나머지는 휴무)
  → fallback: 아무 restaurant → 역시 isOpenOnDay 체크에서 탈락
  → lunch 없이 배정 완료
```

**수정**: fallback에서 휴무일 체크 제거 → 식사는 반드시 배정 (2차 fallback)

## 현재 상태 (v3.1)

| 지표 | v3 초기 | v3.1 |
|------|---------|------|
| 좌표 확보율 | 0% (전부 null) | **80%+** (Geoapify+Nominatim) |
| coords_valid 실패 | 8~48건/시나리오 | **1~2건** |
| 영업시간 확보율 | 0% | **~30%** (Overpass) |
| closedDays 변환 | raw string | **한국어 "일요일"** |
| 식사 누락 | 모든 시나리오 | **일부 시나리오만** |
| PASS율 | 0% | **아직 0%** (lunch가 마지막 보스) |

## 다음 수정 (적용 완료, 테스트 필요)

1. ~~Phase 5.5 제거~~ ✅
2. slotAssigner fallback: 휴무일 무시 2차 fallback ✅
3. 프롬프트: 실존 상호명 강제 ✅
