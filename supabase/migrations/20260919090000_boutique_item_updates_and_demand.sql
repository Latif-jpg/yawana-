ALTER TABLE public.boutique_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.boutique_items
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_boutique_item_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boutique_items_set_updated_at ON public.boutique_items;
CREATE TRIGGER boutique_items_set_updated_at
BEFORE UPDATE ON public.boutique_items
FOR EACH ROW EXECUTE FUNCTION public.set_boutique_item_updated_at();

CREATE INDEX IF NOT EXISTS boutique_items_owner_updated_idx
ON public.boutique_items (owner_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.get_product_consultation_counts(p_product_ids UUID[])
RETURNS TABLE(product_id UUID, consultation_count BIGINT)
LANGUAGE SQL
STABLE
SECURITY INVOKER
AS $$
  SELECT pc.product_id, COUNT(*)::BIGINT
  FROM public.price_consultations pc
  WHERE pc.product_id = ANY(p_product_ids)
  GROUP BY pc.product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_consultation_counts(UUID[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
