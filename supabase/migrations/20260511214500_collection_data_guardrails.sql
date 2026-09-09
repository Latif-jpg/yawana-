DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prices_price_value_positive_check'
      AND conrelid = 'prices'::regclass
  ) THEN
    ALTER TABLE prices
    ADD CONSTRAINT prices_price_value_positive_check
    CHECK (price_value > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prices_quantity_positive_check'
      AND conrelid = 'prices'::regclass
  ) THEN
    ALTER TABLE prices
    ADD CONSTRAINT prices_quantity_positive_check
    CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_name_not_blank_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_name_not_blank_check
    CHECK (length(btrim(name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_category_not_blank_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_category_not_blank_check
    CHECK (length(btrim(category)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_unit_not_blank_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_unit_not_blank_check
    CHECK (length(btrim(unit)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'markets_name_not_blank_check'
      AND conrelid = 'markets'::regclass
  ) THEN
    ALTER TABLE markets
    ADD CONSTRAINT markets_name_not_blank_check
    CHECK (length(btrim(name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_name_not_blank_check'
      AND conrelid = 'shops'::regclass
  ) THEN
    ALTER TABLE shops
    ADD CONSTRAINT shops_name_not_blank_check
    CHECK (length(btrim(name)) > 0);
  END IF;
END
$$;
