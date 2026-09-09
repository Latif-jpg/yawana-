ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alert_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on price_alerts" ON price_alerts;
DROP POLICY IF EXISTS "Allow public insert on price_alerts" ON price_alerts;
DROP POLICY IF EXISTS "Allow public update on price_alerts" ON price_alerts;

CREATE POLICY "Allow public read on price_alerts"
ON price_alerts FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert on price_alerts"
ON price_alerts FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update on price_alerts"
ON price_alerts FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on price_alert_actions" ON price_alert_actions;
DROP POLICY IF EXISTS "Allow public insert on price_alert_actions" ON price_alert_actions;

CREATE POLICY "Allow public read on price_alert_actions"
ON price_alert_actions FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert on price_alert_actions"
ON price_alert_actions FOR INSERT
TO public
WITH CHECK (true);
