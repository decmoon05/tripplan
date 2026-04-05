-- trip_items에 통화 코드 및 가격 신뢰도 컬럼 추가
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS price_confidence text NOT NULL DEFAULT 'estimated'
    CHECK (price_confidence IN ('confirmed', 'estimated'));
