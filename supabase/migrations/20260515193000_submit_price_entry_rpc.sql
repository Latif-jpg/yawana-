CREATE OR REPLACE FUNCTION public.submit_price_entry(
  p_product_id UUID,
  p_market_id UUID,
  p_price_value NUMERIC,
  p_quantity NUMERIC,
  p_submission_hash TEXT,
  p_shop_id UUID DEFAULT NULL
)
RETURNS prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_inserted_row prices%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour envoyer un releve de prix.';
  END IF;

  INSERT INTO prices (
    product_id,
    market_id,
    price_value,
    quantity,
    shop_id,
    recorded_by,
    submission_hash
  )
  VALUES (
    p_product_id,
    p_market_id,
    p_price_value,
    p_quantity,
    p_shop_id,
    v_user_id,
    p_submission_hash
  )
  RETURNING *
  INTO v_inserted_row;

  RETURN v_inserted_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_price_entry(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_price_entry(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
