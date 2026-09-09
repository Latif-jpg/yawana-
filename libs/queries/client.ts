import { assertSupabaseConfigured, supabase } from '@/libs/supabase';
import type { MarketPriceSnapshotRow } from '@/libs/scanner';

export { assertSupabaseConfigured, supabase };

export const GUEST_PROFILE_ID = '00000000-0000-0000-0000-000000000000';
export const DEMO_SELLER_PROFILE_ID = '853d7644-0ef0-4560-ac80-585c541121ed';

export const EMPTY_REWARD_SUMMARY = {
  priceCount: 0,
  confirmedCount: 0,
  correctedCount: 0,
  dismissedCount: 0,
  totalPoints: 0,
  level: 1,
  nextLevelAt: 80,
  progressToNextLevel: 0,
  trustScore: 35,
  breakdown: [
    { label: 'Prix utiles', value: 0 },
    { label: 'Confirmations', value: 0 },
    { label: 'Corrections', value: 0 },
    { label: 'Bonus focus', value: 0 },
  ],
};

export function buildSubmissionHash(input: {
  product_id: string;
  market_id: string;
  recorded_by: string;
  price_value: number;
  quantity: number;
}) {
  return [
    input.product_id,
    input.market_id,
    input.recorded_by,
    input.price_value,
    input.quantity,
  ].join(':');
}

export function toSnapshotModel(snapshot: MarketPriceSnapshotRow) {
  const externalGapPercent = snapshot.external_gap_percent;

  return {
    productId: snapshot.product_id,
    marketId: snapshot.market_id,
    sampleSize: snapshot.sample_size,
    latestPrice: snapshot.latest_price,
    averagePrice: snapshot.average_price,
    medianPrice: snapshot.median_price,
    minimumPrice: snapshot.minimum_price,
    maximumPrice: snapshot.maximum_price,
    trend7d: snapshot.trend_7d,
    trend30d: snapshot.trend_30d,
    confidenceScore: Number(snapshot.confidence_score ?? 0),
    externalAveragePrice: snapshot.external_average_price,
    externalGapPercent,
    status: snapshot.status,
    updatedAt: snapshot.updated_at,
    comparisonLabel:
      externalGapPercent === null
        ? 'insufficient_data'
        : externalGapPercent <= -8
        ? 'below_external'
        : externalGapPercent >= 8
        ? 'above_external'
        : 'aligned',
  };
}

export async function invokeDailyRefresh(input?: { productId?: string; marketId?: string }) {
  const { data, error } = await supabase.functions.invoke('daily-refresh', {
    body: input ?? {},
  });

  if (error) {
    throw error;
  }

  return data;
}
