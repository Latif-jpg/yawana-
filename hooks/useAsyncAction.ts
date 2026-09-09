import { useCallback, useState } from 'react';

/**
 * Hook pour gérer les états de chargement, succès et erreur d'une action asynchrone.
 * Évite la duplication de code try/catch dans les composants.
 */
export function useAsyncAction<TArgs extends any[], TResult = void>(
  action: (...args: TArgs) => Promise<TResult>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await action(...args);
        setResult(res);
        return res;
      } catch (err: any) {
        const message = err?.message || 'Une erreur est survenue.';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [action]
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsLoading(false);
  }, []);

  return { execute, isLoading, error, result, reset };
}
