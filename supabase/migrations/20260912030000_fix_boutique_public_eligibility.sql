-- Source unique de vérité pour l'éligibilité marketplace.
-- Les compteurs calculés à la volée évitent qu'un profil reste invisible
-- pour les autres utilisateurs lorsque ses compteurs dénormalisés sont en retard.
CREATE OR REPLACE FUNCTION public.is_market_seller_eligible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = p_user_id
      AND (
        COALESCE(p.verified_market_badge, false) = true
        OR LOWER(COALESCE(p.market_access_tier, '')) = 'verified'
        OR (
          p.city_id IS NOT NULL
          AND COALESCE(p.trust_score, 0) >= 60
          AND (
            SELECT COUNT(*)
            FROM prices pr
            WHERE pr.recorded_by = p.id
          ) >= 10
          AND (
            (
              SELECT COUNT(*)
              FROM price_alert_actions pa
              WHERE pa.user_id = p.id
                AND pa.action_type = 'confirmed'
            ) >= 3
            OR (
              SELECT COUNT(*)
              FROM price_alert_actions pa
              WHERE pa.user_id = p.id
                AND pa.action_type = 'updated_price'
            ) >= 2
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_market_seller_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_market_seller_eligible(uuid) TO authenticated;

DROP POLICY IF EXISTS "Owners and eligible visible boutique items can be read" ON boutique_items;
CREATE POLICY "Owners and eligible visible boutique items can be read"
ON boutique_items FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR (
    COALESCE(is_visible_in_search, false) = true
    AND public.is_market_seller_eligible(owner_id)
  )
);

-- Republie les articles qui étaient restés masqués alors que le vendeur est
-- désormais éligible selon les données réelles.
UPDATE boutique_items bi
SET is_visible_in_search = true
WHERE COALESCE(bi.is_visible_in_search, false) = false
  AND public.is_market_seller_eligible(bi.owner_id);

NOTIFY pgrst, 'reload schema';
