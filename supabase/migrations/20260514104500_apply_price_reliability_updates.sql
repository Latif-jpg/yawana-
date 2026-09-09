CREATE OR REPLACE FUNCTION public.apply_price_reliability_updates(p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_count INTEGER := 0;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates must be a JSON array';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE prices
    SET reliability_status = COALESCE(v_item->>'reliability_status', reliability_status),
        reliability_score = COALESCE((v_item->>'reliability_score')::DECIMAL, reliability_score),
        validation_note = v_item->>'validation_note',
        verified_at = CASE
          WHEN v_item ? 'verified_at' AND (v_item->>'verified_at') IS NOT NULL AND (v_item->>'verified_at') <> ''
            THEN (v_item->>'verified_at')::TIMESTAMPTZ
          ELSE NULL
        END,
        is_verified = COALESCE((v_item->>'is_verified')::BOOLEAN, is_verified)
    WHERE id = (v_item->>'id')::UUID;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_price_reliability_updates(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_price_reliability_updates(JSONB) TO authenticated, service_role;
