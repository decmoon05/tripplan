# Supabase 로컬 E2E 검증 체크리스트

## 인프라
- [x] npx supabase start 정상 실행
- [x] npx supabase db reset — 마이그레이션 6개 전부 적용
- [x] npm run dev 정상 기동

## 페이지 접근
- [x] / (홈) → 200
- [x] /auth/login → 200
- [x] /auth/signup → 200
- [x] /trips/new (미인증) → 307 /auth/login 리다이렉트
- [x] /onboarding (미인증) → 307 리다이렉트

## Auth
- [x] 회원가입 (Supabase Auth API) → 성공, user ID 발급
- [x] 로그인 → access_token 발급
- [x] API 미인증 호출 → 401 JSON 응답

## DB + RLS
- [x] Trip 생성 (service_role) → 정상 저장
- [x] 인증된 사용자 trips 조회 → 자기 trip만 반환
- [x] anon key trips 조회 → 빈 배열 (타인 데이터 차단)
- [x] api_usage_log 테이블 존재 확인
- [x] get_trip_by_share_token RPC 함수 정상 동작

## 보안 RLS 수정 검증
- [x] share_token 설정 후 anon key로 직접 SELECT → 빈 배열 (위험 정책 제거 확인)
- [x] RPC 함수로 공유 조회 → user_id 미포함 (개인정보 보호 확인)

## 미검증 (브라우저 필요)
- [ ] 브라우저에서 회원가입 → 로그인 → 세션 유지 → 여행 생성 → 일정 편집 → 새로고침
- [ ] 프로필 온보딩 → DB upsert 확인
- [ ] 공유 링크 생성 → /shared/[token] 접근
