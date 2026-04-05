-- trip_items에 좌표 컬럼 추가 (지도 뷰용)
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
