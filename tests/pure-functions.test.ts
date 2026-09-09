import { describe, expect, it } from 'vitest';

import { compareLocalVsExternal } from '@/libs/comparison';
import { computePriceAnalytics } from '@/libs/analytics';
import { normalizePricePerBaseUnit, normalizeProductName, normalizeUnit } from '@/libs/normalization';
import { getRefinedAverage, validatePrice } from '@/libs/validation';

describe('normalization', () => {
  it('normalizes product names by removing accents and extra spaces', () => {
    expect(normalizeProductName('  Sac de Maïs   ')).toBe('sac de mais');
  });

  it('normalizes unit aliases to a shared base unit', () => {
    expect(normalizeUnit('Kilogrammes')).toBe('kg');
    expect(normalizeUnit('Sachet')).toBe('bag');
  });

  it('normalizes price per base unit for grams and kilograms', () => {
    const normalized = normalizePricePerBaseUnit(250, 'g', 500);
    expect(normalized.baseUnit).toBe('kg');
    expect(normalized.baseQuantity).toBe(0.5);
    expect(normalized.normalizedPrice).toBe(500);
  });
});

describe('validation', () => {
  it('flags invalid prices as anomalies', () => {
    expect(validatePrice(0, [100, 110, 120]).isAnomaly).toBe(true);
  });

  it('detects an outlier when enough data exists', () => {
    const result = validatePrice(200, [100, 102, 101, 99, 103]);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toMatch(/moyenne/i);
  });

  it('computes a refined average that ignores obvious outliers', () => {
    const values = Array.from({ length: 9 }, () => 100).concat([1000]);
    expect(getRefinedAverage(values)).toBeGreaterThan(99);
    expect(getRefinedAverage(values)).toBeLessThan(103);
  });
});

describe('analytics', () => {
  const prices = Array.from({ length: 9 }, (_, index) => ({
    id: String(index + 1),
    product_id: 'p1',
    market_id: 'm1',
    price_value: 100,
    unit: 'kg',
    quantity: 1,
    created_at: `2026-06-0${index + 1}T10:00:00.000Z`,
  })).concat([
    {
      id: '10',
      product_id: 'p1',
      market_id: 'm1',
      price_value: 1000,
      unit: 'kg',
      quantity: 1,
      created_at: '2026-06-10T10:00:00.000Z',
    },
  ]);

  it('computes a meaningful analytics summary', () => {
    const summary = computePriceAnalytics(prices);

    expect(summary.sampleSize).toBe(10);
    expect(summary.latestPrice).toBe(1000);
    expect(summary.minimumPrice).toBe(100);
    expect(summary.maximumPrice).toBe(1000);
    expect(summary.anomalyCount).toBeGreaterThanOrEqual(1);
    expect(summary.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(summary.confidenceScore).toBeLessThanOrEqual(1);
  });
});

describe('comparison', () => {
  it('labels a local price below the external reference', () => {
    const result = compareLocalVsExternal({
      localPrice: 90,
      localConfidenceScore: 0.8,
      externalReference: {
        averagePrice: 100,
        sampleSize: 3,
        confidenceScore: 0.7,
      },
    });

    expect(result.label).toBe('below_external');
    expect(result.externalGapPercent).toBeCloseTo(-10);
    expect(result.confidenceScore).toBeGreaterThan(0);
  });
});
