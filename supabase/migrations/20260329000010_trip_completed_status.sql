-- Trip에 'completed' 상태 추가 (다녀온 여행)
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('draft', 'generated', 'confirmed', 'completed'));

-- trip_ratings에 한줄 메모 컬럼 추가
ALTER TABLE trip_ratings ADD COLUMN IF NOT EXISTS memo text DEFAULT NULL;
