# PRD 빠진 기능 보완 계획서

## 목표
PRD Phase 1~2에서 빠진 기능을 순서대로 채운다.

## Task 순서

### Task A: 지도 뷰 (Phase 1 누락)
- Google Maps JavaScript API로 일정 시각화
- 마커 + 경로선 + 일별 필터
- `@googlemaps/js-api-loader` 패키지 사용
- 파일: MapView.tsx, MapMarker.tsx

### Task B: Google Places API 연동 (Phase 2 누락)
- 장소 검색 Autocomplete → place_id 저장
- 상세 정보 조회 (이름, 평점, 사진, 영업시간)
- 세션 캐시 (sessionStorage, 30분 TTL)
- 파일: places.service.ts, PlaceSearch.tsx, PlaceDetail.tsx

### Task C: 공유 기능 (Phase 2 누락)
- 공개 링크로 일정 공유 (share_token)
- 비인증 읽기 전용 뷰
- 마이그레이션 + Route Handler + UI
