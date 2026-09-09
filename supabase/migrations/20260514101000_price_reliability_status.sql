ALTER TABLE prices
ADD COLUMN IF NOT EXISTS reliability_status TEXT NOT NULL DEFAULT 'pending'
CHECK (reliability_status IN ('pending', 'confirmed', 'conflicted', 'trusted'));

ALTER TABLE prices
ADD COLUMN IF NOT EXISTS reliability_score DECIMAL NOT NULL DEFAULT 0.35
CHECK (reliability_score >= 0 AND reliability_score <= 1);

ALTER TABLE prices
ADD COLUMN IF NOT EXISTS validation_note TEXT;

ALTER TABLE prices
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

UPDATE prices
SET reliability_status = COALESCE(reliability_status, 'pending'),
    reliability_score = COALESCE(reliability_score, 0.35)
WHERE reliability_status IS NULL
   OR reliability_score IS NULL;

CREATE INDEX IF NOT EXISTS idx_prices_product_market_reliability
ON prices(product_id, market_id, reliability_status, created_at DESC);
