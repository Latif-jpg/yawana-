DROP POLICY IF EXISTS "Allow public insert on prices" ON prices;

DROP POLICY IF EXISTS "Allow authenticated insert" ON shops;

CREATE POLICY "Allow authenticated insert on shops"
ON shops FOR INSERT
TO authenticated
WITH CHECK (true);
