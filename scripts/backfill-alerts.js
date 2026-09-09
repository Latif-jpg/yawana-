const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(envPath) {
  const env = {};
  const raw = fs.readFileSync(envPath, 'utf8');

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');
    env[key] = value;
  });

  return env;
}

function ageInDays(updatedAt) {
  if (!updatedAt) return 999;
  return (Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000);
}

function deriveAlerts(snapshot) {
  const alerts = [];
  const productName = snapshot.products?.name || 'ce produit';
  const marketName = snapshot.markets?.name || 'ce marche';
  const snapshotAge = ageInDays(snapshot.updated_at);
  const confidence = Number(snapshot.confidence_score || 0);
  const trend7d = Number(snapshot.trend_7d || 0);
  const externalGap = snapshot.external_gap_percent === null ? null : Number(snapshot.external_gap_percent);

  if (snapshot.sample_size < 3 || snapshotAge >= 5 || confidence < 0.45) {
    alerts.push({
      alert_key: `${snapshot.product_id}:${snapshot.market_id}:stale_price`,
      product_id: snapshot.product_id,
      market_id: snapshot.market_id,
      alert_type: 'stale_price',
      title: 'Prix a confirmer',
      message: `Le prix de ${productName} au ${marketName} a besoin d'une confirmation recente.`,
      priority: snapshotAge >= 7 ? 5 : 4,
      signal_value: snapshotAge,
      status: 'active',
      updated_at: new Date().toISOString(),
    });
  }

  if (trend7d >= 10) {
    alerts.push({
      alert_key: `${snapshot.product_id}:${snapshot.market_id}:price_spike`,
      product_id: snapshot.product_id,
      market_id: snapshot.market_id,
      alert_type: 'price_spike',
      title: 'Hausse inhabituelle',
      message: `${productName} semble monter vite au ${marketName}. Un releve terrain permettrait de confirmer.`,
      priority: 5,
      signal_value: trend7d,
      status: 'active',
      updated_at: new Date().toISOString(),
    });
  }

  if (snapshot.status === 'volatile' || snapshot.status === 'anomaly') {
    alerts.push({
      alert_key: `${snapshot.product_id}:${snapshot.market_id}:conflict`,
      product_id: snapshot.product_id,
      market_id: snapshot.market_id,
      alert_type: 'conflict',
      title: 'Prix a clarifier',
      message: `Les releves de ${productName} au ${marketName} sont encore tres disperses. Un nouveau prix aiderait a trancher.`,
      priority: 4,
      signal_value: confidence,
      status: 'active',
      updated_at: new Date().toISOString(),
    });
  }

  if (externalGap !== null && externalGap <= -8) {
    alerts.push({
      alert_key: `${snapshot.product_id}:${snapshot.market_id}:opportunity`,
      product_id: snapshot.product_id,
      market_id: snapshot.market_id,
      alert_type: 'opportunity',
      title: 'Bon plan a verifier',
      message: `${productName} parait moins cher au ${marketName} que la reference web. Pouvez-vous verifier si c'est toujours vrai ?`,
      priority: 3,
      signal_value: externalGap,
      status: 'active',
      updated_at: new Date().toISOString(),
    });
  }

  return alerts;
}

function cooldownDaysForAlert(alertType, status) {
  if (alertType === 'stale_price') {
    return status === 'dismissed' ? 3 : 7;
  }

  return status === 'dismissed' ? 1 : 2;
}

function shouldReactivateAlert(existingAlert) {
  if (existingAlert.status === 'active') {
    return true;
  }

  const cooldownMs = cooldownDaysForAlert(existingAlert.alert_type, existingAlert.status) * 24 * 60 * 60 * 1000;
  const ageMs = Date.now() - new Date(existingAlert.updated_at).getTime();
  return ageMs >= cooldownMs;
}

async function main() {
  const env = loadEnvFile(path.join(process.cwd(), '.env'));
  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: snapshots, error } = await supabase
    .from('market_price_snapshots')
    .select(`
      *,
      products(name, category, unit),
      markets(name, city_id)
    `);

  if (error) throw error;

  const alerts = (snapshots || []).flatMap(deriveAlerts);
  if (!alerts.length) {
    console.log('Aucune alerte a generer.');
    return;
  }

  const alertKeys = alerts.map((alert) => alert.alert_key);
  const { data: existingAlerts, error: existingAlertsError } = await supabase
    .from('price_alerts')
    .select('id, alert_key, status, updated_at, alert_type')
    .in('alert_key', alertKeys);

  if (existingAlertsError) throw existingAlertsError;

  const existingByKey = new Map((existingAlerts || []).map((alert) => [alert.alert_key, alert]));
  const alertsToUpsert = alerts.filter((alert) => {
    const existing = existingByKey.get(alert.alert_key);
    if (!existing) return true;
    return shouldReactivateAlert(existing);
  });

  if (!alertsToUpsert.length) {
    console.log('Aucune nouvelle alerte a reactiver pour le moment.');
    return;
  }

  const { error: upsertError } = await supabase
    .from('price_alerts')
    .upsert(alertsToUpsert, { onConflict: 'alert_key' });

  if (upsertError) throw upsertError;

  console.log(`${alertsToUpsert.length} alertes generees.`);
}

main().catch((error) => {
  console.error('Backfill alertes echoue.');
  console.error(error.message || error);
  process.exit(1);
});
