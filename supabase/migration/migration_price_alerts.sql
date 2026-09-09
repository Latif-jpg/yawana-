CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_key TEXT NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('stale_price', 'price_spike', 'conflict', 'opportunity')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    signal_value DECIMAL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_alert_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES price_alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('viewed', 'confirmed', 'dismissed', 'updated_price')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(alert_id, user_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_status_priority
ON price_alerts(status, priority DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_alert_actions_user_created_at
ON price_alert_actions(user_id, created_at DESC);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alert_actions ENABLE ROW LEVEL SECURITY;
