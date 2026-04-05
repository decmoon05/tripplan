-- user_profiles에 요금제(plan) 컬럼 추가
-- role(권한)과 plan(구독)은 독립 — admin이면서 free 가능
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'team'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON public.user_profiles (plan);
