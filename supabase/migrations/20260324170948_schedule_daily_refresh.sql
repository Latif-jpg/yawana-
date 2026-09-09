CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Before running this job, store these two secrets in Supabase Vault:
-- 1. project_url        -> https://YOUR_PROJECT_REF.supabase.co
-- 2. service_role_key   -> YOUR_SUPABASE_SERVICE_ROLE_KEY

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'market-radar-daily-refresh';

SELECT cron.schedule(
  'market-radar-daily-refresh',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/daily-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{"source":"cron","schedule":"daily-8am"}'::jsonb
    ) AS request_id;
  $$
);
