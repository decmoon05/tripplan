# 장소 경험 카드 + 환율 표시 체크리스트

> 작성일: 2026-03-10
> 진행률: 0/10

## Step 1: 환율 변환 표시
- [x] 1-1. 정적 환율 테이블 추가 (currency.ts 확장)
- [x] 1-2. TimelineCard/DayColumn/TimelineView에 한화 환산 표시
- [x] 1-3. 빌드 검증

## Step 2: 장소 경험 DB + 서비스
- [x] 2-1. DB 마이그레이션 (user_place_preferences)
- [x] 2-2. 타입 + 서비스 + API 라우트

## Step 3: 인기 장소 AI 조회
- [x] 3-1. 목적지별 인기 장소 리스트 AI API

## Step 4: 카드 UI + 플로우 연동
- [x] 4-1. PlaceExperienceCards 컴포넌트
- [x] 4-2. TripCreatorForm에 단계 추가 (input → experience → generating)

## Step 5: AI 프롬프트 반영
- [x] 5-1. 경험 데이터를 일정 생성 프롬프트에 포함
- [x] 5-2. 전체 빌드 검증 (tsc --noEmit 통과)
