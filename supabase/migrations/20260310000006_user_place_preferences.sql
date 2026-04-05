-- 사용자 장소 경험 테이블 (여행 계획 생성 전 선택)
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

CREATE INDEX idx_place_prefs_user_dest ON public.user_place_preferences (user_id, destination);

-- RLS
ALTER TABLE public.user_place_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own place preferences"
  ON public.user_place_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own place preferences"
  ON public.user_place_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own place preferences"
  ON public.user_place_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own place preferences"
  ON public.user_place_preferences FOR DELETE
  USING (auth.uid() = user_id);
