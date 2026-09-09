import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export type ZoneDetectionState =
  | 'idle'
  | 'detecting'
  | 'success'
  | 'permission_denied'
  | 'not_found'
  | 'error';

export interface ZoneDetectionResult {
  latitude: number;
  longitude: number;
  cityName: string | null;
}

/**
 * Hook pour la détection GPS de la zone de l'utilisateur.
 * Gère les permissions, la détection et les états d'erreur.
 */
export function useZoneDetection() {
  const [state, setState] = useState<ZoneDetectionState>('idle');
  const [result, setResult] = useState<ZoneDetectionResult | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  const detect = useCallback(async (): Promise<ZoneDetectionResult | null> => {
    setState('detecting');
    setDebug(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setState('permission_denied');
        setDebug('Permission de localisation refusée.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocoding pour obtenir le nom de la ville
      let cityName: string | null = null;
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded.length > 0) {
          cityName = geocoded[0].city || geocoded[0].region || null;
        }
      } catch {
        // geocoding optionnel, on continue sans
      }

      const detectionResult: ZoneDetectionResult = { latitude, longitude, cityName };
      setResult(detectionResult);
      setState('success');
      setDebug(`Position détectée: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      return detectionResult;
    } catch (error: any) {
      setState('error');
      setDebug(error?.message || 'Erreur de détection de position.');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setDebug(null);
  }, []);

  return {
    state,
    result,
    debug,
    detect,
    reset,
    isDetecting: state === 'detecting',
    hasError: state === 'error' || state === 'permission_denied' || state === 'not_found',
  };
}
