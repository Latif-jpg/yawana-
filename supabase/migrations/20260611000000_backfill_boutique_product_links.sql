ALTER TABLE boutique_items
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

CREATE EXTENSION IF NOT EXISTS unaccent;

WITH matched_products AS (
  SELECT
    bi.id AS boutique_item_id,
    p.id AS product_id
  FROM boutique_items bi
  JOIN products p
    ON regexp_replace(lower(unaccent(trim(bi.label))), '[^a-z0-9]+', '', 'g')
     = regexp_replace(lower(unaccent(trim(p.name))), '[^a-z0-9]+', '', 'g')
   AND regexp_replace(lower(unaccent(trim(bi.category))), '[^a-z0-9]+', '', 'g')
     = regexp_replace(lower(unaccent(trim(p.category))), '[^a-z0-9]+', '', 'g')
   AND regexp_replace(lower(unaccent(trim(bi.unit))), '[^a-z0-9]+', '', 'g')
     = regexp_replace(lower(unaccent(trim(p.unit))), '[^a-z0-9]+', '', 'g')
)
UPDATE boutique_items bi
SET product_id = mp.product_id
FROM matched_products mp
WHERE bi.id = mp.boutique_item_id
  AND bi.product_id IS NULL;

WITH unresolved_boutique_items AS (
  SELECT DISTINCT ON (
    regexp_replace(lower(unaccent(trim(label))), '[^a-z0-9]+', '', 'g'),
    regexp_replace(lower(unaccent(trim(category))), '[^a-z0-9]+', '', 'g'),
    regexp_replace(lower(unaccent(trim(unit))), '[^a-z0-9]+', '', 'g')
  )
    id,
    label,
    category,
    unit,
    image_url,
    regexp_replace(lower(unaccent(trim(label))), '[^a-z0-9]+', '', 'g') AS normalized_label,
    regexp_replace(lower(unaccent(trim(category))), '[^a-z0-9]+', '', 'g') AS normalized_category,
    regexp_replace(lower(unaccent(trim(unit))), '[^a-z0-9]+', '', 'g') AS normalized_unit
  FROM boutique_items
  WHERE product_id IS NULL
  ORDER BY
    regexp_replace(lower(unaccent(trim(label))), '[^a-z0-9]+', '', 'g'),
    regexp_replace(lower(unaccent(trim(category))), '[^a-z0-9]+', '', 'g'),
    regexp_replace(lower(unaccent(trim(unit))), '[^a-z0-9]+', '', 'g'),
    created_at ASC
)
INSERT INTO products (name, category, unit, image_url)
SELECT DISTINCT
  bi.label,
  bi.category,
  bi.unit,
  bi.image_url
FROM unresolved_boutique_items bi
WHERE NOT EXISTS (
  SELECT 1
  FROM products p
  WHERE regexp_replace(lower(unaccent(trim(p.name))), '[^a-z0-9]+', '', 'g') = bi.normalized_label
    AND regexp_replace(lower(unaccent(trim(p.category))), '[^a-z0-9]+', '', 'g') = bi.normalized_category
    AND regexp_replace(lower(unaccent(trim(p.unit))), '[^a-z0-9]+', '', 'g') = bi.normalized_unit
);

UPDATE boutique_items bi
SET product_id = p.id
FROM products p
WHERE bi.product_id IS NULL
  AND regexp_replace(lower(unaccent(trim(p.name))), '[^a-z0-9]+', '', 'g')
    = regexp_replace(lower(unaccent(trim(bi.label))), '[^a-z0-9]+', '', 'g')
  AND regexp_replace(lower(unaccent(trim(p.category))), '[^a-z0-9]+', '', 'g')
    = regexp_replace(lower(unaccent(trim(bi.category))), '[^a-z0-9]+', '', 'g')
  AND regexp_replace(lower(unaccent(trim(p.unit))), '[^a-z0-9]+', '', 'g')
    = regexp_replace(lower(unaccent(trim(bi.unit))), '[^a-z0-9]+', '', 'g');
