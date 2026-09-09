-- Migration: Add shops table and link to prices
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    market_id UUID REFERENCES markets(id),
    contact_info TEXT, -- WhatsApp number or Phone
    trust_score NUMERIC DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure shop_id exists in prices
ALTER TABLE prices ADD COLUMN IF NOT EXISTS shop_id UUID;

-- Force adding the relationship (if it failed with ADD COLUMN IF NOT EXISTS)
ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_shop_id_fkey;
ALTER TABLE prices ADD CONSTRAINT prices_shop_id_fkey 
    FOREIGN KEY (shop_id) REFERENCES shops(id);

-- Security Policies
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON shops;
CREATE POLICY "Allow public read access" ON shops
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON shops;
CREATE POLICY "Allow authenticated insert" ON shops
    FOR INSERT WITH CHECK (true); -- simplify for dev

-- Sample Shops for initial data
-- We will insert these manually or via a seed update later.
