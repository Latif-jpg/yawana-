ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS market_access_tier TEXT DEFAULT 'reliable',
  ADD COLUMN IF NOT EXISTS verified_market_badge BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_market_badge_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS price_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_action_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrected_action_count INTEGER DEFAULT 0;

-- Cette mise à jour est redondante si la migration 20260610001000_market_visibility_tiers.sql a déjà été appliquée,
-- mais elle assure l'idempotence.
UPDATE profiles
SET market_access_tier = COALESCE(market_access_tier, 'reliable'),
    verified_market_badge = COALESCE(verified_market_badge, FALSE)
WHERE market_access_tier IS NULL
   OR verified_market_badge IS NULL;

DROP POLICY IF EXISTS "Owners and visible boutique items can be read" ON boutique_items;
DROP POLICY IF EXISTS "Owners and eligible visible boutique items can be read" ON boutique_items;

CREATE POLICY "Owners and eligible visible boutique items can be read"
ON boutique_items FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR (
    COALESCE(boutique_items.is_visible_in_search, false) = true
    AND EXISTS (
      SELECT 1
      FROM profiles sp
      WHERE sp.id = boutique_items.owner_id
        AND (
          COALESCE(sp.verified_market_badge, false) = true
          OR LOWER(COALESCE(sp.market_access_tier, '')) = 'verified'
          OR (
            sp.city_id IS NOT NULL
            AND COALESCE(sp.trust_score, 0) >= 60
            AND COALESCE(sp.price_count, 0) >= 10
            AND (COALESCE(sp.confirmed_action_count, 0) >= 3 OR COALESCE(sp.corrected_action_count, 0) >= 2)
          )
        )
    )
  )
);

-- Function to update profile counts
CREATE OR REPLACE FUNCTION public.sync_profile_contribution_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_user_id := CASE TG_TABLE_NAME
      WHEN 'prices' THEN OLD.recorded_by
      WHEN 'price_alert_actions' THEN OLD.user_id
    END;
  ELSE
    v_user_id := CASE TG_TABLE_NAME
      WHEN 'prices' THEN NEW.recorded_by
      WHEN 'price_alert_actions' THEN NEW.user_id
    END;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE profiles
  SET
    price_count = (SELECT COUNT(*) FROM prices WHERE recorded_by = v_user_id),
    confirmed_action_count = (SELECT COUNT(*) FROM price_alert_actions WHERE user_id = v_user_id AND action_type = 'confirmed'),
    corrected_action_count = (SELECT COUNT(*) FROM price_alert_actions WHERE user_id = v_user_id AND action_type = 'updated_price')
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$;

-- Triggers to keep counts updated
DROP TRIGGER IF EXISTS trg_sync_profile_counts_from_prices ON prices;
CREATE TRIGGER trg_sync_profile_counts_from_prices
AFTER INSERT OR UPDATE OF recorded_by OR DELETE ON prices
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_contribution_counts();

DROP TRIGGER IF EXISTS trg_sync_profile_counts_from_actions ON price_alert_actions;
CREATE TRIGGER trg_sync_profile_counts_from_actions
AFTER INSERT OR UPDATE OF user_id, action_type OR DELETE ON price_alert_actions
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_contribution_counts();

-- Backfill existing counts
UPDATE profiles
SET
  price_count = (SELECT COUNT(*) FROM prices WHERE recorded_by = profiles.id),
  confirmed_action_count = (SELECT COUNT(*) FROM price_alert_actions WHERE user_id = profiles.id AND action_type = 'confirmed'),
  corrected_action_count = (SELECT COUNT(*) FROM price_alert_actions WHERE user_id = profiles.id AND action_type = 'updated_price');

CREATE INDEX IF NOT EXISTS prices_recorded_by_idx
  ON prices (recorded_by);

CREATE INDEX IF NOT EXISTS price_alert_actions_user_action_idx
  ON price_alert_actions (user_id, action_type);

NOTIFY pgrst, 'reload schema';
