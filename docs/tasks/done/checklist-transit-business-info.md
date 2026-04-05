# 체크리스트: 이동정보 + 영업정보 + 팩트체크

## Step 1: DB + 타입
- [x] combined_migrations.sql — 6컬럼 + share 함수 업데이트
- [x] database.ts — TripItem 6필드
- [x] ai/types.ts — AIGeneratedItem 6필드

## Step 2: AI 레이어
- [x] parseResponse.ts — aiItemSchema 6필드
- [x] prompt.ts — SYSTEM_RULES + COMPACT + singleDay 업데이트

## Step 3: 백엔드
- [x] trip.service.ts — createTripItem/bulkInsert/updateTripItem 매핑
- [x] tripItem.ts — updateSchema 6필드
- [x] route.ts — POST에 새 필드 전달

## Step 4: 프론트엔드
- [x] TransitBadge.tsx — 신규 컴포넌트
- [x] TimelineCard.tsx — 주소·영업시간 표시 (Google Maps 링크)
- [x] DayColumn.tsx — TransitBadge 렌더링
- [x] EditItemModal.tsx — 주소·영업시간·휴무일 편집 필드 추가

## Step 5: Mock + 기타
- [x] tripItems.ts — mock 6필드 추가
- [x] ai.service.ts — mock provider 6필드 추가
- [x] AddItemModal.tsx — 새 필드 null 전달
- [x] QuickAddPlace.tsx — 새 필드 null 전달

## 검증
- [x] npx next build 성공
