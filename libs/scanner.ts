import { computePriceAnalytics, type PricePoint } from '@/libs/analytics';
import { compareLocalVsExternal } from '@/libs/comparison';
import { normalizePricePerBaseUnit } from '@/libs/normalization';

export interface ExternalPricePoint {
  id: string;
  product_id: string;
  price_value: number;
  unit: string;
  quantity?: number;
  confidence_score?: number;
  collected_at: string;
}

export interface ScanSnapshot {
  productId: string;
  marketId: string;
  sampleSize: number;
  latestPrice: number | null;
  averagePrice: number | null;
  medianPrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  trend7d: number | null;
  trend30d: number | null;
  confidenceScore: number;
  externalAveragePrice: number | null;
  externalGapPercent: number | null;
  status: 'normal' | 'cheap' | 'expensive' | 'volatile' | 'insufficient_data' | 'anomaly';
  comparisonLabel: 'aligned' | 'below_external' | 'above_external' | 'insufficient_data';
}

export interface MarketPriceSnapshotRow {
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
  status: ScanSnapshot['status'];
  updated_at: string;
}

function buildExternalReference(externalPrices: ExternalPricePoint[]) {
  if (!externalPrices.length) {
    return null;
  }

  const normalized = externalPrices.map((price) => ({
    normalizedPrice: normalizePricePerBaseUnit(price.price_value, price.unit, price.quantity ?? 1).normalizedPrice,
    confidence: price.confidence_score ?? 0.5,
  }));

  const averagePrice =
    normalized.reduce((sum, item) => sum + item.normalizedPrice, 0) / normalized.length;
  const confidenceScore =
    normalized.reduce((sum, item) => sum + item.confidence, 0) / normalized.length;

  return {
    averagePrice,
    sampleSize: normalized.length,
    confidenceScore,
  };
}

export function scanMarketProduct(input: {
  productId: string;
  marketId: string;
  localPrices: PricePoint[];
  externalPrices?: ExternalPricePoint[];
}): ScanSnapshot {
  const localAnalytics = computePriceAnalytics(input.localPrices);
  const externalReference = buildExternalReference(input.externalPrices ?? []);
  const comparison = compareLocalVsExternal({
    localPrice: localAnalytics.refinedAveragePrice,
    localConfidenceScore: localAnalytics.confidenceScore,
    externalReference,
  });

  return {
    productId: input.productId,
    marketId: input.marketId,
    sampleSize: localAnalytics.sampleSize,
    latestPrice: localAnalytics.latestPrice,
    averagePrice: localAnalytics.refinedAveragePrice ?? localAnalytics.averagePrice,
    medianPrice: localAnalytics.medianPrice,
    minimumPrice: localAnalytics.minimumPrice,
    maximumPrice: localAnalytics.maximumPrice,
    trend7d: localAnalytics.trend7d,
    trend30d: localAnalytics.trend30d,
    confidenceScore: Math.max(localAnalytics.confidenceScore, comparison.confidenceScore),
    externalAveragePrice: comparison.externalAveragePrice,
    externalGapPercent: comparison.externalGapPercent,
    status: localAnalytics.status,
    comparisonLabel: comparison.label,
  };
}

export function toMarketPriceSnapshotRow(snapshot: ScanSnapshot): MarketPriceSnapshotRow {
  return {
    product_id: snapshot.productId,
    market_id: snapshot.marketId,
    sample_size: snapshot.sampleSize,
    latest_price: snapshot.latestPrice,
    average_price: snapshot.averagePrice,
    median_price: snapshot.medianPrice,
    minimum_price: snapshot.minimumPrice,
    maximum_price: snapshot.maximumPrice,
    trend_7d: snapshot.trend7d,
    trend_30d: snapshot.trend30d,
    confidence_score: snapshot.confidenceScore,
    external_average_price: snapshot.externalAveragePrice,
    external_gap_percent: snapshot.externalGapPercent,
    status: snapshot.status,
    updated_at: new Date().toISOString(),
  };
}
