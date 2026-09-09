DROP POLICY IF EXISTS "Allow authenticated users to insert prices" ON prices;
DROP POLICY IF EXISTS "Allow authenticated insert on prices" ON prices;

CREATE POLICY "Allow authenticated users to insert prices"
ON prices FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = recorded_by);

NOTIFY pgrst, 'reload schema';
