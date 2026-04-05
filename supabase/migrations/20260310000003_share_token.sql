-- trips에 공유 토큰 컬럼 추가
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- 공유 토큰으로 조회 가능하도록 RLS 정책 추가
CREATE POLICY "Anyone can view shared trips"
  ON public.trips FOR SELECT
  USING (share_token IS NOT NULL);

CREATE POLICY "Anyone can view items of shared trips"
  ON public.trip_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_items.trip_id
      AND trips.share_token IS NOT NULL
    )
  );
