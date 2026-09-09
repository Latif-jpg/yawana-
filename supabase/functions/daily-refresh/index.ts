// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

type PriceRow = {
  id: string;
  product_id: string;
  market_id: string;
  price_value: number;
  quantity: number;
  created_at: string;
  reliability_status?: string | null;
  reliability_score?: number | null;
  products?: { unit?: string } | null;
  markets?: { name?: string | null; city_id?: string | null } | null;
};

type SnapshotRow = {
  product_id: string;
  market_id: string;
  sample_size: number;
  latest_price: number | null;
  average_price: number | null;
  median_price: number | null;
  minimum_price: number | null;
  maximum_price: number | null;
  trend_7d: number | null;
  trend_30d: number | null;
  confidence_score: number;
  external_average_price: number | null;
  external_gap_percent: number | null;
  status: string;
  updated_at: string;
  products?: { name?: string; unit?: string } | null;
  markets?: { name?: string; city_id?: string } | null;
};

type ExternalPriceRow = {
  product_id: string;
  price_value: number;
  quantity: number;
  unit: string;
  confidence_score: number;
  city_id?: string | null;
  location_label?: string | null;
  source_name?: string | null;
};

type MarketLookupRow = {
  id: string;
  name?: string | null;
  city_id?: string | null;
  cities?: { name?: string | null } | null;
};

type RefreshRequest = {
  productId?: string | null;
  marketId?: string | null;
};

type PairScope = {
  productId: string;
  marketId: string;
};

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeUnit(unit: string) {
  const aliases: Record<string, string> = {
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

function normalizePricePerBaseUnit(priceValue: number, unit: string, quantity = 1) {
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

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values: number[]) {
  const avg = mean(values);
  if (!values.length || avg === null) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function refinedAverage(values: number[]) {
  if (!values.length) return null;
  if (values.length < 3) return mean(values);

  const avg = mean(values);
  const stdDev = standardDeviation(values);
  if (avg === null || stdDev === 0) return avg;

  const filtered = values.filter((value) => Math.abs(value - avg) <= 2 * stdDev);
  return mean(filtered.length ? filtered : values);
}

function detectAnomalyValues(values: number[]) {
  if (values.length < 3) return [];
  const avg = mean(values);
  const stdDev = standardDeviation(values);
  if (avg === null || stdDev === 0) return [];
  return values.filter((value) => Math.abs(value - avg) / stdDev > 2.5);
}

function computeTrend(values: PriceRow[], days: number) {
  if (!values.length) return null;

  const now = Date.now();
  const windowStart = now - days * 24 * 60 * 60 * 1000;
  const windowValues = values
    .filter((value) => new Date(value.created_at).getTime() >= windowStart)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (windowValues.length < 2) return null;

  const first = normalizePricePerBaseUnit(windowValues[0].price_value, windowValues[0].products?.unit || 'unit', windowValues[0].quantity);
  const last = normalizePricePerBaseUnit(windowValues[windowValues.length - 1].price_value, windowValues[windowValues.length - 1].products?.unit || 'unit', windowValues[windowValues.length - 1].quantity);

  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

function computeConfidenceScore(sampleSize: number, anomalyCount: number, latestTimestamp?: string | null) {
  const sampleFactor = Math.min(1, sampleSize / 12);
  const anomalyPenalty = Math.min(0.5, anomalyCount * 0.08);

  let recencyFactor = 0.2;
  if (latestTimestamp) {
    const ageInDays = (Date.now() - new Date(latestTimestamp).getTime()) / (24 * 60 * 60 * 1000);
    recencyFactor = Math.max(0, 1 - ageInDays / 30);
  }

  return Math.max(0, Math.min(1, sampleFactor * 0.55 + recencyFactor * 0.45 - anomalyPenalty));
}

function computeSupportCount(values: number[], target: number, tolerance: number) {
  return values.filter((value) => Math.abs(value - target) <= tolerance).length;
}

function assessReliability(input: {
  allPrices: Array<PriceRow & { normalizedPrice: number }>;
}) {
  const values = input.allPrices.map((price) => price.normalizedPrice);
  const avg = refinedAverage(values) ?? mean(values) ?? 0;
  const stdDev = standardDeviation(values);
  const tolerance = Math.max(avg * 0.08, stdDev || 0, 1);

  return input.allPrices.map((price) => {
    const gap = Math.abs(price.normalizedPrice - avg);
    const supportCount = computeSupportCount(values, price.normalizedPrice, tolerance);
    const ageInDays = (Date.now() - new Date(price.created_at).getTime()) / (24 * 60 * 60 * 1000);
    const recencyBoost = Math.max(0, 1 - ageInDays / 21) * 0.15;

    let reliabilityStatus = 'pending';
    let reliabilityScore = 0.35 + recencyBoost;
    let validationNote = 'Releve en attente de confirmations supplementaires.';

    if (values.length < 2) {
      reliabilityStatus = 'pending';
      reliabilityScore = Math.min(0.55, 0.4 + recencyBoost);
      validationNote = 'Pas encore assez de releves comparables pour valider ce prix.';
    } else if (supportCount >= 3 && gap <= tolerance) {
      reliabilityStatus = 'trusted';
      reliabilityScore = Math.min(0.98, 0.85 + recencyBoost);
      validationNote = 'Releve coherent avec plusieurs observations proches.';
    } else if (supportCount >= 2 && gap <= tolerance * 1.2) {
      reliabilityStatus = 'confirmed';
      reliabilityScore = Math.min(0.88, 0.68 + recencyBoost);
      validationNote = 'Releve confirme par au moins une autre observation compatible.';
    } else if (gap > tolerance * 1.8) {
      reliabilityStatus = 'conflicted';
      reliabilityScore = Math.max(0.05, 0.18 - ageInDays / 120);
      validationNote = 'Releve eloigne du groupe principal. Verification terrain recommandee.';
    } else {
      reliabilityStatus = 'pending';
      reliabilityScore = Math.min(0.62, 0.48 + recencyBoost);
      validationNote = 'Releve plausible mais encore trop isole pour etre confirme.';
    }

    return {
      id: price.id,
      reliability_status: reliabilityStatus,
      reliability_score: Math.max(0, Math.min(1, reliabilityScore)),
      validation_note: validationNote,
      verified_at: reliabilityStatus === 'trusted' || reliabilityStatus === 'confirmed' ? new Date().toISOString() : null,
      normalizedPrice: price.normalizedPrice,
      created_at: price.created_at,
    };
  });
}

function buildExternalReference(externalPrices: ExternalPriceRow[]) {
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

function getExternalLocationScore(input: {
  locationLabel?: string | null;
  marketName?: string | null;
  cityName?: string | null;
}) {
  const location = normalizeText(input.locationLabel || '');
  if (!location) return 0;

  const market = normalizeText(input.marketName || '');
  const city = normalizeText(input.cityName || '');

  let score = 0;

  if (market && (location.includes(market) || market.includes(location))) {
    score += 3;
  }

  if (city && (location.includes(city) || city.includes(location))) {
    score += 2;
  }

  if (location.includes('burkina faso') || location.includes('national')) {
    score += 1;
  }

  return score;
}

function selectRelevantExternalPrices(input: {
  externalPrices: ExternalPriceRow[];
  productId: string;
  marketId: string;
  marketLookup: Map<string, { name?: string | null; cityName?: string | null }>;
  marketCityIdLookup: Map<string, string | null>;
}) {
  const candidates = input.externalPrices.filter((item) => item.product_id === input.productId);
  if (!candidates.length) {
    return [];
  }

  const marketMeta = input.marketLookup.get(input.marketId) || {};
  const marketCityId = input.marketCityIdLookup.get(input.marketId) || null;
  const scored = candidates
    .map((item) => ({
      item,
      score:
        (marketCityId && item.city_id === marketCityId ? 10 : 0) +
        getExternalLocationScore({
          locationLabel: item.location_label,
          marketName: marketMeta.name,
          cityName: marketMeta.cityName,
        }),
    }))
    .sort((a, b) => b.score - a.score);

  const bestScore = scored[0]?.score ?? 0;
  if (bestScore <= 0) {
    return candidates;
  }

  return scored.filter((entry) => entry.score === bestScore).map((entry) => entry.item);
}

function compareLocalVsExternal(localPrice: number | null, localConfidenceScore: number, externalReference: { averagePrice: number; confidenceScore: number } | null) {
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
    Math.min(1, localConfidenceScore * 0.6 + externalReference.confidenceScore * 0.4 - Math.abs(gap) / 200),
  );

  return {
    externalAveragePrice: externalReference.averagePrice,
    externalGapPercent: gap,
    confidenceScore,
  };
}

function ageInDays(updatedAt?: string | null) {
  if (!updatedAt) return 999;
  return (Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000);
}

function deriveAlerts(snapshot: SnapshotRow) {
  const alerts: Record<string, unknown>[] = [];
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

function cooldownDaysForAlert(alertType: string, status: string) {
  if (alertType === 'stale_price') {
    return status === 'dismissed' ? 3 : 7;
  }

  return status === 'dismissed' ? 1 : 2;
}

function shouldReactivateAlert(existingAlert: { status: string; updated_at: string; alert_type: string }) {
  if (existingAlert.status === 'active') {
    return true;
  }

  const cooldownMs = cooldownDaysForAlert(existingAlert.alert_type, existingAlert.status) * 24 * 60 * 60 * 1000;
  const ageMs = Date.now() - new Date(existingAlert.updated_at).getTime();

  return ageMs >= cooldownMs;
}

function buildPairFilters(pairs: PairScope[]) {
  return pairs
    .map((pair) => `and(product_id.eq.${pair.productId},market_id.eq.${pair.marketId})`)
    .join(',');
}

function getSnapshotComparisonLabel(externalGapPercent: number | null) {
  if (externalGapPercent === null) return 'insufficient_data';
  if (externalGapPercent <= -8) return 'below_external';
  if (externalGapPercent >= 8) return 'above_external';
  return 'aligned';
}

function eligibleRolesForAlert(alertType: string) {
  if (alertType === 'price_spike') return ['seller', 'merchant', 'commercant', 'collector'];
  if (alertType === 'conflict') return ['collector', 'seller'];
  if (alertType === 'stale_price') return ['collector', 'client', 'seller'];
  return ['client', 'seller'];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase service credentials' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: RefreshRequest = {};
  if (req.method !== 'GET') {
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
  }

  const requestedProductId = payload.productId || null;
  const requestedMarketId = payload.marketId || null;
  const isPairRefresh = !!(requestedProductId && requestedMarketId);

  if ((requestedProductId && !requestedMarketId) || (!requestedProductId && requestedMarketId)) {
    return new Response(JSON.stringify({ error: 'productId and marketId must be provided together' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const requestedPairs = isPairRefresh
    ? [{ productId: requestedProductId, marketId: requestedMarketId }]
    : [];

  let pricesQuery = supabase
      .from('prices')
      .select(`
        *,
        products(name, category, unit),
        markets(name, city_id)
      `)
      .order('created_at', { ascending: false });

  if (isPairRefresh) {
    pricesQuery = pricesQuery
      .eq('product_id', requestedProductId)
      .eq('market_id', requestedMarketId);
  }

  let externalQuery = supabase.from('external_price_sources').select('*').order('collected_at', { ascending: false });
  if (requestedProductId) {
    externalQuery = externalQuery.eq('product_id', requestedProductId);
  }

  const [{ data: prices, error: pricesError }, { data: externalPrices, error: externalError }, { data: markets, error: marketsError }] = await Promise.all([
    pricesQuery,
    externalQuery,
    supabase.from('markets').select('id, name, city_id, cities(name)'),
  ]);

  if (pricesError || externalError || marketsError) {
    return new Response(JSON.stringify({ error: pricesError?.message || externalError?.message || marketsError?.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const marketLookup = new Map(
    ((markets || []) as MarketLookupRow[]).map((market) => [
      market.id,
      {
        name: market.name || null,
        cityName: market.cities?.name || null,
      },
    ])
  );
  const marketCityIdLookup = new Map(
    ((markets || []) as MarketLookupRow[]).map((market) => [market.id, market.city_id || null])
  );

  const grouped = new Map<string, PriceRow[]>();
  (prices || []).forEach((price: PriceRow) => {
    const key = `${price.product_id}:${price.market_id}`;
    grouped.set(key, [...(grouped.get(key) || []), price]);
  });

  const snapshotRows = Array.from(grouped.entries()).map(([key, localPrices]) => {
    const [productId, marketId] = key.split(':');
    const normalized = localPrices.map((price) => ({
      ...price,
      normalizedPrice: normalizePricePerBaseUnit(price.price_value, price.products?.unit || 'unit', price.quantity),
    }));
    const reliabilityAssessments = assessReliability({ allPrices: normalized });
    const reliabilityById = new Map(reliabilityAssessments.map((item) => [item.id, item]));
    const preferredPrices = normalized.filter((price) => {
      const assessment = reliabilityById.get(price.id);
      return assessment?.reliability_status === 'trusted' || assessment?.reliability_status === 'confirmed';
    });
    const analysisBase = preferredPrices.length >= 2 ? preferredPrices : normalized;
    const values = analysisBase.map((price) => price.normalizedPrice);
    const latest = [...normalized].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const anomalyCount = detectAnomalyValues(values).length;
    const refinedAveragePrice = refinedAverage(values);
    const trend7d = computeTrend(analysisBase, 7);
    const trend30d = computeTrend(analysisBase, 30);
    const localConfidenceScore = computeConfidenceScore(analysisBase.length, anomalyCount, latest?.created_at);
    const relevantExternalPrices = selectRelevantExternalPrices({
      externalPrices: (externalPrices || []) as ExternalPriceRow[],
      productId,
      marketId,
      marketLookup,
      marketCityIdLookup,
    });
    const externalReference = buildExternalReference(relevantExternalPrices);
    const comparison = compareLocalVsExternal(refinedAveragePrice ?? mean(values), localConfidenceScore, externalReference);

    let status = 'normal';
    if (analysisBase.length < 3) status = 'insufficient_data';
    else if (anomalyCount >= Math.ceil(analysisBase.length / 3)) status = 'anomaly';
    else if ((trend7d || 0) >= 12 || (trend30d || 0) >= 20) status = 'expensive';
    else if ((trend7d || 0) <= -12 || (trend30d || 0) <= -20) status = 'cheap';
    else if (standardDeviation(values) > (refinedAveragePrice || 0) * 0.2) status = 'volatile';

    return {
      product_id: productId,
      market_id: marketId,
      sample_size: analysisBase.length,
      latest_price: latest?.normalizedPrice ?? null,
      average_price: refinedAveragePrice ?? mean(values),
      median_price: median(values),
      minimum_price: values.length ? Math.min(...values) : null,
      maximum_price: values.length ? Math.max(...values) : null,
      trend_7d: trend7d,
      trend_30d: trend30d,
      confidence_score: Math.max(localConfidenceScore, comparison.confidenceScore),
      external_average_price: comparison.externalAveragePrice,
      external_gap_percent: comparison.externalGapPercent,
      status,
      updated_at: new Date().toISOString(),
      reliabilityAssessments,
    };
  });

  const affectedPairs = snapshotRows.length
    ? snapshotRows.map((row) => ({ productId: row.product_id, marketId: row.market_id }))
    : requestedPairs;

  const priceReliabilityUpdates = snapshotRows.flatMap((row) => row.reliabilityAssessments || []);

  if (priceReliabilityUpdates.length) {
    const { error: reliabilityError } = await supabase.rpc('apply_price_reliability_updates', {
      p_updates: priceReliabilityUpdates.map((row) => ({
        id: row.id,
        reliability_status: row.reliability_status,
        reliability_score: row.reliability_score,
        validation_note: row.validation_note,
        verified_at: row.verified_at,
        is_verified: row.reliability_status === 'trusted' || row.reliability_status === 'confirmed',
      })),
    });

    if (reliabilityError) {
      return new Response(JSON.stringify({ error: reliabilityError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  if (snapshotRows.length) {
    const { error: snapshotError } = await supabase
      .from('market_price_snapshots')
      .upsert(
        snapshotRows.map(({ reliabilityAssessments, ...row }) => row),
        { onConflict: 'product_id,market_id' }
      );

    if (snapshotError) {
      return new Response(JSON.stringify({ error: snapshotError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  let snapshotsQuery = supabase
    .from('market_price_snapshots')
    .select(`
      *,
      products(name, unit),
      markets(name, city_id)
    `);

  if (isPairRefresh && affectedPairs.length) {
    snapshotsQuery = snapshotsQuery.or(buildPairFilters(affectedPairs));
  }

  const { data: snapshots, error: snapshotsError } = await snapshotsQuery;

  if (snapshotsError) {
    return new Response(JSON.stringify({ error: snapshotsError.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const alerts = ((snapshots || []) as SnapshotRow[]).flatMap(deriveAlerts);
  const generatedKeys = alerts.map((alert) => String(alert.alert_key));
  let alertsUpserted = 0;
  let alertsResolved = 0;

  if (generatedKeys.length) {
    const { data: existingAlerts, error: existingAlertsError } = await supabase
      .from('price_alerts')
      .select('id, alert_key, status, updated_at, alert_type')
      .in('alert_key', generatedKeys);

    if (existingAlertsError) {
      return new Response(JSON.stringify({ error: existingAlertsError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const existingByKey = new Map((existingAlerts || []).map((alert: any) => [alert.alert_key, alert]));
    const alertsToUpsert = alerts.filter((alert) => {
      const existingAlert = existingByKey.get(String(alert.alert_key));
      if (!existingAlert) {
        return true;
      }

      return shouldReactivateAlert(existingAlert);
    });

    if (alertsToUpsert.length) {
      const { error: alertsError } = await supabase
        .from('price_alerts')
        .upsert(alertsToUpsert, { onConflict: 'alert_key' });

      if (alertsError) {
        return new Response(JSON.stringify({ error: alertsError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      alertsUpserted = alertsToUpsert.length;

      // --- Envoi des Notifications Push ---
      const highPriorityAlerts = alertsToUpsert.filter((a) => a.priority >= 4);
      if (highPriorityAlerts.length > 0) {
        // 1. RÃ©cupÃ©rer les tokens des utilisateurs
        const { data: profiles } = await supabase
          .from('profiles')
          .select('expo_push_token, city_id, role')
          .not('expo_push_token', 'is', null);

        const notifications = highPriorityAlerts.flatMap((alert) => {
          const cityId = ((snapshots || []) as SnapshotRow[]).find(
            (snapshot) =>
              snapshot.product_id === alert.product_id &&
              snapshot.market_id === alert.market_id
          )?.markets?.city_id;
          const eligibleRoles = eligibleRolesForAlert(String(alert.alert_type || ''));

          return (profiles || [])
            .filter((profile: any) => profile.expo_push_token)
            .filter((profile: any) => !cityId || profile.city_id === cityId)
            .filter((profile: any) => eligibleRoles.includes(String(profile.role || 'client').toLowerCase()))
            .map((profile: any) => ({
              to: profile.expo_push_token,
              sound: 'default',
              title: `Alerte Yawana: ${alert.title}`,
              body: alert.message,
              data: { alert_key: alert.alert_key },
            }));
        });

        if (notifications.length > 0) {
          // 2. Envoyer Ã  l'API Expo
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(notifications),
          });
        }
      }
    }
  }

  if (affectedPairs.length) {
    const obsoleteIds: string[] = [];

    for (const pair of affectedPairs) {
      const { data: existingPairAlerts, error: pairAlertsError } = await supabase
        .from('price_alerts')
        .select('id, alert_key')
        .eq('status', 'active')
        .eq('product_id', pair.productId)
        .eq('market_id', pair.marketId);

      if (pairAlertsError) {
        return new Response(JSON.stringify({ error: pairAlertsError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      (existingPairAlerts || []).forEach((alert: { id: string; alert_key: string }) => {
        if (!generatedKeys.includes(alert.alert_key)) {
          obsoleteIds.push(alert.id);
        }
      });
    }

    if (obsoleteIds.length) {
      const uniqueObsoleteIds = Array.from(new Set(obsoleteIds));
      const { error: resolveError } = await supabase
        .from('price_alerts')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .in('id', uniqueObsoleteIds);

      if (resolveError) {
        return new Response(JSON.stringify({ error: resolveError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      alertsResolved = uniqueObsoleteIds.length;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scope: isPairRefresh ? 'pair' : 'all',
      pair: isPairRefresh
        ? {
            productId: requestedProductId,
            marketId: requestedMarketId,
          }
        : null,
      snapshots: snapshotRows.length,
      pricesScored: priceReliabilityUpdates.length,
      alerts: alerts.length,
      alertsUpserted,
      alertsResolved,
      comparisonLabels: ((snapshots || []) as SnapshotRow[]).map((snapshot) => ({
        productId: snapshot.product_id,
        marketId: snapshot.market_id,
        comparisonLabel: getSnapshotComparisonLabel(snapshot.external_gap_percent),
      })),
      runAt: new Date().toISOString(),
    }),
    {
      headers: corsHeaders,
    },
  );
});
