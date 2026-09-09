-- Migration: Add quantity column to prices
ALTER TABLE prices ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1;

-- If we want to store the unit price and total price separately, we could, 
-- but for now let's just add quantity to keep track of the scale of the price.
