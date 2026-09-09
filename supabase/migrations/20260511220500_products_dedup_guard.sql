WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS canonical_id
  FROM products
),
duplicate_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked_products
  WHERE row_num > 1
)
UPDATE prices
SET product_id = duplicate_map.canonical_id
FROM duplicate_map
WHERE prices.product_id = duplicate_map.duplicate_id;

WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS canonical_id
  FROM products
),
duplicate_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked_products
  WHERE row_num > 1
)
DELETE FROM external_price_sources eps
USING duplicate_map
WHERE eps.product_id = duplicate_map.duplicate_id
  AND EXISTS (
    SELECT 1
    FROM external_price_sources canonical_eps
    WHERE canonical_eps.product_id = duplicate_map.canonical_id
      AND canonical_eps.source_name IS NOT DISTINCT FROM eps.source_name
      AND canonical_eps.location_label IS NOT DISTINCT FROM eps.location_label
  );

WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS canonical_id
  FROM products
),
duplicate_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked_products
  WHERE row_num > 1
)
UPDATE external_price_sources
SET product_id = duplicate_map.canonical_id
FROM duplicate_map
WHERE external_price_sources.product_id = duplicate_map.duplicate_id;

WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS canonical_id
  FROM products
),
duplicate_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked_products
  WHERE row_num > 1
)
DELETE FROM market_price_snapshots mps
USING duplicate_map
WHERE mps.product_id = duplicate_map.duplicate_id
  AND EXISTS (
    SELECT 1
    FROM market_price_snapshots canonical_mps
    WHERE canonical_mps.product_id = duplicate_map.canonical_id
      AND canonical_mps.market_id = mps.market_id
  );

WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS canonical_id
  FROM products
),
duplicate_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked_products
  WHERE row_num > 1
)
UPDATE market_price_snapshots
SET product_id = duplicate_map.canonical_id
FROM duplicate_map
WHERE market_price_snapshots.product_id = duplicate_map.duplicate_id;

WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS canonical_id
  FROM products
),
duplicate_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked_products
  WHERE row_num > 1
)
UPDATE price_alerts
SET product_id = duplicate_map.canonical_id
FROM duplicate_map
WHERE price_alerts.product_id = duplicate_map.duplicate_id;

WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name)), lower(btrim(category)), lower(btrim(unit))
      ORDER BY created_at NULLS FIRST, id
    ) AS row_num
  FROM products
)
DELETE FROM products
USING ranked_products
WHERE products.id = ranked_products.id
  AND ranked_products.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_category_unit_unique
ON products ((lower(btrim(name))), (lower(btrim(category))), (lower(btrim(unit))));
