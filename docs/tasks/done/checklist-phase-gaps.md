# PRD 빠진 기능 보완 체크리스트

## Task A: 지도 뷰 (Phase 1)
- [x] @googlemaps/js-api-loader 설치
- [x] src/components/features/map/MapView.tsx 생성
- [x] TripView에 지도 탭 연결 (타임라인/지도/장소목록 3탭)
- [x] TripItem에 latitude/longitude 추가 (타입 + DB 마이그레이션)
- [x] Mock 데이터 좌표 포함, AI 프로바이더 좌표 출력
- [x] build 통과

## Task B: Google Places API (Phase 2)
- [x] src/lib/services/places.service.ts 생성 (세션캐시 30분)
- [x] src/components/features/map/PlaceSearch.tsx 생성 (Autocomplete)
- [x] build 통과

## Task C: 공유 기능 (Phase 2)
- [x] supabase/migrations/20260310000003_share_token.sql
- [x] Trip 타입에 shareToken 추가
- [x] src/app/api/v1/trips/[tripId]/share/route.ts (POST/DELETE)
- [x] src/app/shared/[token]/page.tsx (비인증 읽기 전용)
- [x] src/components/features/trip-view/SharedTripView.tsx
- [x] TripDetailView에 공유 버튼 + 클립보드 복사
- [x] build 통과

## 검증
- [x] npm run build 성공
- [x] npm run lint 0 errors
- [x] supabase db reset 마이그레이션 5개 적용
