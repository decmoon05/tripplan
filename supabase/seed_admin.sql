-- 관리자 계정 초기화 스크립트
-- postgres 슈퍼유저로 실행해야 함 (docker exec 또는 Supabase SQL Editor)
--
-- 사용법:
--   docker exec -i supabase_db_tripplan psql -U postgres -d postgres -f /path/to/seed_admin.sql
--   또는 아래 내용을 Supabase Studio SQL Editor에 붙여넣기

-- 트리거가 auth.uid() 없는 환경에서 role 변경을 차단하므로 일시 비활성화
ALTER TABLE public.user_profiles DISABLE TRIGGER trg_prevent_role_self_promotion;

UPDATE public.user_profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'decmoon05@naver.com'
);

ALTER TABLE public.user_profiles ENABLE TRIGGER trg_prevent_role_self_promotion;

-- 결과 확인
SELECT u.email, p.role
FROM auth.users u
JOIN public.user_profiles p ON u.id = p.user_id
WHERE u.email = 'decmoon05@naver.com';
