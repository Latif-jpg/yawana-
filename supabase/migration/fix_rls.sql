-- Fix RLS for Products to allow contributors to add new items
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read on products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to insert products" ON products;

-- Allow everyone to read products
CREATE POLICY "Allow public read on products"
ON products FOR SELECT
TO public
USING (true);

-- Allow authenticated users to insert new products
CREATE POLICY "Allow authenticated users to insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure correct RLS for Prices
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on prices" ON prices;
DROP POLICY IF EXISTS "Allow authenticated users to insert prices" ON prices;

CREATE POLICY "Allow public read on prices"
ON prices FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert prices"
ON prices FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = recorded_by);

-- Ensure correct RLS for Markets (for Crowdsourced Market Creation)
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on markets" ON markets;
DROP POLICY IF EXISTS "Allow authenticated users to insert markets" ON markets;

CREATE POLICY "Allow public read on markets"
ON markets FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert markets"
ON markets FOR INSERT
TO authenticated
WITH CHECK (true);

-- Relax market_type constraint to allow custom types
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_market_type_check;
ALTER TABLE markets ADD CONSTRAINT markets_market_type_check 
CHECK (market_type IN ('physical', 'street', 'mall', 'Général', 'Boutique', 'Marché'));
