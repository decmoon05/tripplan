-- Add companion, interests, special_note columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS companion text NOT NULL DEFAULT 'solo'
    CHECK (companion IN ('solo', 'couple', 'friends', 'family', 'family-kids', 'business', 'other')),
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS special_note text NOT NULL DEFAULT '';

-- Add defaults to travel_pace and budget_range (now trip-specific, profile stores defaults)
ALTER TABLE public.user_profiles
  ALTER COLUMN travel_pace SET DEFAULT 'moderate',
  ALTER COLUMN budget_range SET DEFAULT 'moderate';
