# AI 일정 생성 v2 아키텍처 계획

> 작성일: 2026-03-31
> 상태: **구현 완료 + Route 통합 완료, 테스트 대기**
> 코드 리뷰: 완료 (7건 발견, 3건 수정, 2건 의도적 설계, 2건 minor)
> 관련: `docs/test-results/CHANGELOG-AI-IMPROVEMENTS.md` (v1 전체 이력)

---

## 1. 문제 정의

### 현재 PASS율 (v1, 8사이클 80+건)
```
사이클1: 0% → 2: 10% → 3: 20% → 4: 60% → 5: 80%(3건) → 6: 40% → 7: 0% → 8: 40%
```
- 모델 바꿀 때마다 리셋
- 같은 모델이어도 들쑥날쑥
- **안정적이지 않다**

### 근본 원인 3개
1. **AI에게 전체 일정을 한 번에 맡기는 구조** → 실패 시 augment로 땜질 → 새 버그 생성
2. **거리/시간을 AI가 추정** → "subway 7min" (실제 2시간) 같은 비현실적 결과
3. **모델 품질에 지나치게 의존** → 모델 바꾸면 검증 결과도 완전히 달라짐

---

## 2. 참고 연구 & 시스템

| 시스템 | 핵심 아이디어 | 성과 | 우리에게 적용 |
|--------|-------------|------|-------------|
| **MIT LLM+SMT Solver** (NAACL 2025) | LLM이 자연어 → 수학적 제약 추출, SMT Solver가 검증 | 93.9% 성공률 | 시간/거리 제약을 코드로 검증 |
| **ItiNera** (EMNLP 2024 Best Paper) | LLM은 설명만, 순서/거리는 전부 알고리즘 | 컨텍스트 윈도우 한계 극복 | 경로 최적화를 코드에서 처리 |
| **MIRROR** (IJCAI 2025) | 자기 검증 + 부분 재생성 | +14~21%p 개선 | validateDay → repairDay 루프 |
| **BudgetMLAgent** (2024) | 무료 모델 우선 + cascade | 94.2% 비용 절감 | 플랜별 모델 차등 |

### 핵심 교훈
> "LLM은 창의적 추천에 쓰고, 정확성은 코드가 보장한다"
> — ItiNera (EMNLP 2024)

---

## 3. v2 파이프라인 설계

### 현재 (v1) — "한 번에 전체 생성 → 후처리"
```
[Gemini 1회 호출] → 전체 일정 JSON
    ↓
[후처리 6단계] → postValidate → closedDays → geo → optimize → transit → augment
    ↓
[저장]
```

### 신규 (v2) — "하루 단위 생성 + 즉시 검증 + 부분 재생성"
```
for each day (1..N):
    ① [Gemini] → Day N 생성 (이전 날 결과 + 남은 예산 전달)
    ② [코드 검증] → 식사 있나? 시간 겹치나? 지리 맞나? 예산 초과?
    ③ 실패 항목 있으면 → [Gemini 부분 재요청]
       "Day 2에 저녁이 없다. 18:00~20:00에 레스토랑 1개 추가해라"
    ④ [코드 재검증] → PASS면 다음 날, FAIL이면 augment fallback
[전체 검증] → 날짜 간 중복, 전체 예산, 전체 경로 최적화
```

### API 호출 비교

| | v1 (현재) | v2 (신규) |
|---|----------|----------|
| 3일 여행 | 1회 (전체) | 3회 (하루씩) + 1~2회 (부분 재생성) |
| 7일 여행 | 7회 (하루씩, 검증 없음) | 7회 + 2~3회 (부분 재생성) |
| 비용 증가 | — | +30~50% |
| 품질 | 불안정 (0~80%) | **안정적 (70~85% 예상)** |

부분 재생성은 작은 프롬프트 (기존 아이템 + "저녁 추가해라") → 토큰 적음 → 비용 미미.

---

## 4. 구현 스텝 (5단계)

### Step 1: 하루 단위 생성 + 날마다 검증
- **파일**: `gemini.provider.ts`, `itineraryValidation.ts`
- **변경**: ≤4일도 날마다 호출, 각 날 후 `validateDay()` 실행
- **신규 함수**: `validateDay()` — 식사/시간/아이템수/도착시간 체크
- **신규 함수**: `repairDay()` — 실패 항목만 Gemini에 재요청

### Step 2: responseSchema 제약 강화
- **파일**: `gemini.provider.ts` (ITEM_SCHEMA)
- **변경**: `estimatedCost: minimum 0`, `transitDurationMin: max 480`, `dayNumber: min 1`
- **참고**: Gemini responseSchema의 min/max/pattern 지원 여부 확인 필요

### Step 3: Google Directions API 이동시간
- **파일**: `googleDirections.service.ts` (신규), `itineraryValidation.ts`
- **변경**: AI 추정 대신 실제 이동시간 계산 → startTime 자동 조정
- **비용**: $0.005/회 × 4회/일 = $0.02/일 (Pro/Team만)
- **캐시**: 같은 출발-도착 1시간 캐시

### Step 4: 플랜별 기능 차등
- **파일**: `rateLimit.service.ts`, 각 API route
- **Free**: flash-lite, Places 스킵, Directions 스킵, repair 0회, 월 2회
- **Pro**: 2.5-flash, Places ✅, Directions ✅, repair 1회, 월 15회
- **Team**: 2.5-flash, Places ✅, Directions ✅, repair 2회, 무제한

### Step 5: augmentMissingMeals 버그 수정 3건
- 시간 겹침: findFreeSlot이 기존 일정 체크 안 함
- 통화 KRW 고정: 기존 아이템 최빈 통화 감지
- 좌표 null 전파: 같은 날 유효 좌표 탐색

---

## 5. 수정 대상 파일 (8개)

| 파일 | 변경 | 난이도 |
|------|------|--------|
| `src/lib/services/ai/gemini.provider.ts` | 날마다 생성+검증+repair 루프 | 🔴 높음 |
| `src/lib/services/ai/itineraryValidation.ts` | validateDay, augment 버그 3건 | 🟡 중간 |
| `src/lib/services/ai/prompt.ts` | repairDay용 부분 재생성 프롬프트 | 🟢 낮음 |
| `src/lib/services/googleDirections.service.ts` | 신규 — Directions API | 🟡 중간 |
| `src/lib/services/rateLimit.service.ts` | getPlanFeatures() | 🟢 낮음 |
| `src/app/api/v1/ai/generate/stream/route.ts` | v2 파이프라인 통합 | 🟡 중간 |
| `src/app/api/v1/admin/test-generate/route.ts` | v2 파이프라인 통합 | 🟢 낮음 |
| `CLAUDE.md` | 비용 규칙 + 플랜별 차등 | 🟢 낮음 |

---

## 6. 비용 분석

### 하루당 비용

| | Free | Pro | Team |
|---|------|-----|------|
| AI 생성 (1일분) | ₩5 (flash-lite) | ₩7 (2.5-flash) | ₩7 |
| 부분 재생성 | ₩0 (없음) | ₩3 (1회) | ₩6 (2회) |
| Places 검증 | ₩0 (스킵) | ₩170 (4회) | ₩170 |
| Directions | ₩0 (스킵) | ₩27 (4회) | ₩27 |
| **일당 합계** | **₩5** | **₩207** | **₩210** |
| **4일 여행** | **₩20** | **₩828** | **₩840** |

### 월간 손익 (MAU 1,000명, Free 90% / Pro 8% / Team 2%)

```
Free  900명 × 2회 × ₩20  =    ₩36,000 비용 / ₩0 수익
Pro    80명 × 7회 × ₩828 =   ₩462,720 비용 / ₩792,000 수익
Team   20명 × 15회 × ₩840 =  ₩252,000 비용 / ₩598,000 수익
────────────────────────────────────────
총 비용:  ₩750,720
총 수익: ₩1,390,000
순이익:  ₩639,280/월 (흑자)
```

---

## 7. 검증 계획

| # | 테스트 | 성공 기준 |
|---|--------|----------|
| 1 | 단건 (tokyo-solo-3d) | 20/20 PASS |
| 2 | edge 10개 (순차, 15초 딜레이) | PASS율 70%+ |
| 3 | 모델 교체 (flash-lite) 같은 시나리오 | PASS율 하락 10%p 이내 |
| 4 | 비용 확인 | Google Cloud Console에서 Directions 호출 수 |
| 5 | 결과 문서화 | `docs/test-results/cycle-9-v2-report.md` |

---

## 8. 예상 효과

| 지표 | v1 (현재) | v2 (목표) | 근거 |
|------|----------|----------|------|
| PASS율 (2.5-flash) | 40% 불안정 | **70~85% 안정** | 날마다 검증 + repair |
| PASS율 (flash-lite) | 0~20% | **50~60%** | 모델 약해도 검증이 잡음 |
| 식사 누락 | 30% | **0%** | validate → repair → augment 3중 |
| 시간 버그 | 5% | **0%** | toHHMM + 클램프 |
| transit 정확도 | 30% | **90%+ (Pro)** | Directions API |
| 비용/건 (Free) | ₩840 | **₩20** | flash-lite + 스킵 |
| 비용/건 (Pro) | ₩840 | **₩828** | 미미한 차이 |
| 모델 교체 안정성 | 리셋됨 | **10%p 이내** | 코드 검증이 주도 |
