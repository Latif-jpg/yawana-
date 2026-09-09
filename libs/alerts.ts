import type { SnapshotRow } from '@/libs/queries';

export interface GeneratedAlert {
  alertKey: string;
  productId: string;
  marketId: string;
  alertType: 'stale_price' | 'price_spike' | 'conflict' | 'opportunity';
  title: string;
  message: string;
  priority: number;
  signalValue: number | null;
}

function ageInDays(updatedAt?: string | null) {
  if (!updatedAt) {
    return 999;
  }

  return (Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000);
}

export function deriveAlertsFromSnapshot(snapshot: SnapshotRow): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];
  const productName = snapshot.products?.name || 'ce produit';
  const marketName = snapshot.markets?.name || 'ce marche';
  const snapshotAge = ageInDays(snapshot.updated_at);
  const confidence = Number(snapshot.confidence_score ?? 0);
  const trend7d = Number(snapshot.trend_7d ?? 0);
  const externalGap = snapshot.external_gap_percent === null ? null : Number(snapshot.external_gap_percent);

  if (snapshot.sample_size < 3 || snapshotAge >= 5 || confidence < 0.45) {
    alerts.push({
      alertKey: `${snapshot.product_id}:${snapshot.market_id}:stale_price`,
      productId: snapshot.product_id,
      marketId: snapshot.market_id,
      alertType: 'stale_price',
      title: 'Prix a confirmer',
      message: `Le prix de ${productName} au ${marketName} a besoin d'une confirmation recente.`,
      priority: snapshotAge >= 7 ? 5 : 4,
      signalValue: snapshotAge,
    });
  }

  if (trend7d >= 10) {
    alerts.push({
      alertKey: `${snapshot.product_id}:${snapshot.market_id}:price_spike`,
      productId: snapshot.product_id,
      marketId: snapshot.market_id,
      alertType: 'price_spike',
      title: 'Hausse inhabituelle',
      message: `${productName} semble monter vite au ${marketName}. Un releve terrain permettrait de confirmer.`,
      priority: 5,
      signalValue: trend7d,
    });
  }

  if (snapshot.status === 'volatile' || snapshot.status === 'anomaly') {
    alerts.push({
      alertKey: `${snapshot.product_id}:${snapshot.market_id}:conflict`,
      productId: snapshot.product_id,
      marketId: snapshot.market_id,
      alertType: 'conflict',
      title: 'Prix a clarifier',
      message: `Les releves de ${productName} au ${marketName} sont encore tres disperses. Un nouveau prix aiderait a trancher.`,
      priority: 4,
      signalValue: confidence,
    });
  }

  if (externalGap !== null && externalGap <= -8) {
    alerts.push({
      alertKey: `${snapshot.product_id}:${snapshot.market_id}:opportunity`,
      productId: snapshot.product_id,
      marketId: snapshot.market_id,
      alertType: 'opportunity',
      title: 'Bon plan a verifier',
      message: `${productName} parait moins cher au ${marketName} que la reference web. Pouvez-vous verifier si c'est toujours vrai ?`,
      priority: 3,
      signalValue: externalGap,
    });
  }

  return alerts;
}
