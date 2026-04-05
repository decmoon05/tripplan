-- 회원가입 시 user_profiles 자동 생성 트리거
-- auth.users에 INSERT되면 자동으로 기본 프로필 생성
-- 온보딩에서 실제 값으로 UPDATE됨

-- mbti_style 기본값 추가 (NOT NULL이므로)
ALTER TABLE public.user_profiles ALTER COLUMN mbti_style SET DEFAULT 'INTJ';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, mbti_style, travel_pace, food_preference, budget_range,
    companion, interests, special_note, morning_type, stamina,
    adventure_level, photo_style, role, plan
  ) VALUES (
    NEW.id, 'INTJ', 'moderate', '{}', 'moderate',
    'solo', '{}', '', 'moderate', 'moderate',
    'balanced', 'casual', 'user', 'free'
  ) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 기존에 프로필 없는 유저 복구
INSERT INTO public.user_profiles (
  user_id, mbti_style, travel_pace, food_preference, budget_range,
  companion, interests, special_note, morning_type, stamina,
  adventure_level, photo_style, role, plan
)
SELECT
  id, 'INTJ', 'moderate', '{}', 'moderate',
  'solo', '{}', '', 'moderate', 'moderate',
  'balanced', 'casual', 'user', 'free'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles)
ON CONFLICT (user_id) DO NOTHING;
