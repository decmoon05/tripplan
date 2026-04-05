-- trips 테이블에 여행 요약 + 어드바이저리 추가
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_summary text,
  ADD COLUMN IF NOT EXISTS advisories jsonb;

-- trip_items 테이블에 서브 활동 캐시 추가
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS sub_activities jsonb;

-- share 함수: trips에 trip_summary, advisories 반영
DROP FUNCTION IF EXISTS get_trip_by_share_token(text);
CREATE OR REPLACE FUNCTION get_trip_by_share_token(p_token text)
RETURNS TABLE (
  id uuid,
  destination text,
  start_date date,
  end_date date,
  status text,
  share_token text,
  trip_summary text,
  advisories jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, destination, start_date, end_date, status, share_token,
         trip_summary, advisories, created_at, updated_at
  FROM trips
  WHERE trips.share_token = p_token;
$$;

-- share 함수: trip_items에 sub_activities 반영
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
  verified boolean, google_place_id text, sub_activities jsonb,
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
         ti.verified, ti.google_place_id, ti.sub_activities,
         ti.created_at
  FROM trip_items ti INNER JOIN trips t ON t.id = ti.trip_id
  WHERE t.share_token = p_token ORDER BY ti.day_number, ti.order_index;
$$;
