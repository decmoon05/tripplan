# 보안 검토 수정 맥락 노트

## 배경
Security Agent로 Auth/공유/API/RLS 등 22개 파일 검토. 10건 발견 (위험 3, 경고 5, 정보 2).

## 핵심 결정

### 1. 공유 RLS → SECURITY DEFINER 함수 전환
- **문제**: `share_token IS NOT NULL` RLS 정책이 공유 설정된 모든 trip을 누구에게나 SELECT 허용 → user_id 포함 전체 데이터 노출
- **해결**: 위험한 RLS 정책 DROP → `get_trip_by_share_token()`, `get_trip_items_by_share_token()` SECURITY DEFINER 함수 생성
- **효과**: anon 사용자의 trips/trip_items 직접 SELECT 차단, share_token을 아는 경우에만 RPC로 조회, user_id 컬럼 미반환

### 2. 비밀번호 정책
- 6자 → 8자 최소, 대문자+숫자+특수문자 필수
- LoginForm/SignupForm 모두 zodResolver 적용으로 클라이언트 검증 통일
- SignupForm: Supabase 원본 에러 → 일반 메시지로 대체 (이메일 열거 방지)

### 3. Auth Rate Limiting
- middleware에 메모리 기반 IP Rate Limiting 추가
- 15분 윈도우, 10회 제한
- 프로덕션에서는 Redis로 교체 필요 (서버리스 환경에서 메모리 기반은 인스턴스별 독립)

### 4. IDOR 방지
- updateTripItem/deleteTripItem에 선택적 tripId 파라미터 추가
- Route Handler에서 URL의 tripId를 전달하여 다른 trip의 아이템 접근 차단

## 잔여 작업
- tripId UUID 형식 검증
- SELECT * → 명시적 컬럼 지정
- /shared/ 경로 Rate Limiting
