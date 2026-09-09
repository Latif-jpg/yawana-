ALTER TABLE external_price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on external_price_sources" ON external_price_sources;
DROP POLICY IF EXISTS "Allow authenticated insert on external_price_sources" ON external_price_sources;
DROP POLICY IF EXISTS "Allow authenticated update on external_price_sources" ON external_price_sources;

CREATE POLICY "Allow public read on external_price_sources"
ON external_price_sources FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated insert on external_price_sources"
ON external_price_sources FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on external_price_sources"
ON external_price_sources FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on market_price_snapshots" ON market_price_snapshots;
DROP POLICY IF EXISTS "Allow authenticated insert on market_price_snapshots" ON market_price_snapshots;
DROP POLICY IF EXISTS "Allow authenticated update on market_price_snapshots" ON market_price_snapshots;

CREATE POLICY "Allow public read on market_price_snapshots"
ON market_price_snapshots FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated insert on market_price_snapshots"
ON market_price_snapshots FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on market_price_snapshots"
ON market_price_snapshots FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on price_flags" ON price_flags;
DROP POLICY IF EXISTS "Allow authenticated insert on price_flags" ON price_flags;
DROP POLICY IF EXISTS "Allow authenticated update on price_flags" ON price_flags;

CREATE POLICY "Allow public read on price_flags"
ON price_flags FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated insert on price_flags"
ON price_flags FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on price_flags"
ON price_flags FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
