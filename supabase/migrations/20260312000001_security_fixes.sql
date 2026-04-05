-- Fix RLS Disabled in Public issues
-- Enabling RLS on tables flagged by the linter
ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trip_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.place_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.travel_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Fix Sensitive Columns Exposed
-- Revoke PostgREST API access to the password column on public.users
DO $$
BEGIN
  IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'password'
  ) THEN
    -- Revoke select on the specific column from anonymous and authenticated roles
    REVOKE SELECT (password) ON public.users FROM public, anon, authenticated;
  END IF;
END $$;
