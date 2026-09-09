ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 35;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_reward_sync_at TIMESTAMP WITH TIME ZONE;

UPDATE profiles
SET trust_score = 35
WHERE trust_score IS NULL;

CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, badge_id)
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on badges" ON badges;
CREATE POLICY "Allow public read on badges"
ON badges FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow public read on user_badges" ON user_badges;
CREATE POLICY "Allow public read on user_badges"
ON user_badges FOR SELECT
TO public
USING (true);

INSERT INTO badges (name, description, icon_name, category)
VALUES
  ('Pionnier', 'A ajoute son premier prix sur Market Radar.', 'award', 'contribution'),
  ('Analyste', 'A contribue avec plus de 10 releves de prix.', 'zap', 'contribution'),
  ('Sentinelle', 'Propose des prix d une precision chirurgicale.', 'shield', 'reliability')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION award_pioneer_badge()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_badges (user_id, badge_id)
    SELECT NEW.recorded_by, id FROM badges WHERE name = 'Pionnier'
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_award_pioneer ON prices;
CREATE TRIGGER tr_award_pioneer
AFTER INSERT ON prices
FOR EACH ROW
EXECUTE FUNCTION award_pioneer_badge();
