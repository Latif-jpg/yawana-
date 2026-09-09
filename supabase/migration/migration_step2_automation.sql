-- Migration: Intelligence Automation
-- Description: Adds uniqueness constraints and schedules the daily price fetcher.

-- 1. Unicité pour les sources externes
-- Cela permet d'utiliser l'UPSERT pour mettre à jour les prix existants au lieu de dupliquer.
ALTER TABLE external_price_sources 
ADD CONSTRAINT unique_product_source_location 
UNIQUE (product_id, source_name, location_label);

-- 2. Configuration du Cron Job (pg_cron)
-- Note: Ce script suppose que l'extension pg_cron est activée sur votre instance Supabase.
-- La fonction s'exécutera tous les jours à 00h00 (UTC, à ajuster selon le fuseau horaire souhaité).

-- Supprime l'ancienne tâche si elle existe pour éviter les doublons
SELECT cron.unschedule('daily-web-price-scan') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-web-price-scan');

-- Programmation du nouveau scan
SELECT cron.schedule(
    'daily-web-price-scan',
    '0 0 * * *', -- Tous les jours à minuit pile
    $$
    SELECT
      net.http_post(
        url:='https://[VOTRE_PROJECT_REF].functions.supabase.co/v1/fetch-external-prices',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [VOTRE_SERVICE_ROLE_KEY]"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
);

-- 3. Index de performance pour les alertes actives
CREATE INDEX IF NOT EXISTS idx_price_alerts_status_priority 
ON price_alerts(status) 
WHERE (status = 'active');
