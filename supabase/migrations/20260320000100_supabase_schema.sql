-- Enable PostGIS for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table: cities
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: markets
CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city_id UUID REFERENCES cities(id),
    location GEOGRAPHY(POINT),
    market_type TEXT CHECK (market_type IN ('physical', 'street', 'mall')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: prices
CREATE TABLE prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    market_id UUID REFERENCES markets(id),
    shop_id UUID, -- Optional Stand/Shop reference
    price_value DECIMAL NOT NULL,
    quantity DECIMAL NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'XOF',
    recorded_by UUID NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: external_price_sources
CREATE TABLE external_price_sources (
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

-- Table: price_flags
CREATE TABLE price_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_id UUID NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL CHECK (flag_type IN ('anomaly', 'duplicate', 'stale', 'low_confidence')),
    score DECIMAL NOT NULL DEFAULT 0.5 CHECK (score >= 0 AND score <= 1),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(price_id, flag_type)
);

-- Table: market_price_snapshots
CREATE TABLE market_price_snapshots (
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

CREATE INDEX idx_prices_product_market_created_at ON prices(product_id, market_id, created_at DESC);
CREATE INDEX idx_external_price_sources_product_collected_at ON external_price_sources(product_id, collected_at DESC);
CREATE INDEX idx_market_price_snapshots_product_market ON market_price_snapshots(product_id, market_id);

-- Enable Row Level Security (RLS)
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_price_snapshots ENABLE ROW LEVEL SECURITY;
