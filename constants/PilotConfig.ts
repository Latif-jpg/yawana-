/**
 * Configuration Officielle du Lancement Pilote MarketRadar / Aviprod
 * Périmètre géographique initial : Burkina Faso — 5 Pôles / Régions Stratégiques
 */

export interface PilotHub {
  id: string;
  cityName: string;
  regionName: string;
  description: string;
  role: 'consumption' | 'production' | 'transit' | 'collection';
  latitude: number;
  longitude: number;
  featuredMarkets: string[];
}

export const PILOT_CONFIG = {
  country: 'Burkina Faso',
  countryCode: 'BF',
  isPilotRestricted: true,
  pilotHubs: [
    {
      id: 'ouagadougou',
      cityName: 'Ouagadougou',
      regionName: 'Centre',
      description: 'Capitale politique et économique — Principal bassin de consommation',
      role: 'consumption',
      latitude: 12.3714,
      longitude: -1.5197,
      featuredMarkets: ['Rood Woko', 'Sankariaré', 'Katr-Yaar', 'Marché de 10-Yaar'],
    },
    {
      id: 'bobo-dioulasso',
      cityName: 'Bobo-Dioulasso',
      regionName: 'Hauts-Bassins',
      description: 'Capitale économique — Hub de production agricole, avicole et transit',
      role: 'production',
      latitude: 11.1771,
      longitude: -4.2979,
      featuredMarkets: ['Grand Marché de Bobo', 'Marché de Nieneta', 'Marché d’Accartville'],
    },
    {
      id: 'koudougou',
      cityName: 'Koudougou',
      regionName: 'Centre-Ouest',
      description: 'Pôle commercial et carrefour stratégique du Centre-Ouest',
      role: 'transit',
      latitude: 12.2514,
      longitude: -2.3622,
      featuredMarkets: ['Grand Marché de Koudougou', 'Marché Central'],
    },
    {
      id: 'ouahigouya',
      cityName: 'Ouahigouya',
      regionName: 'Nord',
      description: 'Pôle de collecte et d’échange de céréales et cultures maraîchères',
      role: 'collection',
      latitude: 13.5828,
      longitude: -2.4216,
      featuredMarkets: ['Grand Marché de Ouahigouya', 'Marché Céréalier du Nord'],
    },
    {
      id: 'gaoua',
      cityName: 'Gaoua',
      regionName: 'Sud-Ouest',
      description: 'Bassin de production vivrière, fruitière et d’élevage du Sud-Ouest',
      role: 'production',
      latitude: 10.3276,
      longitude: -3.1818,
      featuredMarkets: ['Grand Marché de Gaoua', 'Marché Central de Gaoua'],
    },
  ] as PilotHub[],
  pilotRegionNames: ['Centre', 'Hauts-Bassins', 'Centre-Ouest', 'Nord', 'Sud-Ouest'],
  pilotCityNames: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya', 'Gaoua'],
};

/**
 * Utilitaire pour vérifier si une ville fait partie du programme pilote
 */
export function isPilotCity(cityName?: string | null): boolean {
  if (!cityName) return false;
  const normalized = cityName.trim().toLowerCase();
  return PILOT_CONFIG.pilotCityNames.some((c) => c.toLowerCase() === normalized);
}

/**
 * Utilitaire pour vérifier si une région fait partie du programme pilote
 */
export function isPilotRegion(regionName?: string | null): boolean {
  if (!regionName) return false;
  const normalized = regionName.trim().toLowerCase();
  return PILOT_CONFIG.pilotRegionNames.some((r) => r.toLowerCase() === normalized);
}

/**
 * Filtrer une liste d'objets marchands/villes par le périmètre pilote
 */
export function filterPilotItems<T extends { city_name?: string; region?: string; city?: string }>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((item) => {
    if (item.city_name && isPilotCity(item.city_name)) return true;
    if (item.city && isPilotCity(item.city)) return true;
    if (item.region && isPilotRegion(item.region)) return true;
    // Si ni ville ni région n'est spécifiée, on conserve pour ne pas bloquer par défaut
    return !item.city_name && !item.city && !item.region;
  });
}
