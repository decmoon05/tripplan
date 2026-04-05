-- place_cache에 photo_reference 컬럼 추가
ALTER TABLE place_cache
ADD COLUMN IF NOT EXISTS photo_reference text DEFAULT NULL;
