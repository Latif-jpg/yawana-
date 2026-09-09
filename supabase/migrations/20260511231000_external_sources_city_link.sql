ALTER TABLE external_price_sources
ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

CREATE INDEX IF NOT EXISTS idx_external_price_sources_product_city
ON external_price_sources(product_id, city_id, collected_at DESC);
