-- Add lifestyle profiling columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS morning_type text NOT NULL DEFAULT 'moderate'
    CHECK (morning_type IN ('early', 'moderate', 'late')),
  ADD COLUMN IF NOT EXISTS stamina text NOT NULL DEFAULT 'moderate'
    CHECK (stamina IN ('high', 'moderate', 'low')),
  ADD COLUMN IF NOT EXISTS adventure_level text NOT NULL DEFAULT 'balanced'
    CHECK (adventure_level IN ('explorer', 'balanced', 'cautious')),
  ADD COLUMN IF NOT EXISTS photo_style text NOT NULL DEFAULT 'casual'
    CHECK (photo_style IN ('sns', 'casual', 'minimal'));
