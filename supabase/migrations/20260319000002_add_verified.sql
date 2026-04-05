-- trip_items에 검증 상태 컬럼 추가
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_place_id text;
