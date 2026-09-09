const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(envPath) {
  const env = {};
  const raw = fs.readFileSync(envPath, 'utf8');

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');
    env[key] = value;
  });

  return env;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeUnit(unit) {
  const aliases = {
    kg: 'kg',
    kilo: 'kg',
    kilos: 'kg',
    kilogramme: 'kg',
    kilogrammes: 'kg',
    g: 'g',
    gramme: 'g',
    grammes: 'g',
    l: 'l',
    litre: 'l',
    litres: 'l',
    ml: 'ml',
    millilitre: 'ml',
    millilitres: 'ml',
    unit: 'unit',
    unite: 'unit',
    unites: 'unit',
    piece: 'unit',
    pieces: 'unit',
    bag: 'bag',
    sachet: 'bag',
    sac: 'bag',
  };

  return aliases[normalizeText(unit)] || 'unit';
}

function normalizePricePerBaseUnit(priceValue, unit, quantity = 1) {
  const normalizedUnit = normalizeUnit(unit);
  let divisor = Number(quantity || 1);

  if (normalizedUnit === 'g' || normalizedUnit === 'ml') {
    divisor = divisor / 1000;
  }

  if (!divisor) {
    divisor = 1;
  }

  return Number(priceValue || 0) / divisor;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values) {
  const avg = mean(values);
  if (!values.length || avg === null) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function refinedAverage(values) {
  if (!values.length) return null;
  if (values.length < 3) return mean(values);

  const avg = mean(values);
  const stdDev = standardDeviation(values);
  if (avg === null || stdDev === 0) return avg;

  const filtered = values.filter((value) => Math.abs(value - avg) <= 2 * stdDev);
  return mean(filtered.length ? filtered : values);
}

function detectAnomalyValues(values) {
  if (values.length < 3) return [];
  const avg = mean(values);
  const stdDev = standardDeviation(values);
  if (avg === null || stdDev === 0) return [];
  return values.filter((value) => Math.abs(value - avg) / stdDev > 2.5);
}

function computeTrend(values, days) {
  if (!values.length) return null;

  const now = Date.now();
  const windowStart = now - days * 24 * 60 * 60 * 1000;
  const windowValues = values
    .filter((value) => new Date(value.created_at).getTime() >= windowStart)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (windowValues.length < 2) return null;

  const first = normalizePricePerBaseUnit(windowValues[0].price_value, windowValues[0].unit, windowValues[0].quantity);
  const last = normalizePricePerBaseUnit(windowValues[windowValues.length - 1].price_value, windowValues[windowValues.length - 1].unit, windowValues[windowValues.length - 1].quantity);

  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

function computeConfidenceScore(sampleSize, anomalyCount, latestTimestamp) {
  const sampleFactor = Math.min(1, sampleSize / 12);
  const anomalyPenalty = Math.min(0.5, anomalyCount * 0.08);

  let recencyFactor = 0.2;
  if (latestTimestamp) {
    const ageInDays = (Date.now() - new Date(latestTimestamp).getTime()) / (24 * 60 * 60 * 1000);
    recencyFactor = Math.max(0, 1 - ageInDays / 30);
  }

  return Math.max(0, Math.min(1, sampleFactor * 0.55 + recencyFactor * 0.45 - anomalyPenalty));
}

function computeLocalAnalytics(prices) {
  if (!prices.length) {
    return {
      sampleSize: 0,
      latestPrice: null,
      averagePrice: null,
      medianPrice: null,
      minimumPrice: null,
      maximumPrice: null,
      trend7d: null,
      trend30d: null,
      confidenceScore: 0,
      status: 'insufficient_data',
      refinedAveragePrice: null,
    };
  }

  const normalized = prices.map((price) => ({
    ...price,
    normalizedPrice: normalizePricePerBaseUnit(price.price_value, price.unit, price.quantity),
  }));
  const values = normalized.map((price) => price.normalizedPrice);
  const latest = [...normalized].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const anomalyCount = detectAnomalyValues(values).length;
  const refinedAveragePrice = refinedAverage(values);
  const trend7d = computeTrend(prices, 7);
  const trend30d = computeTrend(prices, 30);
  const confidenceScore = computeConfidenceScore(prices.length, anomalyCount, latest.created_at);

  let status = 'normal';
  if (prices.length < 3) status = 'insufficient_data';
  else if (anomalyCount >= Math.ceil(prices.length / 3)) status = 'anomaly';
  else if ((trend7d || 0) >= 12 || (trend30d || 0) >= 20) status = 'expensive';
  else if ((trend7d || 0) <= -12 || (trend30d || 0) <= -20) status = 'cheap';
  else if (standardDeviation(values) > (refinedAveragePrice || 0) * 0.2) status = 'volatile';

  return {
    sampleSize: prices.length,
    latestPrice: latest.normalizedPrice,
    averagePrice: mean(values),
    medianPrice: median(values),
    minimumPrice: Math.min(...values),
    maximumPrice: Math.max(...values),
    trend7d,
    trend30d,
    confidenceScore,
    status,
    refinedAveragePrice,
  };
}

function buildExternalReference(externalPrices) {
  if (!externalPrices.length) {
    return null;
  }

  const normalized = externalPrices.map((price) => ({
    normalizedPrice: normalizePricePerBaseUnit(price.price_value, price.unit, price.quantity),
    confidence: Number(price.confidence_score || 0.5),
  }));

  return {
    averagePrice: normalized.reduce((sum, item) => sum + item.normalizedPrice, 0) / normalized.length,
    confidenceScore: normalized.reduce((sum, item) => sum + item.confidence, 0) / normalized.length,
  };
}

function compareLocalVsExternal(localPrice, localConfidenceScore, externalReference) {
  if (localPrice === null || !externalReference) {
    return {
      externalAveragePrice: externalReference ? externalReference.averagePrice : null,
      externalGapPercent: null,
      confidenceScore: 0,
    };
  }

  const gap = ((localPrice - externalReference.averagePrice) / externalReference.averagePrice) * 100;
  const confidenceScore = Math.max(
    0,
    Math.min(1, localConfidenceScore * 0.6 + externalReference.confidenceScore * 0.4 - Math.abs(gap) / 200)
  );

  return {
    externalAveragePrice: externalReference.averagePrice,
    externalGapPercent: gap,
    confidenceScore,
  };
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  const env = loadEnvFile(envPath);
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables Supabase manquantes dans .env');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: prices, error: pricesError }, { data: externalPrices, error: externalError }] = await Promise.all([
    supabase
      .from('prices')
      .select(`
        *,
        products(name, category, unit)
      `)
      .order('created_at', { ascending: false }),
    supabase.from('external_price_sources').select('*').order('collected_at', { ascending: false }),
  ]);

  if (pricesError) throw pricesError;
  if (externalError) throw externalError;

  const grouped = new Map();
  (prices || []).forEach((price) => {
    const key = `${price.product_id}:${price.market_id}`;
    grouped.set(key, [...(grouped.get(key) || []), {
      ...price,
      unit: price.products?.unit || 'unit',
      quantity: Number(price.quantity || 1),
      price_value: Number(price.price_value || 0),
    }]);
  });

  const rows = Array.from(grouped.entries()).map(([key, localPrices]) => {
    const [productId, marketId] = key.split(':');
    const local = computeLocalAnalytics(localPrices);
    const externalReference = buildExternalReference(
      (externalPrices || []).filter((item) => item.product_id === productId)
    );
    const comparison = compareLocalVsExternal(local.refinedAveragePrice ?? local.averagePrice, local.confidenceScore, externalReference);

    return {
      product_id: productId,
      market_id: marketId,
      sample_size: local.sampleSize,
      latest_price: local.latestPrice,
      average_price: local.refinedAveragePrice ?? local.averagePrice,
      median_price: local.medianPrice,
      minimum_price: local.minimumPrice,
      maximum_price: local.maximumPrice,
      trend_7d: local.trend7d,
      trend_30d: local.trend30d,
      confidence_score: Math.max(local.confidenceScore, comparison.confidenceScore),
      external_average_price: comparison.externalAveragePrice,
      external_gap_percent: comparison.externalGapPercent,
      status: local.status,
      updated_at: new Date().toISOString(),
    };
  });

  if (!rows.length) {
    console.log('Aucun snapshot a recalculer.');
    return;
  }

  const { error: upsertError } = await supabase
    .from('market_price_snapshots')
    .upsert(rows, { onConflict: 'product_id,market_id' });

  if (upsertError) {
    throw upsertError;
  }

  console.log(`${rows.length} snapshots recalcules et enregistres.`);
}

main().catch((error) => {
  console.error('Backfill snapshots echoue.');
  console.error(error.message || error);
  process.exit(1);
});
