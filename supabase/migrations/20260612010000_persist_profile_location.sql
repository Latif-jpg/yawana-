ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_market_id UUID REFERENCES markets(id),
  ADD COLUMN IF NOT EXISTS last_location_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_verified_at TIMESTAMPTZ;

WITH latest_market_per_user AS (
  SELECT DISTINCT ON (recorded_by)
    recorded_by AS user_id,
    market_id,
    created_at
  FROM prices
  WHERE recorded_by IS NOT NULL
    AND market_id IS NOT NULL
  ORDER BY recorded_by, created_at DESC
)
UPDATE profiles p
SET preferred_market_id = COALESCE(p.preferred_market_id, l.market_id),
    last_location_verified_at = COALESCE(p.last_location_verified_at, l.created_at)
FROM latest_market_per_user l
WHERE p.id = l.user_id;
