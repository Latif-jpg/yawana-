export interface ExternalReference {
  averagePrice: number | null;
  sampleSize: number;
  confidenceScore: number;
}

export interface ComparisonResult {
  externalAveragePrice: number | null;
  externalGapPercent: number | null;
  label: 'aligned' | 'below_external' | 'above_external' | 'insufficient_data';
  confidenceScore: number;
}

export function compareLocalVsExternal(input: {
  localPrice: number | null;
  localConfidenceScore: number;
  externalReference: ExternalReference | null;
}): ComparisonResult {
  const externalAveragePrice = input.externalReference?.averagePrice ?? null;

  if (!input.localPrice || !externalAveragePrice) {
    return {
      externalAveragePrice,
      externalGapPercent: null,
      label: 'insufficient_data',
      confidenceScore: 0,
    };
  }

  const externalGapPercent = ((input.localPrice - externalAveragePrice) / externalAveragePrice) * 100;
  const absoluteGap = Math.abs(externalGapPercent);

  let label: ComparisonResult['label'] = 'aligned';
  if (externalGapPercent <= -8) label = 'below_external';
  else if (externalGapPercent >= 8) label = 'above_external';

  const confidenceScore = Math.max(
    0,
    Math.min(
      1,
      input.localConfidenceScore * 0.6 + (input.externalReference?.confidenceScore ?? 0) * 0.4 - absoluteGap / 200
    )
  );

  return {
    externalAveragePrice,
    externalGapPercent,
    label,
    confidenceScore,
  };
}
