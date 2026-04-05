# 계획서: 이동정보 + 영업정보 + 팩트체크

## 목표
AI 일정에 이동정보(transit) + 영업정보(address/hours/closedDays)를 추가하여 팩트체크 가능하게 함

## 수정 범위 (13개 파일)
1. DB: combined_migrations.sql — 6컬럼 추가
2. 타입: database.ts, ai/types.ts — 6필드 추가
3. AI: parseResponse.ts, prompt.ts — 스키마 + 프롬프트
4. 백엔드: trip.service.ts, tripItem.ts, route.ts — CRUD 매핑
5. 프론트: TransitBadge.tsx(신규), TimelineCard.tsx, DayColumn.tsx, EditItemModal.tsx
6. Mock: tripItems.ts

## 구현 순서
- Step 1: DB + 타입 (1~3)
- Step 2: AI 레이어 (4~5)
- Step 3: 백엔드 (6~8)
- Step 4: 프론트엔드 (9~12)
- Step 5: Mock 데이터 (13)
