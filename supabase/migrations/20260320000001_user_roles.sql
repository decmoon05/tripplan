-- user_profiles에 role 컬럼 추가
ALTER TABLE public.user_profiles
  ADD COLUMN role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'developer', 'admin'));

-- 인덱스 (admin 페이지 조회용)
CREATE INDEX idx_user_profiles_role ON public.user_profiles (role);

-- RLS를 우회하여 admin 여부를 판별하는 함수 (SECURITY DEFINER → RLS 무시)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 기존 SELECT 정책 DROP 후 교체 (is_admin() 사용으로 재귀 방지)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

CREATE POLICY "Users can view own or admin all profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- 기존 UPDATE 정책 DROP 후 교체
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own or admin all profiles"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 트리거: 일반 유저의 role 컬럼 변경 차단 (권한 상승 방지)
CREATE OR REPLACE FUNCTION prevent_role_self_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'role 변경은 관리자만 가능합니다'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_self_promotion
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_promotion();

-- 기존 api_usage_log SELECT 정책 DROP 후 교체
DROP POLICY IF EXISTS "Users can view own usage" ON public.api_usage_log;

CREATE POLICY "Users can view own or admin all usage"
  ON public.api_usage_log FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- 기존 trips SELECT 정책 DROP 후 교체
DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;

CREATE POLICY "Users can view own or admin all trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
