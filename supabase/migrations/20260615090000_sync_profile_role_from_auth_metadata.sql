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
  target_full_name TEXT := NULL;
  target_phone TEXT := NULL;
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

  SELECT
    COALESCE(
      NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
      NULLIF(SPLIT_PART(au.email, '@', 1), '')
    ),
    NULLIF(TRIM(au.raw_user_meta_data->>'phone'), '')
  INTO target_full_name, target_phone
  FROM auth.users au
  WHERE au.id = reward_row.reward_user_id;

  INSERT INTO profiles (id, full_name, phone, role)
  VALUES (reward_row.reward_user_id, target_full_name, target_phone, COALESCE(target_role, 'client'))
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('app.reward_sync', 'on', true);

  UPDATE profiles
  SET
    full_name = CASE
      WHEN NULLIF(TRIM(COALESCE(profiles.full_name, '')), '') IS NULL THEN target_full_name
      WHEN LOWER(TRIM(profiles.full_name)) = 'visiteur anonyme' THEN target_full_name
      ELSE profiles.full_name
    END,
    phone = COALESCE(profiles.phone, target_phone),
    role = CASE
    WHEN profiles.role IS NULL THEN COALESCE(target_role, 'client')
    WHEN LOWER(profiles.role) = 'client' AND COALESCE(target_role, 'client') <> 'client' THEN target_role
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

UPDATE profiles p
SET
  full_name = CASE
    WHEN NULLIF(TRIM(COALESCE(p.full_name, '')), '') IS NULL THEN
      COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''), NULLIF(SPLIT_PART(au.email, '@', 1), ''))
    WHEN LOWER(TRIM(p.full_name)) = 'visiteur anonyme' THEN
      COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''), NULLIF(SPLIT_PART(au.email, '@', 1), ''))
    ELSE p.full_name
  END,
  phone = COALESCE(p.phone, NULLIF(TRIM(au.raw_user_meta_data->>'phone'), '')),
  role = CASE
    WHEN NULLIF(LOWER(TRIM(au.raw_user_meta_data->>'role')), '') IS NULL THEN p.role
    WHEN LOWER(TRIM(au.raw_user_meta_data->>'role')) = 'client' THEN p.role
    WHEN p.role IS NULL THEN LOWER(TRIM(au.raw_user_meta_data->>'role'))
    WHEN LOWER(p.role) = 'client' THEN LOWER(TRIM(au.raw_user_meta_data->>'role'))
    ELSE p.role
  END
FROM auth.users au
WHERE au.id = p.id
  AND (
    NULLIF(TRIM(COALESCE(p.full_name, '')), '') IS NULL
    OR LOWER(TRIM(p.full_name)) = 'visiteur anonyme'
    OR (p.phone IS NULL AND NULLIF(TRIM(au.raw_user_meta_data->>'phone'), '') IS NOT NULL)
    OR (
      NULLIF(LOWER(TRIM(au.raw_user_meta_data->>'role')), '') IS NOT NULL
      AND LOWER(TRIM(au.raw_user_meta_data->>'role')) <> 'client'
      AND (p.role IS NULL OR LOWER(p.role) = 'client')
    )
  );

NOTIFY pgrst, 'reload schema';
