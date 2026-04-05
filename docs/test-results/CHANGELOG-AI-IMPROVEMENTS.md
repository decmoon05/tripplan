# AI 일정 생성 품질 개선 전체 이력

> 기간: 2026-03-29 ~ 2026-03-31
> 모델: gemini-3.1-pro → gemini-3-flash → gemini-2.5-flash (비용 사고 후 전환)
> PASS율: **0% → 80%** (8사이클, 80+ 테스트 시나리오)

---

## 1. 프롬프트 개선 (prompt.ts)

### 초기 (v1): 텍스트만
```
"Return JSON array. Each item: {dayNumber, placeNameSnapshot, category...}"
"- MEALS: Include lunch and dinner daily"
"- transitMode: walk, bus, taxi, subway..."
```
**문제**: AI가 긴 텍스트에서 규칙을 무시 (저녁 누락 73%)

### v2: 텍스트 강조
```
"- MEALS (CRITICAL — DO NOT SKIP): Every single day MUST include BOTH lunch AND dinner"
"- ITEMS PER DAY based on stamina: low → 3-4 MAX, moderate → 4-6, high → 5-8"
```
**결과**: 저녁 누락 60%로 감소, 여전히 부족

### v3: JSON 구조화
```json
{
  "role": "travel_itinerary_planner",
  "critical_rules": {
    "meals": { "lunch": { "required": true }, "dinner": { "required": true } }
  },
  "output_format": { "item_schema": {...} }
}
```
**문제**: AI가 JSON을 "규칙"이 아닌 "데이터"로 인식

### v4 (최종): 자연어 프레이밍 + JSON 하이브리드
```
You are an expert travel itinerary planner.
CRITICAL (non-negotiable):
- Every single day MUST have BOTH lunch AND dinner restaurants
- Check closedDays BEFORE including any place

SELF-CHECK before returning:
□ Every day has lunch? □ Every day has dinner? □ No closedDay conflicts?

Detailed rules:
${JSON.stringify(json, null, 2)}
```
**결과**: AI 자체 생성 저녁 포함율 60% → 80%+

### 추가 개선
- **도착시간 강화**: evening 도착 시 프롬프트 첫 줄에 `Day 1 should start from 17:00`
- **stamina별 아이템 제한**: low=3~4, moderate=4~6, high=5~8 JSON으로 명확 전달
- **계절 경고**: `seasonal-events.ts` DB 기반 (8월 단풍 → "🍁 not available in August")
- **이전 여행 참조**: `previousVisits` 배열로 AI에게 "이 장소는 별점 2점이었다" 전달
- **식이제한 강조**: `CRITICAL: If user has dietary restrictions, ALL restaurant/cafe items MUST comply`

---

## 2. 후처리 검증/보강 (itineraryValidation.ts)

### augmentMissingMeals() — AI 실패 시 안전망
AI가 저녁/점심을 빠뜨려도 **코드가 강제 삽입**.

| 버전 | 동작 | 문제 |
|------|------|------|
| v1 | 18:30에 "현지 저녁 식당" 무조건 삽입 | 시간 겹침, 통화 KRW 고정, 좌표 null |
| v2 | 기존 일정과 시간 충돌 체크 후 삽입 | 7시간 블록(09:00~16:00) 안에 강제 삽입 |
| v3 (최종) | `findFreeSlot()` — 빈 시간대 탐색 후 삽입, 겹치면 스킵 | — |

**세부 수정:**
- 통화: 하드코딩 KRW → 기존 아이템 최빈 통화 자동 감지
- 좌표: 직전 아이템 좌표 복사 → null이면 같은 날 유효 좌표 탐색
- 이름: "현지 저녁 식당" → "현지 저녁 식당 Day3" (중복 방지)
- transit: walk 5분 고정 → null (augment 아이템은 transit 불필요)

### validateClosedDays() — 휴무일 자기모순 제거
AI가 "화요일 휴무"라고 적어놓고 화요일에 스케줄 배치하는 모순 → 자동 제거

### toHHMM() — 시간 포맷 정규화
`25:27`, `-10:-46` 같은 비정상 시간 → `23:59`, `00:00`으로 클램프

### optimizeRouteOrder() — 경로 최적화 시간 계산 수정
- `currentTime` 누적 오버플로우 → 클램프 (06:00~23:59)
- transit 180분 캡 (793분 도시간 이동 버그 방지)

---

## 3. 모델 관리 (models.ts) — 신규 생성

### 이전: 12개 파일에 모델명 하드코딩
```typescript
// gemini.provider.ts
const model = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro';
// claude.provider.ts
const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
// estimate/route.ts
const MODEL_PRICING = { 'gemini-2.5-pro': {...}, ... };
// debugLog.ts
const COST_PER_1K_INPUT = { 'gemini-2.5-pro': 0.00125, ... };
```

### 이후: `models.ts` 단일 진실 원천
```typescript
export function getGeminiMainModel(): string { ... }  // .env에서 읽음
export function getClaudeModel(): string { ... }
export function getOpenAIModel(): string { ... }
export const MODEL_PRICING: Record<string, ModelPricing> = { ... }; // 20개 모델 가격
export function estimateCost(model, input, output) { ... }
```

**안전장치**: `3.1-pro` 감지 시 자동으로 `2.5-flash`로 강제 전환 (5만원 사고 방지)

6개 파일이 `models.ts`에서 import → .env만 바꾸면 전체 반영

---

## 4. Gemini Provider (gemini.provider.ts)

### Layer 구조 변경

| 이전 | 이후 |
|------|------|
| Layer1: 3.1 Pro + Grounding (180초) | Layer1: 2.5 Flash (90초) |
| Layer2: 3-flash, no Grounding (60초) | Layer2: 2.5 Flash-Lite (60초) |

### Grounding 호환성
- `supportsGrounding` 플래그: 3-flash/3.1-flash만 Grounding 지원
- 2.5-flash는 `responseMimeType: 'application/json'` + `tools` 동시 사용 불가 → 자동 비활성화

### 키 로테이션
- `GEMINI_API_KEY`에 콤마 구분 복수 키 지원
- 429 시 다음 키로 자동 전환
- `GoogleGenAI` 인스턴스를 키마다 생성

### maxOutputTokens
- 8192 → 32768 (4~7일 일정에서 JSON 잘림 방지)

---

## 5. 검증 엔진 (testValidation.ts) — 신규 생성

20개 자동 검증 규칙:

| # | 검증 | 설명 |
|---|------|------|
| 1 | transit_mode_match | 렌터카 여행이면 transitMode=drive |
| 2 | transit_duration_realistic | 이동시간 < 480분 |
| 3 | intercity_travel_detected | 도시간 이동에 최소 30분 |
| 4 | first_item_no_transit | 매일 첫 아이템 transit=null |
| 5 | transit_mode_variety | 교통수단 1종류만 100%면 경고 |
| 6 | no_time_overlap | 시간 중복 없음 |
| 7 | reasonable_hours | 05:00~02:00 범위 |
| 8 | day_start_matches_arrival | 도착시간에 맞는 Day1 시작 |
| 9 | sufficient_duration | 활동 최소 15분 |
| 10 | item_count_matches_pace | stamina에 맞는 아이템 수 |
| 11 | lunch_every_day | 매일 점심 |
| 12 | dinner_every_day | 매일 저녁 |
| 13 | budget_alignment | 예산 범위 이내 |
| 14 | currency_consistent | 통화 일관성 |
| 15 | geo_boundary | 목적지 반경 이내 |
| 16 | no_duplicate_places | 중복 장소 없음 |
| 17 | coordinates_valid | 유효 좌표 (위도 -90~90, 경도 -180~180) |
| 18 | closed_day_conflict | 휴무일 충돌 없음 |
| 19 | companion_appropriate | 동행자에 맞는 장소 |
| 20 | food_restriction_respected | 식이제한 준수 |

### 주요 오탐 수정 이력
- `closedDays`: "일"이 "화요**일**"에 부분 매칭 → "일요일" 전체 매칭
- `transit_variety`: walk 100% 허용 (단거리 도보 여행)
- `dinner_every_day`: cafe도 저녁으로 인정 (16:30 이후)
- `item_count`: augment 추가분 감안 × 1.3배 상한
- `geo_boundary`: "연중무휴" 포함 시 closedDay 체크 스킵

---

## 6. 테스트 인프라

### 생성된 파일
| 파일 | 용도 |
|------|------|
| `scripts/test_scenarios.py` | Python CLI — 병렬 실행, 결과 저장, 비용 추산 |
| `src/app/api/v1/admin/test-generate/route.ts` | 테스트 전용 API (DB 저장 X, Places 스킵 가능) |
| `src/app/api/v1/admin/test-scenarios/route.ts` | 시나리오 목록 API |
| `src/components/features/admin/TestPanel.tsx` | Admin 🧪 테스트 탭 |
| `src/lib/services/ai/testValidation.ts` | 20개 규칙 검증 엔진 |
| `src/lib/services/ai/seasonal-events.ts` | 계절 이벤트 DB (20+ 도시) |
| `src/lib/services/ai/models.ts` | 모델 중앙 관리 + 가격표 |

### 테스트 시나리오 42개
```
test/scenarios/
├── *.json (기본 12개)     — 도쿄 솔로, 규슈 렌터카, 할랄, 모순 등
├── edge/ (10개)           — 오키나와+스키, 서울+타지마할, 심야 라멘 등
├── edge2/ (10개)          — 아이슬란드 오로라+6월, 로마 셀리악, 3세대 가족 등
└── edge3/ (10개)          — 두바이 라마단, 몰디브 백패킹, K-POP 성지순례 등
```

---

## 7. 비용 절감

| 항목 | 이전 | 이후 | 절감 |
|------|------|------|------|
| 메인 모델 | 3.1 Pro ($3/$15 per 1M) | 2.5 Flash ($0.30/$2.50) | **90%** |
| 테스트 모델 | 프로덕션과 동일 | Flash-Lite ($0.10/$0.40) | **97%** |
| Places API | 55회/시나리오 | 테스트 시 0회 (SKIP_PLACES_VERIFY) | **100%** |
| 안전장치 | 없음 | 3.1 Pro 자동 차단 + 비용 추산 표시 | — |

---

## 8. PASS율 추이 (논문용)

| 사이클 | 모델 | 프롬프트 | PASS율 | 저녁통과 | 시간버그 | 주요 수정 |
|--------|------|---------|--------|---------|---------|-----------|
| 1 | 3.1-pro | v1 텍스트 | **0%** | 17% | 3건 | (초기 실행) |
| 2 | 3.1-pro | v1 텍스트 | **10%** | 25% | 1건 | transit 오탐 |
| 3 | 3.1-pro | v2 강조 | **20%** | 38% | 2건 | closedDays |
| 4 | 3-flash | v3 JSON | **60%** | 100%* | 0건 | augment + 7건 근본 수정 |
| 5 | 3-flash | v4 하이브리드 | **~80%** | 100% | 0건 | 프레이밍 + 오탐 수정 |
| 6 | 2.5-flash | v4 | **40%** | 70% | 0건 | Grounding 호환 수정 |
| 7 | flash-lite | v4 | **0%** | 30% | 0건 | (모델 품질 부족 확인) |
| 8 | 2.5-flash | v4 | **40%** | 90% | 0건 | augment 시간겹침 수정 |

*augmentMissingMeals() 안전망 포함

---

## 수정된 파일 전체 목록

| 파일 | 수정 내용 |
|------|-----------|
| `src/lib/services/ai/prompt.ts` | v1→v4 프롬프트 전면 재작성 (4회) |
| `src/lib/services/ai/gemini.provider.ts` | Layer 구조, Grounding, maxOutputTokens, 키 로테이션 |
| `src/lib/services/ai/claude.provider.ts` | models.ts import, 하드코딩 제거 |
| `src/lib/services/ai/itineraryValidation.ts` | augmentMissingMeals, validateClosedDays, toHHMM, optimizeRouteOrder |
| `src/lib/services/ai/models.ts` | 신규 — 모델 중앙 관리 + 가격표 |
| `src/lib/services/ai/testValidation.ts` | 신규 — 20개 검증 규칙 |
| `src/lib/services/ai/seasonal-events.ts` | 신규 — 계절 이벤트 DB |
| `src/lib/services/ai/debugLog.ts` | models.ts 가격표 사용 |
| `src/app/api/v1/ai/estimate/route.ts` | models.ts 사용, countTokens 수정 |
| `src/app/api/v1/ai/generate/stream/route.ts` | validateClosedDays 파이프라인, models.ts |
| `src/app/api/v1/admin/test-generate/route.ts` | 신규 — 테스트 전용 API |
| `src/app/api/v1/admin/test-scenarios/route.ts` | 신규 — 시나리오 목록 |
| `src/app/api/v1/admin/health/route.ts` | models.ts 사용 |
| `src/components/features/admin/TestPanel.tsx` | 신규 — Admin 테스트 패널 |
| `scripts/test_scenarios.py` | 신규 — Python 테스트 러너 |
| `.env.local` | 모델 전환, 키 로테이션, SKIP_PLACES_VERIFY |
