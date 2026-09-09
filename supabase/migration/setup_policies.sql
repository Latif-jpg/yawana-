-- Security: Allow public read-only access to all tables
CREATE POLICY "Allow public read on cities" ON cities FOR SELECT USING (true);
CREATE POLICY "Allow public read on markets" ON markets FOR SELECT USING (true);
CREATE POLICY "Allow public read on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public read on prices" ON prices FOR SELECT USING (true);

-- Allow anyone to insert prices (required for the Add Price feature without full auth)
CREATE POLICY "Allow public insert on prices" ON prices FOR INSERT WITH CHECK (true);

-- Ensure RLS is enabled (already done in schema but good for safety)
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
