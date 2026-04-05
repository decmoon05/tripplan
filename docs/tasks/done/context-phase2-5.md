# Phase 2~5 — 컨텍스트 노트

> 작성일: 2026-03-29

## 아키텍처 결정 사항

### PDF 내보내기: 라이브러리 없이 `window.print()`
- `@react-pdf/renderer`, `puppeteer` 등 무거운 라이브러리 대신 CSS `@media print` 활용
- 장점: 번들 크기 0 증가, 서버 리소스 불필요, 브라우저 내장 기능
- 단점: 레이아웃 제어 제한적. PDF 완성도 필요 시 `@react-pdf/renderer` 추후 도입 고려

### 경로 최적화: Greedy Nearest-Neighbor (서버사이드)
- Google Routes API 대신 순수 JS 알고리즘 (비용 0)
- Haversine 거리 공식 (지구 곡률 반영)
- 좌표 없는 장소는 원래 순서 유지 후 말미에 배치
- O(n²) — 일정당 최대 20개 장소라 성능 문제 없음

### Supabase Realtime: postgres_changes 패턴
- INSERT 이벤트 수신 후 재조회 전략 (단순하고 안전)
- 채팅 페이로드 직접 추가 시 display_name JOIN 불가 → 재조회 불가피
- 향후: display_name을 messages 테이블에 비정규화 하면 재조회 없이 처리 가능

### PWA 아이콘
- `public/icon-192.png`, `public/icon-512.png` 아직 미생성 (placeholder)
- 실제 앱 아이콘 추가 시 `public/` 경로에 배치하면 됨

### 사진 업로드: Supabase Storage Signed URL 방식
- 클라이언트 → 서버(서명 URL 요청) → 클라이언트(S3 직접 업로드) → 서버(DB 저장)
- 보안: 서버가 서명 URL 생성, 사용자는 자신의 경로(`userId/tripId/`)에만 업로드 가능
- `public/trip-photos` 버킷은 Supabase 대시보드에서 수동 생성 필요

### 이메일 리마인더
- DB preference 저장까지만 구현
- 실제 발송: Supabase Edge Function (cron) + Resend API 필요
- Edge Function 코드는 별도 구현 필요 (`supabase/functions/send-reminders/`)

## 알려진 제약

1. **Travel Room 채팅**: 재조회 방식 → 많은 동시 사용자 시 부하 증가 가능
2. **평점(ratings)**: AI 추천 개선에 활용하려면 AI 프롬프트에 평점 데이터 주입 필요 (별도 작업)
3. **PWA 오프라인**: API 호출은 항상 온라인 필요, 캐시는 페이지 렌더링만 지원
4. **커뮤니티/리뷰 (Phase 5-4)**: 범위 과대 → 별도 계획 수립 필요
5. **다국어 (Phase 5-2)**: next-intl 설치 및 전체 UI 텍스트 추출 → 별도 스프린트 필요

## DB 마이그레이션 실행 순서

Supabase 대시보드 또는 `supabase db push`로 다음 순서 실행:
1. `20260329000001_trip_checklists.sql`
2. `20260329000002_trip_expenses.sql`
3. `20260329000003_trip_notifications.sql`
4. `20260329000004_room_votes.sql`
5. `20260329000005_room_messages.sql`
6. `20260329000006_trip_ratings.sql`
7. `20260329000007_trip_photos.sql`

Storage 버킷 생성: `trip-photos` (Public 또는 Private — Private 권장)
