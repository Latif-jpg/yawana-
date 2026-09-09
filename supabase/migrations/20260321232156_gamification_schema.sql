-- Phase 7: Gamification & Badges
-- Create 'badges' table for masters
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT, -- e.g., 'award', 'shield', 'zap'
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create 'user_badges' table for associations
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on badges" ON badges FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on user_badges" ON user_badges FOR SELECT TO public USING (true);

-- Insert Default Badges
INSERT INTO badges (name, description, icon_name, category) VALUES
('Pionnier', 'A ajouté son premier prix sur Market Radar.', 'award', 'contribution'),
('Analyste', 'A contribué avec plus de 10 relevés de prix.', 'zap', 'contribution'),
('Sentinelle', 'Propose des prix d''une précision chirurgicale.', 'shield', 'reliability')
ON CONFLICT DO NOTHING;

-- Automated Badge Awarding (Trigger)
-- Award "Pionnier" when first price is inserted
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
