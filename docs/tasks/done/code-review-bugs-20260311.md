# 코드 리뷰 및 버그 수정 보고서 (2026-03-11)

## 발견된 버그 및 수정 내역

### CRITICAL 1: "안갈래요" 선택한 장소가 다음에도 인기 장소에 다시 나옴
- **원인**: `popular-places/route.ts`에서 `preference === 'hidden'`만 필터링. `exclude`는 필터 안 됨.
- **수정**: `exclude` OR `hidden` 모두 필터링하도록 변경
- **파일**: `src/app/api/v1/ai/popular-places/route.ts` (line 22)

### CRITICAL 2: AI generate 스키마에 `hidden` 누락
- **원인**: `ai/generate/route.ts`의 Zod 스키마에 `'hidden'`이 없어서, 프론트에서 hidden 포함 데이터를 보내면 validation error 발생
- **수정**: 스키마에 `'hidden'` 추가
- **파일**: `src/app/api/v1/ai/generate/route.ts` (line 12)

### CRITICAL 3: "표시 안하기" 이중 구조로 인한 혼란
- **원인**: `exclude`(안갈래요) + `hidden`(표시 안하기 체크) 이중 단계가 사용자에게 혼란. exclude만 선택하면 다음에도 나타남.
- **수정**: `exclude` 자체가 영구 필터링되도록 변경. "표시 안하기" 체크박스 제거 (불필요한 이중 단계).
- **파일**: `src/components/features/trip-creator/PlaceExperienceCards.tsx`

### HIGH 4: 시간 표시 HH:MM:SS → HH:MM
- **원인**: DB에서 time 타입이 HH:MM:SS로 반환됨
- **수정**: `formatTime()` 함수로 HH:MM 잘라서 표시
- **파일**: `src/components/features/trip-view/TimelineCard.tsx`

### HIGH 5: AI 세부정보 — 이동수단에 "대표 메뉴"가 나옴
- **원인**: `expandPlace.ts`의 기본 fallback이 카테고리 무관하게 "메뉴"로 표시
- **수정**: 카테고리별 mock 데이터 전면 재작성 (transport→교통수단 옵션, hotel→객실타입/조식/세탁기 등)
- **파일**: `src/lib/services/ai/expandPlace.ts`

### HIGH 6: 세부정보 이름에 부모 장소명 반복
- **원인**: mock에서 `${placeName} - ${subName}` 형태로 생성
- **수정**: 부모 장소명 제거, 서브아이템 이름만 표시
- **파일**: `src/lib/services/ai/expandPlace.ts`

### HIGH 7: 탭 전환 시 AI 세부정보 소실
- **원인**: `{viewMode === 'timeline' && <TimelineView />}` → 탭 전환 시 언마운트되어 state 소멸
- **수정**: `<div className={viewMode==='timeline' ? '' : 'hidden'}>` — 숨기기만 하고 마운트 유지. expandCache/selectionCache를 TimelineView에서 관리.
- **파일**: `src/components/features/trip-view/TripView.tsx`, `TimelineView.tsx`, `DayColumn.tsx`

### HIGH 8: 세부정보 선택 → 가격 반영 불가
- **원인**: 기능 자체가 없었음
- **수정**: 체크박스/라디오 UI 추가. 같은 group이면 택1(라디오), 독립 항목은 체크박스. "가격 반영" 버튼으로 메인 카드 가격 업데이트.
- **파일**: `src/components/features/trip-view/TimelineCard.tsx`

### MEDIUM 9: 인스타/블로그 장소 추가 기능 없음
- **수정**: QuickAddPlace 컴포넌트 신규 생성 — 장소명 + 참고 URL + Day/카테고리 선택
- **파일**: `src/components/features/trip-editor/QuickAddPlace.tsx`

### MEDIUM 10: 비용 라벨 "예상 비용 (원)" 고정
- **수정**: 현지 통화 코드 동적 표시 (JPY, KRW 등)
- **파일**: `src/components/features/trip-editor/EditItemModal.tsx`

### MEDIUM 11: 장소명 영어로 나옴
- **원인**: AI 프롬프트가 영어 이름을 허용
- **수정**: 프롬프트 강화 — 호텔/교통 포함 한국어 필수 예시 추가
- **파일**: `src/lib/services/ai/prompt.ts`

### MEDIUM 12: 엔화가 원화(₩)로 표시
- **원인**: `bulkInsertTripItems`, `createTripItem`에서 currency를 DB에 저장하지 않음 → DB default 'KRW' 사용
- **수정**: currency, price_confidence 필드 DB 저장 추가
- **파일**: `src/lib/services/trip.service.ts`

### LOW 13: updateTripItem에 currency/priceConfidence 업데이트 불가
- **수정**: 스키마 + 서비스 함수에 두 필드 추가
- **파일**: `src/lib/validators/tripItem.ts`, `src/lib/services/trip.service.ts`

---

## 설계 변경 사항

### Preference 시스템 단순화
- **Before**: exclude(임시) + hidden(영구) 이중 구조 + "표시 안하기" 체크박스
- **After**: exclude = 영구 필터링 (안갈래요 = 다음에도 추천 안 함). hidden은 하위 호환만 유지.
- **이유**: 사용자가 "안갈래요" 눌렀는데 다음에 또 나오는 것은 직관에 반함

### AI 세부정보 상태 관리
- **Before**: TimelineCard 내부 state → 탭 전환 시 소멸
- **After**: TimelineView에서 expandCache/selectionCache 관리, DayColumn→TimelineCard로 props 전달

---

## 미수정 (향후 작업)
- [ ] 브라우저 E2E 테스트
- [ ] Google Maps API 활성화 (사용자 Google Cloud Console에서)
- [ ] 실제 AI 프로바이더에서 한국어 이름 반환 검증
- [ ] DB CHECK 제약조건 hidden 포함 업데이트 (리모트 Supabase)
