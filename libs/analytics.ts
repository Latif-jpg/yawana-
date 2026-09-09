import { normalizePricePerBaseUnit } from '@/libs/normalization';

export interface PricePoint {
  id: string;
  product_id: string;
  market_id: string;
  price_value: number;
  unit: string;
  quantity?: number;
  created_at: string;
  reliability_status?: 'pending' | 'confirmed' | 'conflicted' | 'trusted' | null;
  reliability_score?: number | null;
}

export interface PriceAnalytics {
  sampleSize: number;
  latestPrice: number | null;
  averagePrice: number | null;
  medianPrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  refinedAveragePrice: number | null;
  trend7d: number | null;
  trend30d: number | null;
  anomalyCount: number;
  confidenceScore: number;
  status: 'normal' | 'cheap' | 'expensive' | 'volatile' | 'insufficient_data' | 'anomaly';
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
  if (avg === null) return null;
  const stdDev = standardDeviation(values);
  if (stdDev === 0) return avg;

  const filtered = values.filter((value) => Math.abs(value - avg) <= 2 * stdDev);
  return mean(filtered.length ? filtered : values);
}

function computeTrend(values: PricePoint[], days: number) {
  if (!values.length) return null;

  const now = Date.now();
  const windowStart = now - days * 24 * 60 * 60 * 1000;
  const windowValues = values
    .filter((value) => new Date(value.created_at).getTime() >= windowStart)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (windowValues.length < 2) return null;

  const first = normalizePricePerBaseUnit(
    windowValues[0].price_value,
    windowValues[0].unit,
    windowValues[0].quantity ?? 1
  ).normalizedPrice;
  const last = normalizePricePerBaseUnit(
    windowValues[windowValues.length - 1].price_value,
    windowValues[windowValues.length - 1].unit,
    windowValues[windowValues.length - 1].quantity ?? 1
  ).normalizedPrice;

  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

export function detectAnomalyValues(values: number[]) {
  if (values.length < 3) return [];

  const avg = mean(values);
  if (avg === null) return [];
  const stdDev = standardDeviation(values);
  if (stdDev === 0) return [];

  return values.filter((value) => Math.abs(value - avg) / stdDev > 2.5);
}

export function computeConfidenceScore(input: {
  sampleSize: number;
  anomalyCount: number;
  latestTimestamp?: string | null;
}) {
  const sampleFactor = Math.min(1, input.sampleSize / 12);
  const anomalyPenalty = Math.min(0.5, input.anomalyCount * 0.08);

  let recencyFactor = 0.2;
  if (input.latestTimestamp) {
    const ageInDays = (Date.now() - new Date(input.latestTimestamp).getTime()) / (24 * 60 * 60 * 1000);
    recencyFactor = Math.max(0, 1 - ageInDays / 30);
  }

  return Math.max(0, Math.min(1, sampleFactor * 0.55 + recencyFactor * 0.45 - anomalyPenalty));
}

export function computePriceAnalytics(prices: PricePoint[]): PriceAnalytics {
  if (!prices.length) {
    return {
      sampleSize: 0,
      latestPrice: null,
      averagePrice: null,
      medianPrice: null,
      minimumPrice: null,
      maximumPrice: null,
      refinedAveragePrice: null,
      trend7d: null,
      trend30d: null,
      anomalyCount: 0,
      confidenceScore: 0,
      status: 'insufficient_data',
    };
  }

  const normalized = prices.map((price) => ({
    ...price,
    normalizedPrice: normalizePricePerBaseUnit(price.price_value, price.unit, price.quantity ?? 1).normalizedPrice,
  }));
  const preferred = normalized.filter(
    (price) => price.reliability_status === 'trusted' || price.reliability_status === 'confirmed'
  );
  const analysisBase = preferred.length >= 2 ? preferred : normalized;
  const values = analysisBase.map((price) => price.normalizedPrice);
  const latest = [...normalized].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  const anomalyCount = detectAnomalyValues(values).length;
  const refinedAveragePrice = refinedAverage(values);
  const trend7d = computeTrend(analysisBase, 7);
  const trend30d = computeTrend(analysisBase, 30);
  const confidenceScore = computeConfidenceScore({
    sampleSize: analysisBase.length,
    anomalyCount,
    latestTimestamp: latest.created_at,
  });

  let status: PriceAnalytics['status'] = 'normal';
  if (analysisBase.length < 3) status = 'insufficient_data';
  else if (anomalyCount >= Math.ceil(prices.length / 3)) status = 'anomaly';
  else if ((trend7d ?? 0) >= 12 || (trend30d ?? 0) >= 20) status = 'expensive';
  else if ((trend7d ?? 0) <= -12 || (trend30d ?? 0) <= -20) status = 'cheap';
  else if (standardDeviation(values) > (refinedAveragePrice ?? 0) * 0.2) status = 'volatile';

  return {
    sampleSize: analysisBase.length,
    latestPrice: latest.normalizedPrice,
    averagePrice: mean(values),
    medianPrice: median(values),
    minimumPrice: Math.min(...values),
    maximumPrice: Math.max(...values),
    refinedAveragePrice,
    trend7d,
    trend30d,
    anomalyCount,
    confidenceScore,
    status,
  };
}
