import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook pour exécuter une action avec un délai de "debounce".
 * Utile pour les recherches, filtres et sauvegardes automatiques.
 *
 * @param fn - La fonction à exécuter après le délai
 * @param delay - Le délai en millisecondes (défaut: 300ms)
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedFn;
}
