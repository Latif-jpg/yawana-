ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_market_id UUID REFERENCES markets(id),
  ADD COLUMN IF NOT EXISTS last_location_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_verified_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
