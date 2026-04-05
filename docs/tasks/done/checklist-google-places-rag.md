# 체크리스트 — Google Places Hybrid RAG

## Step 1: DB 마이그레이션
- [x] place_cache 테이블 마이그레이션
- [x] trip_items에 verified + google_place_id 컬럼 추가
- [x] combined_migrations.sql 업데이트

## Step 2: 타입 + 스키마
- [x] TripItem에 verified, googlePlaceId 추가
- [x] AIGeneratedItem에 verified, googlePlaceId 추가
- [x] AIProvider 인터페이스에 verifiedPlaces 파라미터 + VerifiedPlace 타입
- [x] parseResponse.ts aiItemSchema 확장

## Step 3: Google Places 서비스
- [x] googlePlaces.service.ts 생성 (searchPlaces, verifyPlace, searchAllCategories)

## Step 4: popularPlaces 수정
- [x] popularPlaces.ts → Google Places 기반으로 교체 + AI/mock 폴백
- [x] PopularPlace 타입 확장 (googlePlaceId, address, rating, verified)
- [x] API route에 supabase 전달

## Step 5: 프롬프트 주입
- [x] buildUserPrompt에 verifiedPlaces 파라미터 + [VERIFIED PLACES] 섹션
- [x] buildSingleDayUserPrompt에도 동일 적용

## Step 6: 프로바이더 수정
- [x] openai.provider.ts — verifiedPlaces 전달
- [x] claude.provider.ts — verifiedPlaces 전달
- [x] ai.service.ts — verifiedPlaces 전달 + mock 처리

## Step 7: 사후 검증
- [x] postValidate.ts 생성

## Step 8: 오케스트레이션
- [x] trip.service.ts — generateTripItems 수정 (캐시 로드 → AI → 사후검증)

## Step 9: UI
- [x] TimelineCard — ✓/⚠ 검증 배지
- [x] PlaceExperienceCards — rating, verified 표시

## Step 10: 빌드 검증
- [x] npx next build 성공 (추가 수정: items route, QuickAddPlace, mock data에 verified/googlePlaceId 추가)

## Step 11: 코드 리뷰 + 보안 리뷰
- [x] 코드 리뷰 완료 (max_tokens → max_completion_tokens 등)
- [x] 보안 리뷰 완료 (RLS, Rate Limiting, 입력 검증, 사후 검증 신뢰 모델 등 6건 수정)

## Step 12: Option B — ToS 준수 전환
- [x] place_cache 마이그레이션 slim화 (place_id만 저장)
- [x] combined_migrations.sql 동기화
- [x] popularPlaces.ts — 서버 메모리 캐시 (30분 TTL) + slim DB upsert
- [x] npx next build 성공
