-- Nettoyage de l'ancienne version avec paramètre (qui causait l'erreur 42883)
DROP FUNCTION IF EXISTS public.get_dashboard_summary(INT);

-- Fonction RPC pour calculer le sommaire du tableau de bord directement en base
-- Cette version ne prend aucun paramètre pour éviter les erreurs de mapping PostgREST

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS TABLE (
  product_id UUID,
  market_id UUID,
  product_name TEXT,
  product_category TEXT,
  product_unit TEXT,
  market_name TEXT,
  city_id UUID,
  latest_price NUMERIC,
  previous_price NUMERIC,
  change_percent NUMERIC,
  trend NUMERIC[],
  shop_name TEXT,
  shop_verified BOOLEAN,
  seller_id UUID,
  shop_trust_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH raw_recent AS (
    SELECT * FROM prices ORDER BY created_at DESC LIMIT 200
  ),
  recent_prices AS (
    SELECT 
      p.product_id,
      p.market_id,
      p.price_value,
      p.created_at,
      p.recorded_by,
      p.shop_id,
      ROW_NUMBER() OVER (PARTITION BY p.product_id, p.market_id ORDER BY p.created_at DESC) as rn
    FROM raw_recent p
  ),
  grouped_prices AS (
    SELECT 
      rp.product_id,
      rp.market_id,
      MAX(CASE WHEN rp.rn = 1 THEN rp.price_value END) as latest_price,
      MAX(CASE WHEN rp.rn = 2 THEN rp.price_value END) as previous_price,
      (MAX(CASE WHEN rp.rn = 1 THEN rp.shop_id::TEXT END))::UUID as latest_shop_id,
      (MAX(CASE WHEN rp.rn = 1 THEN rp.recorded_by::TEXT END))::UUID as latest_recorded_by,
      (
        SELECT array_agg(sub.price_value ORDER BY sub.created_at ASC)
        FROM recent_prices sub
        WHERE sub.product_id = rp.product_id AND sub.market_id = rp.market_id AND sub.rn <= 10
      ) as trend
    FROM recent_prices rp
    GROUP BY rp.product_id, rp.market_id
  )
  SELECT 
    gp.product_id,
    gp.market_id,
    prod.name::TEXT as product_name,
    prod.category::TEXT as product_category,
    prod.unit::TEXT as product_unit,
    m.name::TEXT as market_name,
    m.city_id,
    gp.latest_price,
    gp.previous_price,
    CASE 
      WHEN gp.previous_price IS NOT NULL AND gp.previous_price > 0 
      THEN ((gp.latest_price - gp.previous_price) / gp.previous_price) * 100 
      ELSE NULL 
    END as change_percent,
    gp.trend,
    s.name::TEXT as shop_name,
    COALESCE(s.is_verified, FALSE) as shop_verified,
    COALESCE(s.owner_id, gp.latest_recorded_by) as seller_id,
    s.trust_score as shop_trust_score
  FROM grouped_prices gp
  JOIN products prod ON gp.product_id = prod.id
  JOIN markets m ON gp.market_id = m.id
  LEFT JOIN shops s ON gp.latest_shop_id = s.id
  ORDER BY 
    ABS(CASE 
      WHEN gp.previous_price IS NOT NULL AND gp.previous_price > 0 
      THEN ((gp.latest_price - gp.previous_price) / gp.previous_price) * 100 
      ELSE 0 
    END) DESC;
END;
$$;

-- Autoriser l'application à exécuter cette fonction
REVOKE ALL ON FUNCTION public.get_dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary() TO anon;

-- Forcer l'API de Supabase à se mettre à jour immédiatement
NOTIFY pgrst, 'reload schema';
