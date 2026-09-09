ALTER TABLE external_price_sources DROP CONSTRAINT IF EXISTS external_price_sources_source_type_check;

ALTER TABLE external_price_sources
ADD CONSTRAINT external_price_sources_source_type_check
CHECK (source_type IN ('marketplace', 'merchant', 'public_dataset', 'manual', 'ai_web_search'));
