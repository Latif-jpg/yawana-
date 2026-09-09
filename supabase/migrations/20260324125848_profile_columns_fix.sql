ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';

UPDATE profiles
SET role = 'client'
WHERE role IS NULL;
