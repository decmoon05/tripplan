-- 위험한 공유 RLS 정책 제거 (share_token IS NOT NULL → 모든 공유 trip 무차별 노출)
DROP POLICY IF EXISTS "Anyone can view shared trips" ON public.trips;
DROP POLICY IF EXISTS "Anyone can view items of shared trips" ON public.trip_items;

-- 공유 조회는 SECURITY DEFINER 함수로 처리 (RLS 우회, user_id 제외)
CREATE OR REPLACE FUNCTION get_trip_by_share_token(p_token text)
RETURNS TABLE (
  id uuid,
  destination text,
  start_date date,
  end_date date,
  status text,
  share_token text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, destination, start_date, end_date, status, share_token, created_at, updated_at
  FROM trips
  WHERE trips.share_token = p_token;
$$;

CREATE OR REPLACE FUNCTION get_trip_items_by_share_token(p_token text)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  day_number integer,
  order_index integer,
  place_id text,
  place_name_snapshot text,
  category text,
  start_time text,
  end_time text,
  estimated_cost integer,
  notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.id, ti.trip_id, ti.day_number, ti.order_index, ti.place_id,
         ti.place_name_snapshot, ti.category, ti.start_time, ti.end_time,
         ti.estimated_cost, ti.notes, ti.latitude, ti.longitude, ti.created_at
  FROM trip_items ti
  INNER JOIN trips t ON t.id = ti.trip_id
  WHERE t.share_token = p_token
  ORDER BY ti.day_number, ti.order_index;
$$;
