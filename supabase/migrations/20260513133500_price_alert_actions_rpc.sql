CREATE OR REPLACE FUNCTION public.act_on_price_alert(
  p_alert_id UUID,
  p_action_type TEXT
)
RETURNS TABLE (
  action_recorded BOOLEAN,
  alert_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_next_status TEXT;
  v_action_inserted BOOLEAN := FALSE;
  v_row_count BIGINT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour agir sur une alerte.';
  END IF;

  IF p_action_type NOT IN ('viewed', 'confirmed', 'dismissed', 'updated_price') THEN
    RAISE EXCEPTION 'Type d action invalide: %', p_action_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM price_alerts
    WHERE id = p_alert_id
  ) THEN
    RAISE EXCEPTION 'Alerte introuvable.';
  END IF;

  INSERT INTO price_alert_actions (alert_id, user_id, action_type)
  VALUES (p_alert_id, v_user_id, p_action_type)
  ON CONFLICT (alert_id, user_id, action_type) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_action_inserted := v_row_count > 0;

  v_next_status := CASE
    WHEN p_action_type = 'dismissed' THEN 'dismissed'
    WHEN p_action_type IN ('confirmed', 'updated_price') THEN 'resolved'
    ELSE NULL
  END;

  IF v_next_status IS NOT NULL THEN
    UPDATE price_alerts
    SET status = v_next_status,
        updated_at = NOW()
    WHERE id = p_alert_id;
  END IF;

  RETURN QUERY
  SELECT
    v_action_inserted,
    COALESCE(v_next_status, (SELECT status FROM price_alerts WHERE id = p_alert_id));
END;
$$;

REVOKE ALL ON FUNCTION public.act_on_price_alert(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.act_on_price_alert(UUID, TEXT) TO authenticated;
