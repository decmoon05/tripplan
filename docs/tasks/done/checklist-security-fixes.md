# 보안 검토 수정 체크리스트

## 위험 (3건)
- [x] 공유 RLS 정책 전면 교체 — SECURITY DEFINER 함수로 전환 (20260310000004_fix_share_rls.sql)
- [x] 비밀번호 정책 강화 — 8자 + 대문자/숫자/특수문자 + zodResolver (auth.ts, SignupForm, LoginForm)
- [x] Auth Rate Limiting — middleware에 IP 기반 15분/10회 제한 추가

## 경고 (5건)
- [x] SignupForm 에러 메시지 일반화 — Supabase 원본 에러 노출 방지
- [ ] tripId UUID 형식 검증 — 중요도 낮음 (Supabase가 에러 반환으로 자체 방어)
- [x] items PATCH/DELETE IDOR 방지 — updateTripItem/deleteTripItem에 tripId 파라미터 추가
- [ ] SELECT * 패턴 → 명시적 컬럼 지정 — 리팩토링 시 진행
- [ ] 공유 토큰 브루트포스 Rate Limiting — 128bit 엔트로피로 현실적 위험 낮음

## 정보 (2건)
- [x] LoginForm zodResolver 적용
- [x] middleware NODE_ENV 방어 강화 — `!== 'development'`

## 검증
- [x] npm run build 성공
- [x] npm run lint 0 errors (2 warnings)
- [x] run-qa.sh 통과
