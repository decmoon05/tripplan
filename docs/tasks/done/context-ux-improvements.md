# UX 개선 — 맥락 노트

## 기존 인프라 (재사용 가능)
- `useTrips` 훅: fetchTrips() → GET /api/v1/trips → 사용자 여행 목록
- `useDeleteTrip` 뮤테이션: 여행 삭제 기능 이미 존재
- `ProfileForm`: 온보딩 4스텝 (MBTI→성향→식성→관심사→확인)
- `useProfile` + `useSaveProfile`: 프로필 CRUD 이미 완성
- `profileStore`: Zustand persist로 클라이언트 캐시
- `TripView`: 3탭 구조 (타임라인|지도|리스트)

## 주의사항
- ProfileForm 재사용 시 라우팅 변경 필요 (온보딩: /trips/new → 마이페이지: /mypage + 성공토스트)
- Header는 인증 상태별 분기 이미 있음 — 링크 추가만
- TripCreatorForm의 PREF_STEPS는 pace→budget→companion→special-note 순
- 자동진행은 special-note 제외 (텍스트 입력이므로)
- MapView는 별도 Effect로 마커/폴리라인 관리 — 선택 마커 하이라이트 추가 필요

## 타입 현황
- Trip: id, userId, destination, startDate, endDate, status, shareToken, createdAt, updatedAt
- TripStatus: 'draft' | 'generated' | 'confirmed'
- UserProfile: 14개 필드 (morningType, stamina 등 lifestyle이 flat)
