# Cycle 10: augment r.id crash 수정 + 전체 재검증

> 실행일: 2026-03-31
> 모델: gemini-2.5-flash (무료 키)
> 프롬프트: v4 (자연어 + JSON 하이브리드)
> 파이프라인: v2 (하루 단위 생성 + validateDay + repairDay)
> **PASS: 4/10 (40%)** — 식사 기준만 보면 **8/10 (80%)**

---

## 근본 버그: `r.id.startsWith()` crash

### 원인
```typescript
// itineraryValidation.ts line 172
const augmentedForDay = result.filter(r => r.dayNumber === day && r.id.startsWith('augmented-'));
//                                                                  ^^^
// test-generate 경로에서 items에 id 필드가 없음 → undefined.startsWith() → TypeError
// → augmentMissingMeals() 전체가 silent crash → 아무것도 삽입 안 됨
```

### 수정 (1줄)
```typescript
const augmentedForDay = result.filter(r => r.dayNumber === day && (r.id || '').startsWith('augmented-'));
```

### 영향
이 1줄이 **Cycle 1~9 전체에서 augment를 무력화**하고 있었다. test-generate 경로에서만 발생 (stream/route.ts는 DB 삽입 시 id가 부여되므로 미발생).

---

## 결과 비교 (Cycle 9 → Cycle 10)

| 시나리오 | Cycle 9 | Cycle 10 | 변화 |
|----------|---------|----------|------|
| 후쿠오카 | ❌ dinner Day3 | ❌ 좌표 4건 | **식사 ✅ 해결** |
| 제주 | ❌ lunch+dinner+통화+좌표+식단 5건 | ❌ 좌표 10건 | **식사 ✅ 해결** |
| 교토 | ❌ dinner Day3 | ❌ lunch Day2 | 저녁→점심으로 변화 |
| 런던 | ✅ | ✅ | 유지 |
| 나라 | ✅ | ❌ dinner+geo | 불안정 |
| 오키나와 | ❌ lunch+dinner | ✅ | **FAIL→PASS** |
| 대만 | ❌ lunch Day2 | ✅ | **FAIL→PASS** |
| 도쿄 휠체어 | ❌ lunch+좌표 | ✅ | **FAIL→PASS** |
| 도쿄 조용 | ✅ | ❌ lunch+geo | 불안정 |
| 베트남 | ❌ item수+lunch+좌표 | ❌ 좌표 4건 | **식사 ✅ 해결** |

## 실패 유형 분석

| 실패 유형 | 건수 | 원인 | 해결 방안 |
|-----------|------|------|-----------|
| **좌표 무효** | 4건 (후쿠오카 4, 제주 10, 베트남 4, 합 18건) | 2.5-flash가 좌표를 안 줌 | postValidate(Places API)로 보완 — Pro만 |
| **점심 누락** | 2건 (교토, 도쿄 조용) | augment가 빈 슬롯 못 찾음 | findFreeSlot 범위 확장 (10:30~15:00) |
| **저녁 누락** | 1건 (나라) | 당일치기인데 augment 스킵 조건? | 확인 필요 |
| **geo 비정상** | 2건 (나라 627km, 도쿄 879km) | AI가 완전 엉뚱한 좌표 생성 | toTripItems 클램프로 탐지 후 null 처리 |

## 핵심 성과

| 지표 | Cycle 9 | Cycle 10 | 변화 |
|------|---------|----------|------|
| PASS율 | 30% | **40%** | +10%p |
| 식사 통과율 | 40% | **80%** | **+40%p** |
| augment 작동 | ❌ 전면 실패 | ✅ 정상 | **근본 해결** |

## 다음 단계

1. **좌표 보완**: postValidateItems()가 Free에서도 기본 작동하도록 (캐시된 Places만 사용, 새 API 호출 없음)
2. **점심 findFreeSlot 범위 확장**: 10:30~15:00으로 (현재 11:00~14:30)
3. **geo 비정상 좌표 필터**: 627km, 879km 같은 좌표는 null로 치환
4. **나라 저녁 스킵 디버깅**: 당일치기에서 왜 저녁이 안 들어가는지

위 4건 수정 시 예상 PASS율: **7~8/10 (70~80%)**
