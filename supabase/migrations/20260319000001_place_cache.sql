-- place_cache: Google Places place_id 인덱스 (ToS 준수 — place_id만 저장)
CREATE TABLE IF NOT EXISTS public.place_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  category text NOT NULL,
  google_place_id text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(destination, google_place_id)
);

CREATE INDEX idx_place_cache_dest_cat ON public.place_cache(destination, category);
CREATE INDEX idx_place_cache_expires ON public.place_cache(expires_at);

-- RLS
ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_cache_select" ON public.place_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "place_cache_insert" ON public.place_cache
  FOR INSERT TO authenticated
  WITH CHECK (
    google_place_id IS NOT NULL
    AND length(destination) <= 100
  );

CREATE POLICY "place_cache_no_update" ON public.place_cache
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "place_cache_no_delete" ON public.place_cache
  FOR DELETE TO authenticated USING (false);
