-- 이동정보 + 영업정보 6컬럼 추가
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS business_hours text,
  ADD COLUMN IF NOT EXISTS closed_days text,
  ADD COLUMN IF NOT EXISTS transit_mode text,
  ADD COLUMN IF NOT EXISTS transit_duration_min integer,
  ADD COLUMN IF NOT EXISTS transit_summary text;

-- share 함수에 새 컬럼 반영
DROP FUNCTION IF EXISTS get_trip_items_by_share_token(text);
CREATE OR REPLACE FUNCTION get_trip_items_by_share_token(p_token text)
RETURNS TABLE (
  id uuid, trip_id uuid, day_number integer, order_index integer,
  place_id text, place_name_snapshot text, category text,
  start_time text, end_time text, estimated_cost integer, notes text,
  latitude double precision, longitude double precision,
  currency text, price_confidence text, reason_tags text[],
  address text, business_hours text, closed_days text,
  transit_mode text, transit_duration_min integer, transit_summary text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT ti.id, ti.trip_id, ti.day_number, ti.order_index, ti.place_id,
         ti.place_name_snapshot, ti.category, ti.start_time::text, ti.end_time::text,
         ti.estimated_cost, ti.notes, ti.latitude, ti.longitude,
         ti.currency, ti.price_confidence, ti.reason_tags,
         ti.address, ti.business_hours, ti.closed_days,
         ti.transit_mode, ti.transit_duration_min, ti.transit_summary,
         ti.created_at
  FROM trip_items ti INNER JOIN trips t ON t.id = ti.trip_id
  WHERE t.share_token = p_token ORDER BY ti.day_number, ti.order_index;
$$;
