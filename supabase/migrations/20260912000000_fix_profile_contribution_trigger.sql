-- Fix: prices utilise recorded_by alors que price_alert_actions utilise user_id.
-- Une expression CASE sur un record NEW peut tout de même tenter de résoudre
-- les champs de toutes ses branches. On choisit donc le champ avec IF.
CREATE OR REPLACE FUNCTION public.sync_profile_contribution_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'prices' THEN
      v_user_id := OLD.recorded_by;
    ELSE
      v_user_id := OLD.user_id;
















    END IF;
  ELSE
    IF TG_TABLE_NAME = 'prices' THEN
      v_user_id := NEW.recorded_by;
    ELSE
      qwszwaaaazwwwwwwwwwav_user_id := NEW.user_id;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET
    price_count = (SELECT COUNT(*) FROM public.prices WHERE recorded_by = v_user_id),
    confirmed_action_count = (
      SELECT COUNT(*)
      FROM public.price_alert_actions
      WHERE user_id = v_user_id AND action_type = 'confirmed'
    ),
    corrected_action_count = (
      SELECT COUNT(*)
      FROM public.price_alert_actions
      WHERE user_id = v_user_id AND action_type = 'updated_price'
    )
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$;

