ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS demo_score_boost INTEGER DEFAULT 0;

UPDATE profiles
SET demo_score_boost = COALESCE(demo_score_boost, 0)
WHERE demo_score_boost IS NULL;
