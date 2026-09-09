ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

DROP POLICY IF EXISTS "Allow public insert on price_alerts" ON price_alerts;
DROP POLICY IF EXISTS "Allow public update on price_alerts" ON price_alerts;
DROP POLICY IF EXISTS "Allow public read on price_alert_actions" ON price_alert_actions;
DROP POLICY IF EXISTS "Allow public insert on price_alert_actions" ON price_alert_actions;

CREATE POLICY "Allow own alert actions read"
ON price_alert_actions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow own alert actions insert"
ON price_alert_actions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP INDEX IF EXISTS idx_prices_submission_hash;

CREATE INDEX IF NOT EXISTS idx_prices_submission_hash
ON prices(submission_hash)
WHERE submission_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_recent_duplicate_price_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.submission_hash IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM prices
    WHERE submission_hash = NEW.submission_hash
      AND created_at >= NOW() - INTERVAL '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Ce prix semble deja avoir ete envoye recemment pour ce produit dans ce marche.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_recent_duplicate_price_submission ON prices;

CREATE TRIGGER trg_prevent_recent_duplicate_price_submission
BEFORE INSERT ON prices
FOR EACH ROW
EXECUTE FUNCTION prevent_recent_duplicate_price_submission();

CREATE OR REPLACE FUNCTION prevent_profile_reward_fields_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.points IS DISTINCT FROM OLD.points
    OR NEW.level IS DISTINCT FROM OLD.level
    OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
    OR NEW.last_reward_sync_at IS DISTINCT FROM OLD.last_reward_sync_at THEN
    RAISE EXCEPTION 'Reward fields are managed by the server';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_reward_fields_update ON profiles;

CREATE TRIGGER trg_prevent_profile_reward_fields_update
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_profile_reward_fields_update();
