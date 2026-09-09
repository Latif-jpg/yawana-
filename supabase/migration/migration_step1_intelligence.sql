CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE prices
ADD COLUMN IF NOT EXISTS quantity DECIMAL NOT NULL DEFAULT 1;

ALTER TABLE prices
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';

CREATE TABLE IF NOT EXISTS external_price_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('marketplace', 'merchant', 'public_dataset', 'manual')),
    url TEXT,
    location_label TEXT,
    unit TEXT NOT NULL,
    quantity DECIMAL NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'XOF',
    price_value DECIMAL NOT NULL,
    confidence_score DECIMAL NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_id UUID NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL CHECK (flag_type IN ('anomaly', 'duplicate', 'stale', 'low_confidence')),
    score DECIMAL NOT NULL DEFAULT 0.5 CHECK (score >= 0 AND score <= 1),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(price_id, flag_type)
);

CREATE TABLE IF NOT EXISTS market_price_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    sample_size INTEGER NOT NULL DEFAULT 0,
    latest_price DECIMAL,
    average_price DECIMAL,
    median_price DECIMAL,
    minimum_price DECIMAL,
    maximum_price DECIMAL,
    trend_7d DECIMAL,
    trend_30d DECIMAL,
    confidence_score DECIMAL NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    external_average_price DECIMAL,
    external_gap_percent DECIMAL,
    status TEXT NOT NULL DEFAULT 'insufficient_data' CHECK (status IN ('normal', 'cheap', 'expensive', 'volatile', 'insufficient_data', 'anomaly')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_prices_product_market_created_at
ON prices(product_id, market_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_price_sources_product_collected_at
ON external_price_sources(product_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_price_snapshots_product_market
ON market_price_snapshots(product_id, market_id);

ALTER TABLE external_price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_price_snapshots ENABLE ROW LEVEL SECURITY;
