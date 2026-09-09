export type SupportedUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'bag';

export interface NormalizedMeasurement {
  unit: SupportedUnit;
  quantity: number;
  baseUnit: 'kg' | 'l' | 'unit' | 'bag';
  baseQuantity: number;
}

const UNIT_ALIASES: Record<string, SupportedUnit> = {
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

export function normalizeProductName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function formatProductCategory(category: string) {
  const normalized = normalizeProductName(category);

  if (!normalized) {
    return '';
  }

  const aliases: Record<string, string> = {
    cereal: 'Cereales',
    cereals: 'Cereales',
    cereale: 'Cereales',
    cereales: 'Cereales',
    legume: 'Legumes',
    legumes: 'Legumes',
    fruit: 'Fruits',
    fruits: 'Fruits',
    epicerie: 'Epicerie',
    viande: 'Viandes',
    viandes: 'Viandes',
    boisson: 'Boissons',
    boissons: 'Boissons',
    menage: 'Menage',
    construction: 'Construction',
    boutique: 'Boutique',
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeUnit(unit: string): SupportedUnit {
  const normalized = normalizeProductName(unit);
  return UNIT_ALIASES[normalized] ?? 'unit';
}

export function normalizeMeasurement(unit: string, quantity = 1): NormalizedMeasurement {
  const normalizedUnit = normalizeUnit(unit);

  if (normalizedUnit === 'g') {
    return {
      unit: normalizedUnit,
      quantity,
      baseUnit: 'kg',
      baseQuantity: quantity / 1000,
    };
  }

  if (normalizedUnit === 'ml') {
    return {
      unit: normalizedUnit,
      quantity,
      baseUnit: 'l',
      baseQuantity: quantity / 1000,
    };
  }

  return {
    unit: normalizedUnit,
    quantity,
    baseUnit: normalizedUnit,
    baseQuantity: quantity,
  };
}

export function normalizePricePerBaseUnit(priceValue: number, unit: string, quantity = 1) {
  const measurement = normalizeMeasurement(unit, quantity);
  const divisor = measurement.baseQuantity || 1;

  return {
    ...measurement,
    normalizedPrice: priceValue / divisor,
  };
}
