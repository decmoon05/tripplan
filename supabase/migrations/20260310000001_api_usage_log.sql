-- API 사용량 추적 테이블
CREATE TABLE IF NOT EXISTS api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스: user_id + created_at로 일별 조회 최적화
CREATE INDEX idx_api_usage_user_date ON api_usage_log (user_id, created_at DESC);

-- RLS 정책
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON api_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON api_usage_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
