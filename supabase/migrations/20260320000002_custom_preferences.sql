-- 커스텀 식성/관심사 자유 입력 필드 추가
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS custom_food_preference text DEFAULT '',
ADD COLUMN IF NOT EXISTS custom_interests text DEFAULT '';

-- 기존 데이터는 빈 문자열로 초기화됨 (DEFAULT)
