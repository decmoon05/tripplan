# 장소 경험 카드 + 환율 표시 계획서

> 작성일: 2026-03-10

## 기능 1: 장소 경험 카드 (여행 생성 전 선택)

### 개요
여행 계획 생성 전, 목적지의 인기 장소들을 카드 형식으로 보여주고 사용자가 경험을 선택:
- "가봐서 안갈래요" (exclude) — AI가 이 장소를 제외
- "가봤는데 또갈래요" (revisit) — AI가 이 장소를 포함
- "안가봤어요" (new) — AI 판단에 맡김 (기본값)

### DB 설계
```sql
CREATE TABLE user_place_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination text NOT NULL,          -- 도시명 (예: "오사카", "도쿄")
  place_name text NOT NULL,           -- 장소명
  preference text NOT NULL CHECK (preference IN ('exclude', 'revisit', 'new')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, destination, place_name)
);
```

### 흐름
1. 사용자가 목적지 + 날짜 입력
2. **[NEW]** AI에게 "목적지 인기 장소 15~20개 리스트" 요청 (간단한 API 호출)
3. **[NEW]** 카드 UI로 장소 리스트 표시 → 사용자가 경험 선택
4. 선택 결과를 DB에 저장 (다음 여행에도 재사용)
5. AI 일정 생성 시 경험 데이터를 프롬프트에 포함

### 수정 파일
- `supabase/migrations/` — 새 테이블
- `src/types/database.ts` — UserPlacePreference 타입
- `src/lib/services/placePreference.service.ts` — CRUD
- `src/app/api/v1/place-preferences/route.ts` — API
- `src/components/features/trip-creator/PlaceExperienceCards.tsx` — 카드 UI
- `src/components/features/trip-creator/TripCreatorForm.tsx` — 플로우에 단계 추가
- `src/lib/services/ai/prompt.ts` — 프롬프트에 경험 데이터 포함
- `src/lib/services/ai/` — 인기 장소 조회용 간단 AI 호출

## 기능 2: 환율 변환 표시

### 개요
현지 통화 가격 옆에 한화 환산 금액 표시: `¥3,100 (~₩29,000)`

### 접근 방식
- 환율 API: exchangerate-api.com 무료 (월 1,500건) 또는 정적 환율 테이블
- 여행 생성 시 환율 조회 → trip에 저장 (여행 기간 동안 고정)
- 또는 클라이언트에서 실시간 조회

### 설계
- `src/utils/currency.ts` — 환율 변환 함수 확장
- Trip에 `exchange_rate` 필드 추가 또는 별도 환율 캐시
- TimelineCard/DayColumn/TimelineView — 한화 환산 표시

## 우선순위
1. 환율 표시 (작은 변경, 즉시 효과)
2. 장소 경험 카드 (DB + UI + AI 프롬프트 전체 변경)

## 작업 분할
- Step 1: 환율 변환 표시 (정적 환율 테이블 → 추후 API 연동)
- Step 2: DB + 타입 + 서비스 (user_place_preferences)
- Step 3: 인기 장소 AI 조회 API
- Step 4: 카드 UI + 여행 생성 플로우 연동
- Step 5: AI 프롬프트에 경험 데이터 반영
