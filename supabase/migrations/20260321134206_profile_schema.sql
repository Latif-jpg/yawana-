-- Profiles Table for User Identity and Gamification
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- matches auth.users.id or the default guest id
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'client', -- 'seller' or 'client'
    avatar_url TEXT,
    city_id UUID REFERENCES cities(id),
    level INTEGER DEFAULT 1,
    points INTEGER DEFAULT 0,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read profile" ON profiles;
CREATE POLICY "Allow public read profile" ON profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow own profile update" ON profiles;
CREATE POLICY "Allow own profile update" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Insert Default Guest Profile
INSERT INTO profiles (id, full_name, bio, level, points)
VALUES ('00000000-0000-0000-0000-000000000000', 'Visiteur Anonyme', 'Contributeur de passage sur MarketRadar.', 1, 0)
ON CONFLICT (id) DO NOTHING;
