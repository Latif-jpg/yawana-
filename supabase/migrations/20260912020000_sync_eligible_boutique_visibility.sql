-- Publie automatiquement les articles d'une boutique lorsque son propriétaire
-- atteint les critères d'éligibilité du marketplace.
CREATE OR REPLACE FUNCTION public.sync_eligible_boutique_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    COALESCE(NEW.verified_market_badge, false) = true
    OR LOWER(COALESCE(NEW.market_access_tier, '')) = 'verified'
    OR (
      NEW.city_id IS NOT NULL
      AND COALESCE(NEW.trust_score, 0) >= 60
      AND COALESCE(NEW.price_count, 0) >= 10
      AND (
        COALESCE(NEW.confirmed_action_count, 0) >= 3
        OR COALESCE(NEW.corrected_action_count, 0) >= 2
      )
    )
  ) THEN
    UPDATE boutique_items
    SET is_visible_in_search = true
    WHERE owner_id = NEW.id
      AND COALESCE(is_visible_in_search, false) = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_eligible_boutique_visibility ON profiles;
CREATE TRIGGER trg_sync_eligible_boutique_visibility
AFTER INSERT OR UPDATE OF city_id, trust_score, price_count,
  confirmed_action_count, corrected_action_count,
  market_access_tier, verified_market_badge
ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_eligible_boutique_visibility();

-- Corrige également les comptes déjà éligibles avant l'installation du trigger.
UPDATE boutique_items bi
SET is_visible_in_search = true
FROM profiles p
WHERE p.id = bi.owner_id
  AND COALESCE(bi.is_visible_in_search, false) = false
  AND (
    COALESCE(p.verified_market_badge, false) = true
    OR LOWER(COALESCE(p.market_access_tier, '')) = 'verified'
    OR (
      p.city_id IS NOT NULL
      AND COALESCE(p.trust_score, 0) >= 60
      AND COALESCE(p.price_count, 0) >= 10
      AND (
        COALESCE(p.confirmed_action_count, 0) >= 3
        OR COALESCE(p.corrected_action_count, 0) >= 2
      )
    )
  );

NOTIFY pgrst, 'reload schema';
