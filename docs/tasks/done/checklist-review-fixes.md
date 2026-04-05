# 코드 리뷰 수정 체크리스트

## 심각 (4건)
- [x] AI Provider 타임아웃/재시도 — timeout: 30s, maxRetries: 2 (openai.provider.ts, claude.provider.ts)
- [x] share_token userId 노출 방지 — getTripByShareToken()에서 user_id 제외 (trip.service.ts, shared/[token]/page.tsx)
- [x] handleShare 에러 처리 — catch + res.ok 체크 + 에러 UI 표시 (TripDetailView.tsx)
- [x] PlaceSearch 에러 피드백 — 검색 실패 시 안내 메시지 표시 (PlaceSearch.tsx)

## 일반 (7건)
- [x] category enum 불일치 — prompt/parseResponse/MapView 모두 "hotel"로 통일
- [x] rateLimit 타임존 이슈 — setUTCHours + NaN 방어 (rateLimit.service.ts)
- [x] MapView useEffect 불필요한 재실행 — useMemo + useRef로 메모이제이션
- [x] TripCreatorForm 이중 타입 단언 — `as ProfileInput`으로 변경
- [x] useTripMutations Record<string, unknown> 남용 — ProfileInput, UpdateTripInput, UpdateTripItemInput 적용
- [x] share route 인라인 DB 쿼리 — Service로 분리 완료 (trip.service.ts)
- [x] DAILY_LIMIT NaN 미처리 — || 10 방어 추가

## 권장 (6건)
- [ ] Button 컴포넌트 미사용 (TripCreatorForm, ProfileForm) — 스타일 통일 시 진행
- [ ] SharedTripView 불필요한 'use client' — TimelineView 의존성으로 유지
- [x] MapView 모듈 스코프 변수 optionsSet → useRef 변경 완료
- [x] places.service JSON.parse 방어 — try-catch 추가
- [ ] 파일명 패턴 불일치 (parseResponse vs openai.provider) — 리팩토링 시 진행
- [ ] totalCost 통화 단위 하드코딩 — 다국적 통화 지원 시 진행

## 검증
- [x] npm run build 성공
- [x] npm run lint 0 errors (2 warnings)
