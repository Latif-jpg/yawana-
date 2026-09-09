CREATE OR REPLACE FUNCTION public.searchable_products()
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
  v_boutique_owned_count integer := 0;
  v_result_count integer := 0;
BEGIN
  SELECT count(*) INTO v_catalog_count FROM products;
  SELECT count(*) INTO v_boutique_visible_count
  FROM boutique_items bi
  WHERE bi.is_visible_in_search = TRUE;
  SELECT count(*) INTO v_boutique_owned_count FROM boutique_items WHERE owner_id = v_user_id;

  SELECT count(*) INTO v_result_count
  FROM (
    SELECT p.id::text AS id
    FROM products p

    UNION ALL

    SELECT COALESCE(bi.product_id::text, ('boutique-' || bi.id::text)) AS id
    FROM boutique_items bi
    WHERE bi.owner_id = v_user_id
       OR COALESCE(bi.is_visible_in_search, false) = TRUE
  ) combined_rows;

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
        'boutiqueOwnedCount', v_boutique_owned_count,
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
    sp.trust_score AS seller_trust_score,
    sp.market_access_tier AS seller_market_access_tier,
    sp.verified_market_badge AS seller_verified_market_badge,
    bi.label AS name,
    bi.category,
    bi.unit,
    bi.image_url,
    bi.price_value,
    'boutique'::text AS source,
    bi.is_visible_in_search,
    bi.created_at
  FROM boutique_items bi
  LEFT JOIN profiles sp
    ON sp.id = bi.owner_id
  WHERE bi.owner_id = v_user_id
     OR COALESCE(bi.is_visible_in_search, false) = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.searchable_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.searchable_products() TO authenticated;

CREATE INDEX IF NOT EXISTS boutique_items_owner_visible_created_idx
  ON boutique_items (owner_id, is_visible_in_search, created_at DESC);

NOTIFY pgrst, 'reload schema';
