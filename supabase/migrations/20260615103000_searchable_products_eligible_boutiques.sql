DROP FUNCTION IF EXISTS public.searchable_products();

CREATE FUNCTION public.searchable_products()
RETURNS TABLE (
  id text,
  resolved_product_id uuid,
  boutique_item_id uuid,
  owner_id uuid,
  seller_full_name text,
  seller_trust_score numeric,
  seller_market_access_tier text,
  seller_verified_market_badge boolean,
  name text,
  category text,
  unit text,
  image_url text,
  price_value numeric,
  source text,
  is_visible_in_search boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_catalog_count integer := 0;
  v_boutique_visible_count integer := 0;
  v_boutique_eligible_count integer := 0;
  v_result_count integer := 0;
BEGIN
  SELECT count(*) INTO v_catalog_count FROM products;

  SELECT count(*) INTO v_boutique_visible_count
  FROM boutique_items bi
  WHERE COALESCE(bi.is_visible_in_search, false) = TRUE;

  SELECT count(*) INTO v_boutique_eligible_count
  FROM boutique_items bi
  LEFT JOIN profiles sp
    ON sp.id = bi.owner_id
  LEFT JOIN (
    SELECT recorded_by AS user_id, COUNT(*)::integer AS price_count
    FROM prices
    WHERE recorded_by IS NOT NULL
    GROUP BY recorded_by
  ) ps
    ON ps.user_id = bi.owner_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE action_type = 'confirmed')::integer AS confirmed_count,
      COUNT(*) FILTER (WHERE action_type = 'updated_price')::integer AS corrected_count
    FROM price_alert_actions
    GROUP BY user_id
  ) pas
    ON pas.user_id = bi.owner_id
  WHERE COALESCE(bi.is_visible_in_search, false) = TRUE
    AND (
      COALESCE(sp.verified_market_badge, false) = TRUE
      OR LOWER(COALESCE(sp.market_access_tier, '')) = 'verified'
      OR (
        sp.city_id IS NOT NULL
        AND COALESCE(ps.price_count, 0) >= 10
        AND COALESCE(sp.trust_score, 0) >= 60
        AND (
          COALESCE(pas.confirmed_count, 0) >= 3
          OR COALESCE(pas.corrected_count, 0) >= 2
        )
      )
    );

  v_result_count := v_catalog_count + v_boutique_eligible_count;

  BEGIN
    INSERT INTO public.search_debug_logs (
      user_id,
      stage,
      payload
    )
    VALUES (
      v_user_id,
      CASE WHEN v_result_count > 0 THEN 'rpc_success' ELSE 'empty_result' END,
      jsonb_build_object(
        'userId', v_user_id,
        'catalogCount', v_catalog_count,
        'boutiqueVisibleCount', v_boutique_visible_count,
        'boutiqueEligibleCount', v_boutique_eligible_count,
        'resultCount', v_result_count,
        'usedFallback', false
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN QUERY
  SELECT
    p.id::text AS id,
    p.id AS resolved_product_id,
    NULL::uuid AS boutique_item_id,
    NULL::uuid AS owner_id,
    NULL::text AS seller_full_name,
    NULL::numeric AS seller_trust_score,
    NULL::text AS seller_market_access_tier,
    NULL::boolean AS seller_verified_market_badge,
    p.name,
    p.category,
    p.unit,
    p.image_url,
    NULL::numeric AS price_value,
    'catalog'::text AS source,
    TRUE AS is_visible_in_search,
    p.created_at
  FROM products p

  UNION ALL

  SELECT
    COALESCE(bi.product_id::text, ('boutique-' || bi.id::text)) AS id,
    bi.product_id AS resolved_product_id,
    bi.id AS boutique_item_id,
    bi.owner_id,
    sp.full_name AS seller_full_name,
    COALESCE(sp.trust_score, 0)::numeric AS seller_trust_score,
    sp.market_access_tier AS seller_market_access_tier,
    sp.verified_market_badge AS seller_verified_market_badge,
    bi.label AS name,
    bi.category,
    bi.unit,
    bi.image_url,
    bi.price_value,
    'boutique'::text AS source,
    TRUE AS is_visible_in_search,
    bi.created_at
  FROM boutique_items bi
  LEFT JOIN profiles sp
    ON sp.id = bi.owner_id
  LEFT JOIN (
    SELECT recorded_by AS user_id, COUNT(*)::integer AS price_count
    FROM prices
    WHERE recorded_by IS NOT NULL
    GROUP BY recorded_by
  ) ps
    ON ps.user_id = bi.owner_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE action_type = 'confirmed')::integer AS confirmed_count,
      COUNT(*) FILTER (WHERE action_type = 'updated_price')::integer AS corrected_count
    FROM price_alert_actions
    GROUP BY user_id
  ) pas
    ON pas.user_id = bi.owner_id
  WHERE COALESCE(bi.is_visible_in_search, false) = TRUE
    AND (
      COALESCE(sp.verified_market_badge, false) = TRUE
      OR LOWER(COALESCE(sp.market_access_tier, '')) = 'verified'
      OR (
        sp.city_id IS NOT NULL
        AND COALESCE(ps.price_count, 0) >= 10
        AND COALESCE(sp.trust_score, 0) >= 60
        AND (
          COALESCE(pas.confirmed_count, 0) >= 3
          OR COALESCE(pas.corrected_count, 0) >= 2
        )
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.searchable_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.searchable_products() TO authenticated;

NOTIFY pgrst, 'reload schema';
