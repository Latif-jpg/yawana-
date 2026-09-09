ALTER TABLE shops
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shops_owner_id_idx
  ON shops (owner_id);
