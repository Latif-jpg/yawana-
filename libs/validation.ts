/**
 * Calcule si un prix est une anomalie basee sur la moyenne et l'ecart-type.
 * @param price Le nouveau prix saisi
 * @param existingPrices Liste des prix recents pour le meme produit/marche
 * @returns { isAnomaly: boolean, reason?: string, confidence: number }
 */
export function validatePrice(price: number, existingPrices: number[]) {
  if (!Number.isFinite(price) || price <= 0) {
    return { isAnomaly: true, confidence: 0, reason: 'Le prix doit être supérieur à zéro.' };
  }

  if (existingPrices.length < 3) {
    return { isAnomaly: false, confidence: 0.5, reason: 'Pas assez de données' };
  }

  const mean = existingPrices.reduce((a, b) => a + b, 0) / existingPrices.length;
  const squareDiffs = existingPrices.map((p) => Math.pow(p - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  if (stdDev === 0) {
    return {
      isAnomaly: price !== mean,
      confidence: price === mean ? 1 : 0.4,
      reason: price !== mean ? `Prix inattendu. Référence stable à ${Math.round(mean)} FCFA.` : undefined,
    };
  }

  const zScore = Math.abs(price - mean) / stdDev;
  const isAnomaly = zScore > 2.5;

  return {
    isAnomaly,
    confidence: Math.max(0, 1 - zScore / 5),
    reason: isAnomaly ? `Prix trop éloigné de la moyenne (${Math.round(mean)} FCFA).` : undefined,
  };
}

/**
 * Filtre les prix aberrants pour le calcul de la moyenne globale.
 */
export function getRefinedAverage(prices: number[]) {
  if (prices.length === 0) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(prices.map((p) => Math.pow(p - mean, 2)).reduce((a, b) => a + b, 0) / prices.length);

  const validPrices = prices.filter((p) => Math.abs(p - mean) <= 2 * stdDev);
  return validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
}
