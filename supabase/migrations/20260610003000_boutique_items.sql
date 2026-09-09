CREATE TABLE IF NOT EXISTS boutique_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unit',
  price_value NUMERIC,
  image_url TEXT,
  is_visible_in_search BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE boutique_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can read their boutique items" ON boutique_items;
CREATE POLICY "Owners can read their boutique items"
ON boutique_items FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert their boutique items" ON boutique_items;
CREATE POLICY "Owners can insert their boutique items"
ON boutique_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their boutique items" ON boutique_items;
CREATE POLICY "Owners can update their boutique items"
ON boutique_items FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete their boutique items" ON boutique_items;
CREATE POLICY "Owners can delete their boutique items"
ON boutique_items FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);
