# 맥락 노트 — Google Places Hybrid RAG

## 핵심 결정 사항
- Google Places API (New) 사용 — REST fetch, 추가 패키지 불필요
- **Option B (ToS 준수)**: place_cache DB에는 google_place_id만 저장, 상세 데이터는 서버 메모리 캐시 (30분 TTL)
- trip_items에 verified + google_place_id 컬럼 추가
- AI 프롬프트에 [VERIFIED PLACES] 섹션 주입
- 사후 검증: AI가 추가한 미검증 장소만 Google Places로 검증

## 주의점
- 환경변수: GOOGLE_PLACES_API_KEY 필요
- 토큰 예산: ~30장소 x ~50토큰 = ~1500토큰
- 사후 검증 5초 타임아웃 + Promise.all 병렬 처리
- mock provider에서도 verifiedPlaces 처리
- bulkInsertTripItems에 verified/google_place_id 전달 필요

## 추가 수정 (빌드 오류 해결)
- `src/app/api/v1/trips/[tripId]/items/route.ts` — createTripItem 호출에 verified/googlePlaceId 추가
- `src/components/features/trip-editor/AddItemModal.tsx` — 동일
- `src/components/features/trip-editor/QuickAddPlace.tsx` — 동일
- `src/mocks/tripItems.ts` — 19개 mock 아이템 모두에 verified/googlePlaceId 추가

## 작업 로그
- (시작) 파일 읽기 완료, 작업 문서 생성
- Step 1~2: DB 마이그레이션 + 타입/스키마 완료
- Step 3~9: 구현 완료
- Step 10: 빌드 성공 (3회 수정 후)
- 코드 리뷰 + 보안 리뷰 완료 (6개 보안 이슈 수정)
- **Option B 전환**: place_cache slim화 + 메모리 캐시 추가 (ToS 준수)
  - `supabase/migrations/20260319000001_place_cache.sql` — 상세 컬럼 제거
  - `supabase/combined_migrations.sql` — 동일 반영
  - `src/lib/services/ai/popularPlaces.ts` — 메모리 캐시 (30분 TTL, 최대 100개) + slim DB upsert
  - 빌드 성공 확인
