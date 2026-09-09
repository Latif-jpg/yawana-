DROP POLICY IF EXISTS "Owners can read their boutique items" ON boutique_items;
DROP POLICY IF EXISTS "Owners and visible boutique items can be read" ON boutique_items;

CREATE POLICY "Owners and visible boutique items can be read"
ON boutique_items FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR COALESCE(boutique_items.is_visible_in_search, false) = true
);

CREATE INDEX IF NOT EXISTS boutique_items_visible_in_search_idx
  ON boutique_items (is_visible_in_search, created_at DESC);
