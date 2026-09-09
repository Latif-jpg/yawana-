-- Phase 6: Geographic Intelligence for Markets
-- Add latitude and longitude columns to 'markets' table
ALTER TABLE markets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Populate realistic coordinates for Burkina Faso markets
-- Ouagadougou (Centre)
UPDATE markets SET latitude = 12.3582, longitude = -1.5034 WHERE name = 'Rood Woko';
UPDATE markets SET latitude = 12.3361, longitude = -1.5627 WHERE name = 'Marché de Pissy';
UPDATE markets SET latitude = 12.3536, longitude = -1.4886 WHERE name = 'Wemtenga';

-- Bobo-Dioulasso (Hauts-Bassins)
UPDATE markets SET latitude = 11.1772, longitude = -4.2965 WHERE name = 'Grand Marché de Bobo';

-- Dori (Sahel)
UPDATE markets SET latitude = 14.0354, longitude = -0.0345 WHERE name = 'Marché de Dori Centre';

-- Banfora (Cascades)
UPDATE markets SET latitude = 10.6386, longitude = -4.7583 WHERE name = 'Marché de Banfora Est';

-- Add a comment to the table for documentation
COMMENT ON COLUMN markets.latitude IS 'Geographic latitude decimal degree';
COMMENT ON COLUMN markets.longitude IS 'Geographic longitude decimal degree';
