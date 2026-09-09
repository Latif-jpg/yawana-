ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS market_access_tier TEXT DEFAULT 'reliable';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verified_market_badge BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verified_market_badge_at TIMESTAMP WITH TIME ZONE;

UPDATE profiles
SET market_access_tier = COALESCE(market_access_tier, 'reliable')
WHERE market_access_tier IS NULL;

UPDATE profiles
SET verified_market_badge = COALESCE(verified_market_badge, FALSE)
WHERE verified_market_badge IS NULL;

UPDATE profiles
SET market_access_tier = 'verified'
WHERE verified_market_badge = TRUE;

NOTIFY pgrst, 'reload schema';
