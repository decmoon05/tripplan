-- ============================================
-- TripPlan 전체 마이그레이션 (16개 파일 통합)
-- Supabase Dashboard SQL Editor에서 실행
-- 최종 업데이트: 2026-03-20
-- ============================================

-- [1/8] 20260309000001_create_tables.sql
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mbti_style text not null,
  morning_type text not null default 'moderate' check (morning_type in ('early', 'moderate', 'late')),
  stamina text not null default 'moderate' check (stamina in ('high', 'moderate', 'low')),
  adventure_level text not null default 'balanced' check (adventure_level in ('explorer', 'balanced', 'cautious')),
  photo_style text not null default 'casual' check (photo_style in ('sns', 'casual', 'minimal')),
  travel_pace text not null default 'moderate' check (travel_pace in ('relaxed', 'moderate', 'active')),
  food_preference text[] not null default '{}',
  budget_range text not null default 'moderate' check (budget_range in ('budget', 'moderate', 'luxury')),
  companion text not null default 'solo' check (companion in ('solo', 'couple', 'friends', 'family', 'family-kids', 'business', 'other')),
  interests text[] not null default '{}',
  special_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'generated', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null,
  order_index integer not null,
  place_id text not null,
  place_name_snapshot text not null,
  category text not null,
  start_time time not null,
  end_time time not null,
  estimated_cost integer not null default 0,
  notes text not null default '',
  reason_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_trip_items_trip_id on public.trip_items(trip_id);
create index if not exists idx_trip_items_day_order on public.trip_items(trip_id, day_number, order_index);

-- [2/8] 20260309000002_rls_policies.sql
alter table public.user_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own profile') THEN
    CREATE POLICY "Users can delete own profile" ON public.user_profiles FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own trips') THEN
    CREATE POLICY "Users can view own trips" ON public.trips FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own trips') THEN
    CREATE POLICY "Users can insert own trips" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own trips') THEN
    CREATE POLICY "Users can update own trips" ON public.trips FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own trips') THEN
    CREATE POLICY "Users can delete own trips" ON public.trips FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own trip items') THEN
    CREATE POLICY "Users can view own trip items" ON public.trip_items FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_items.trip_id AND trips.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own trip items') THEN
    CREATE POLICY "Users can insert own trip items" ON public.trip_items FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_items.trip_id AND trips.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own trip items') THEN
    CREATE POLICY "Users can update own trip items" ON public.trip_items FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_items.trip_id AND trips.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own trip items') THEN
    CREATE POLICY "Users can delete own trip items" ON public.trip_items FOR DELETE
      USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_items.trip_id AND trips.user_id = auth.uid()));
  END IF;
END $$;

-- [3/8] 20260310000001_api_usage_log.sql
CREATE TABLE IF NOT EXISTS api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage_log (user_id, created_at DESC);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own usage') THEN
    CREATE POLICY "Users can view own usage" ON api_usage_log FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own usage') THEN
    CREATE POLICY "Users can insert own usage" ON api_usage_log FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- [4/8] 20260310000002_add_coordinates.sql
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- [5/8] 20260310000003_share_token.sql
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- [7/8] 20260310000005_add_currency_confidence.sql (함수보다 먼저 실행)
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS price_confidence text NOT NULL DEFAULT 'estimated'
    CHECK (price_confidence IN ('confirmed', 'estimated'));

-- [12/12] 20260318000001_add_reason_tags.sql (함수보다 먼저 실행)
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS reason_tags text[] NOT NULL DEFAULT '{}';

-- [13/13] 20260318000002_add_transit_business_info.sql (함수보다 먼저 실행)
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS business_hours text,
  ADD COLUMN IF NOT EXISTS closed_days text,
  ADD COLUMN IF NOT EXISTS transit_mode text,
  ADD COLUMN IF NOT EXISTS transit_duration_min integer,
  ADD COLUMN IF NOT EXISTS transit_summary text;

-- [15/15] 20260319000002_add_verified.sql (함수보다 먼저 실행)
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_place_id text;

-- [6/8] 20260310000004_fix_share_rls.sql
CREATE OR REPLACE FUNCTION get_trip_by_share_token(p_token text)
RETURNS TABLE (
  id uuid, destination text, start_date date, end_date date,
  status text, share_token text, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, destination, start_date, end_date, status, share_token, created_at, updated_at
  FROM trips WHERE trips.share_token = p_token;
$$;

DROP FUNCTION IF EXISTS get_trip_items_by_share_token(text);
CREATE OR REPLACE FUNCTION get_trip_items_by_share_token(p_token text)
RETURNS TABLE (
  id uuid, trip_id uuid, day_number integer, order_index integer,
  place_id text, place_name_snapshot text, category text,
  start_time text, end_time text, estimated_cost integer, notes text,
  latitude double precision, longitude double precision,
  currency text, price_confidence text, reason_tags text[],
  address text, business_hours text, closed_days text,
  transit_mode text, transit_duration_min integer, transit_summary text,
  verified boolean, google_place_id text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT ti.id, ti.trip_id, ti.day_number, ti.order_index, ti.place_id,
         ti.place_name_snapshot, ti.category, ti.start_time::text, ti.end_time::text,
         ti.estimated_cost, ti.notes, ti.latitude, ti.longitude,
         ti.currency, ti.price_confidence, ti.reason_tags,
         ti.address, ti.business_hours, ti.closed_days,
         ti.transit_mode, ti.transit_duration_min, ti.transit_summary,
         ti.verified, ti.google_place_id,
         ti.created_at
  FROM trip_items ti INNER JOIN trips t ON t.id = ti.trip_id
  WHERE t.share_token = p_token ORDER BY ti.day_number, ti.order_index;
$$;

-- [8/8] 20260310000006_user_place_preferences.sql
CREATE TABLE IF NOT EXISTS public.user_place_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination text NOT NULL,
  place_name text NOT NULL,
  preference text NOT NULL CHECK (preference IN ('exclude', 'revisit', 'new', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, destination, place_name)
);

CREATE INDEX IF NOT EXISTS idx_place_prefs_user_dest ON public.user_place_preferences (user_id, destination);

ALTER TABLE public.user_place_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own place preferences') THEN
    CREATE POLICY "Users can view own place preferences" ON public.user_place_preferences FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own place preferences') THEN
    CREATE POLICY "Users can insert own place preferences" ON public.user_place_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own place preferences') THEN
    CREATE POLICY "Users can update own place preferences" ON public.user_place_preferences FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own place preferences') THEN
    CREATE POLICY "Users can delete own place preferences" ON public.user_place_preferences FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- [9/10] 20260311000001_profile_personalization.sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS companion text NOT NULL DEFAULT 'solo'
    CHECK (companion IN ('solo', 'couple', 'friends', 'family', 'family-kids', 'business', 'other')),
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS special_note text NOT NULL DEFAULT '';

ALTER TABLE public.user_profiles
  ALTER COLUMN travel_pace SET DEFAULT 'moderate',
  ALTER COLUMN budget_range SET DEFAULT 'moderate';

-- [10/10] 20260311000002_lifestyle_columns.sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS morning_type text NOT NULL DEFAULT 'moderate'
    CHECK (morning_type IN ('early', 'moderate', 'late')),
  ADD COLUMN IF NOT EXISTS stamina text NOT NULL DEFAULT 'moderate'
    CHECK (stamina IN ('high', 'moderate', 'low')),
  ADD COLUMN IF NOT EXISTS adventure_level text NOT NULL DEFAULT 'balanced'
    CHECK (adventure_level IN ('explorer', 'balanced', 'cautious')),
  ADD COLUMN IF NOT EXISTS photo_style text NOT NULL DEFAULT 'casual'
    CHECK (photo_style IN ('sns', 'casual', 'minimal'));

-- [11/12] 20260312000001_security_fixes.sql
ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trip_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.place_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.travel_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password'
  ) THEN
    REVOKE SELECT (password) ON public.users FROM public, anon, authenticated;
  END IF;
END $$;

-- [14/15] 20260319000001_place_cache.sql
-- ToS 준수: google_place_id만 저장, 상세 정보는 서버 메모리 캐시 (30분 TTL)
CREATE TABLE IF NOT EXISTS public.place_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  category text NOT NULL,
  google_place_id text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(destination, google_place_id)
);

CREATE INDEX IF NOT EXISTS idx_place_cache_dest_cat ON public.place_cache(destination, category);
CREATE INDEX IF NOT EXISTS idx_place_cache_expires ON public.place_cache(expires_at);

ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'place_cache_select') THEN
    CREATE POLICY "place_cache_select" ON public.place_cache
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'place_cache_insert') THEN
    CREATE POLICY "place_cache_insert" ON public.place_cache
      FOR INSERT TO authenticated
      WITH CHECK (
        google_place_id IS NOT NULL
        AND length(destination) <= 100
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'place_cache_no_update') THEN
    CREATE POLICY "place_cache_no_update" ON public.place_cache
      FOR UPDATE TO authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'place_cache_no_delete') THEN
    CREATE POLICY "place_cache_no_delete" ON public.place_cache
      FOR DELETE TO authenticated USING (false);
  END IF;
END $$;

-- [16/16] 20260320000001_user_roles.sql
-- role 컬럼 추가
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'developer', 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);

-- RLS를 우회하여 admin 여부를 판별하는 함수 (SECURITY DEFINER → RLS 무시, 재귀 방지)
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

-- 기존 SELECT/UPDATE 정책 DROP → is_admin() 사용 정책으로 교체
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own or admin all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own or admin all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own usage" ON public.api_usage_log;
DROP POLICY IF EXISTS "Users can view own or admin all usage" ON public.api_usage_log;
DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can view own or admin all trips" ON public.trips;

CREATE POLICY "Users can view own or admin all profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own or admin all profiles"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can view own or admin all usage"
  ON public.api_usage_log FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can view own or admin all trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

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

DROP TRIGGER IF EXISTS trg_prevent_role_self_promotion ON public.user_profiles;
CREATE TRIGGER trg_prevent_role_self_promotion
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_promotion();

-- ============================================
-- 초기 admin 설정 (프로필 없으면 생성 + admin, 있으면 admin으로 변경)
-- ============================================
INSERT INTO public.user_profiles (user_id, mbti_style, role)
SELECT id, 'ENFP', 'admin'
FROM auth.users
WHERE email = 'decmoon05@naver.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
