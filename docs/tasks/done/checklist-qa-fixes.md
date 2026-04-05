# QA 통합 검사 수정 체크리스트

## 에러 (7건)
- [ ] SELECT * 패턴 (trip.service, profile.service) — 리팩토링 시 진행
- [ ] SELECT * profile.service — 동일
- [x] TripDetailView handleShare → api 함수(shareTrip) 전환
- [x] TripCreatorForm zodResolver 추가
- [x] CategoryBadge hotel 카테고리 추가
- [x] middleware Rate Limit 메모리 정리 로직 추가
- [x] 미사용 tripStore.ts 삭제

## 경고 (8건)
- [ ] W1: ProfileFormData → ProfileInput 타입 단언 검증 — 온보딩 완료 후 보장됨
- [x] W2: mock import 동적 전환 — AI_PROVIDER=mock일 때만 로드
- [ ] W3: rateLimit select('*') → select('id') — SELECT * 리팩토링 시 진행
- [ ] W4: MapView useEffect 의존성 — useMemo 적용으로 참조 안정
- [ ] W5: getDayCount 타임존 — date-only string이므로 현재 동작 정상
- [x] W6: addDays() → utils/date.ts로 이동
- [ ] W7: soft delete 미적용 — MVP 의도적 결정
- [ ] W8: DELETE itemId UUID 검증 — 경고 2와 동일 패턴

## 검증
- [x] npm run build 성공
- [x] npm run lint 0 errors (2 warnings)
