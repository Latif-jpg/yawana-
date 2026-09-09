CREATE TABLE IF NOT EXISTS price_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    product_id UUID NOT NULL REFERENCES products(id),
    source TEXT NOT NULL DEFAULT 'market_prices',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_consultations_market_product_created_at
ON price_consultations(market_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_consultations_product_created_at
ON price_consultations(product_id, created_at DESC);

ALTER TABLE price_consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on price_consultations" ON price_consultations;
DROP POLICY IF EXISTS "Allow authenticated insert on price_consultations" ON price_consultations;

CREATE POLICY "Allow public read on price_consultations"
ON price_consultations FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated insert on price_consultations"
ON price_consultations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
