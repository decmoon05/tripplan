# 코드 리뷰 수정 맥락 노트

## 배경
Review Agent로 최근 3개 커밋(AI API 연동, UI/UX 개선, PRD 빠진 기능 보완) 32개 파일 검토.
17건 발견 (심각 4, 일반 7, 권장 6).

## 수정 완료 (심각 4 + 일반/권장 일부)

### 1. AI Provider 타임아웃/재시도
- OpenAI SDK: `timeout: 30_000, maxRetries: 2`
- Anthropic SDK: `timeout: 30_000, maxRetries: 2`
- 두 SDK 모두 자체 재시도 로직 내장 (5xx만 재시도, 지수 백오프)

### 2. share_token userId 노출 방지
- `getTripByShareToken()` 서비스 함수 신규 생성
- SELECT에서 user_id 컬럼 제외, 빈 문자열로 대체
- shared/[token]/page.tsx에서 인라인 쿼리 → 서비스 함수 호출로 전환

### 3. share route Service 분리
- `setShareToken()`, `removeShareToken()` → trip.service.ts로 이동
- Route Handler에서 인라인 supabase 쿼리 제거
- backend.md "Route Handler에서 직접 쿼리 금지" 규칙 준수

### 4. 에러 처리 보강
- TripDetailView handleShare: try-catch + res.ok 체크 + shareError 상태 + UI 표시
- PlaceSearch: searchError 상태 + "장소 검색에 실패했습니다" 안내 메시지
- rateLimit: UTC 기준 날짜 계산 + NaN 방어
- places.service: JSON.parse try-catch + 손상 캐시 자동 삭제

## 미수정 잔여 (일반 4 + 권장 5)
- 중요도 낮은 항목 → 다음 작업 시 점진적 개선
- category enum 통일, MapView useMemo, 타입 단언 정리 등
