CREATE OR REPLACE FUNCTION public.prevent_profile_reward_fields_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  reward_sync_enabled TEXT := current_setting('app.reward_sync', true);
BEGIN
  IF jwt_role = 'service_role' OR reward_sync_enabled = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.points IS DISTINCT FROM OLD.points
    OR NEW.level IS DISTINCT FROM OLD.level
    OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
    OR NEW.last_reward_sync_at IS DISTINCT FROM OLD.last_reward_sync_at THEN
    RAISE EXCEPTION 'Reward fields are managed by the server';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_user_reward_summary(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  reward_user_id UUID,
  reward_price_count INTEGER,
  reward_confirmed_count INTEGER,
  reward_corrected_count INTEGER,
  reward_dismissed_count INTEGER,
  reward_contribution_points INTEGER,
  reward_confirmation_points INTEGER,
  reward_correction_points INTEGER,
  reward_focus_bonus INTEGER,
  reward_total_points INTEGER,
  reward_level INTEGER,
  reward_next_level_at INTEGER,
  reward_progress_to_next_level NUMERIC,
  reward_trust_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_caller_id UUID := auth.uid();
  v_request_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur requis pour calculer le score.';
  END IF;

  IF v_request_role <> 'service_role' AND v_caller_id IS NOT NULL AND v_caller_id <> v_user_id THEN
    RAISE EXCEPTION 'Acces refuse au resume de recompense.';
  END IF;

  RETURN QUERY
  WITH price_stats AS (
    SELECT COUNT(*)::INTEGER AS price_count
    FROM prices
    WHERE recorded_by = v_user_id
  ),
  action_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE action_type = 'confirmed')::INTEGER AS confirmed_count,
      COUNT(*) FILTER (WHERE action_type = 'updated_price')::INTEGER AS corrected_count,
      COUNT(*) FILTER (WHERE action_type = 'dismissed')::INTEGER AS dismissed_count
    FROM price_alert_actions
    WHERE price_alert_actions.user_id = v_user_id
  ),
  reward_stats AS (
    SELECT
      v_user_id AS reward_user_id,
      COALESCE(price_stats.price_count, 0) AS price_count,
      COALESCE(action_stats.confirmed_count, 0) AS confirmed_count,
      COALESCE(action_stats.corrected_count, 0) AS corrected_count,
      COALESCE(action_stats.dismissed_count, 0) AS dismissed_count
    FROM price_stats
    CROSS JOIN action_stats
  ),
  reward_points AS (
    SELECT
      reward_stats.*,
      reward_stats.price_count * 2 AS contribution_points,
      reward_stats.confirmed_count AS confirmation_points,
      reward_stats.corrected_count * 3 AS correction_points,
      GREATEST(0, LEAST(8, FLOOR(reward_stats.confirmed_count / 2.0)::INTEGER - reward_stats.dismissed_count)) AS focus_bonus
    FROM reward_stats
  ),
  reward_totals AS (
    SELECT
      reward_points.*,
      reward_points.contribution_points
        + reward_points.confirmation_points
        + reward_points.correction_points
        + reward_points.focus_bonus AS total_points
    FROM reward_points
  ),
  reward_levels AS (
    SELECT
      reward_totals.*,
      GREATEST(1, FLOOR(reward_totals.total_points / 80.0)::INTEGER + 1) AS level
    FROM reward_totals
  )
  SELECT
    reward_levels.reward_user_id,
    reward_levels.price_count,
    reward_levels.confirmed_count,
    reward_levels.corrected_count,
    reward_levels.dismissed_count,
    reward_levels.contribution_points,
    reward_levels.confirmation_points,
    reward_levels.correction_points,
    reward_levels.focus_bonus,
    reward_levels.total_points,
    reward_levels.level,
    reward_levels.level * 80 AS reward_next_level_at,
    LEAST(1, reward_levels.total_points::NUMERIC / NULLIF(reward_levels.level * 80, 0)) AS reward_progress_to_next_level,
    LEAST(
      100,
      ROUND(
        35
        + LEAST(30, reward_levels.price_count * 2)
        + LEAST(20, reward_levels.confirmed_count * 3)
        + LEAST(15, reward_levels.corrected_count * 4)
        - LEAST(10, reward_levels.dismissed_count * 2)
      )::INTEGER
    ) AS reward_trust_score
  FROM reward_levels;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_user_reward_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_user_reward_summary(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_user_reward_summary(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  reward_user_id UUID,
  reward_price_count INTEGER,
  reward_confirmed_count INTEGER,
  reward_corrected_count INTEGER,
  reward_dismissed_count INTEGER,
  reward_contribution_points INTEGER,
  reward_confirmation_points INTEGER,
  reward_correction_points INTEGER,
  reward_focus_bonus INTEGER,
  reward_total_points INTEGER,
  reward_level INTEGER,
  reward_next_level_at INTEGER,
  reward_progress_to_next_level NUMERIC,
  reward_trust_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward_row RECORD;
  guest_profile_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
  target_role TEXT := 'client';
BEGIN
  SELECT *
  INTO reward_row
  FROM public.compute_user_reward_summary(p_user_id);

  IF reward_row.reward_user_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de synchroniser le score utilisateur.';
  END IF;

  SELECT COALESCE(NULLIF(LOWER(TRIM(au.raw_user_meta_data->>'role')), ''), 'client')
  INTO target_role
  FROM auth.users au
  WHERE au.id = reward_row.reward_user_id;

  INSERT INTO profiles (id)
  VALUES (reward_row.reward_user_id)
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('app.reward_sync', 'on', true);

  UPDATE profiles
  SET role = CASE
    WHEN profiles.role IS NULL THEN target_role
    WHEN profiles.role = 'client' AND target_role <> 'client' THEN target_role
    ELSE profiles.role
  END
  WHERE id = reward_row.reward_user_id;

  UPDATE profiles
  SET
    points = reward_row.reward_total_points,
    level = reward_row.reward_level,
    trust_score = reward_row.reward_trust_score,
    last_reward_sync_at = NOW()
  WHERE id = reward_row.reward_user_id;

  IF reward_row.reward_user_id <> guest_profile_id AND reward_row.reward_price_count >= 1 THEN
    INSERT INTO user_badges (user_id, badge_id)
    SELECT reward_row.reward_user_id, id
    FROM badges
    WHERE name = 'Pionnier'
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  IF reward_row.reward_user_id <> guest_profile_id AND reward_row.reward_price_count >= 10 THEN
    INSERT INTO user_badges (user_id, badge_id)
    SELECT reward_row.reward_user_id, id
    FROM badges
    WHERE name = 'Analyste'
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  IF reward_row.reward_user_id <> guest_profile_id
    AND (reward_row.reward_confirmed_count >= 3 OR reward_row.reward_corrected_count >= 2) THEN
    INSERT INTO user_badges (user_id, badge_id)
    SELECT reward_row.reward_user_id, id
    FROM badges
    WHERE name = 'Sentinelle'
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT
    reward_row.reward_user_id,
    reward_row.reward_price_count,
    reward_row.reward_confirmed_count,
    reward_row.reward_corrected_count,
    reward_row.reward_dismissed_count,
    reward_row.reward_contribution_points,
    reward_row.reward_confirmation_points,
    reward_row.reward_correction_points,
    reward_row.reward_focus_bonus,
    reward_row.reward_total_points,
    reward_row.reward_level,
    reward_row.reward_next_level_at,
    reward_row.reward_progress_to_next_level,
    reward_row.reward_trust_score;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_reward_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_user_reward_summary(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_rewards_from_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_user_id UUID;
  v_old_user_id UUID;
BEGIN
  v_new_user_id := CASE
    WHEN TG_OP = 'DELETE' THEN NULL
    ELSE NEW.recorded_by
  END;
  v_old_user_id := CASE
    WHEN TG_OP = 'INSERT' THEN NULL
    ELSE OLD.recorded_by
  END;

  IF v_new_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.sync_user_reward_summary(v_new_user_id);
  END IF;

  IF v_old_user_id IS NOT NULL AND v_old_user_id IS DISTINCT FROM v_new_user_id THEN
    PERFORM 1 FROM public.sync_user_reward_summary(v_old_user_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_rewards_from_alert_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_user_id UUID;
  v_old_user_id UUID;
BEGIN
  v_new_user_id := CASE
    WHEN TG_OP = 'DELETE' THEN NULL
    ELSE NEW.user_id
  END;
  v_old_user_id := CASE
    WHEN TG_OP = 'INSERT' THEN NULL
    ELSE OLD.user_id
  END;

  IF v_new_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.sync_user_reward_summary(v_new_user_id);
  END IF;

  IF v_old_user_id IS NOT NULL AND v_old_user_id IS DISTINCT FROM v_new_user_id THEN
    PERFORM 1 FROM public.sync_user_reward_summary(v_old_user_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rewards_from_prices ON prices;
CREATE TRIGGER trg_sync_rewards_from_prices
AFTER INSERT OR DELETE OR UPDATE OF recorded_by ON prices
FOR EACH ROW
EXECUTE FUNCTION public.sync_rewards_from_prices();

DROP TRIGGER IF EXISTS trg_sync_rewards_from_alert_actions ON price_alert_actions;
CREATE TRIGGER trg_sync_rewards_from_alert_actions
AFTER INSERT OR DELETE OR UPDATE OF user_id, action_type ON price_alert_actions
FOR EACH ROW
EXECUTE FUNCTION public.sync_rewards_from_alert_actions();

WITH reward_users AS (
  SELECT id AS target_user_id FROM profiles
  UNION
  SELECT recorded_by AS target_user_id FROM prices WHERE recorded_by IS NOT NULL
  UNION
  SELECT user_id AS target_user_id FROM price_alert_actions WHERE user_id IS NOT NULL
)
SELECT public.sync_user_reward_summary(reward_users.target_user_id)
FROM reward_users;
