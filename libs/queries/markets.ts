import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase } from './client';
import { MOCK_CITIES, MOCK_MARKETS } from '@/constants/MockData';

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        assertSupabaseConfigured();

        const { data, error } = await supabase
          .from('cities')
          .select('*')
          .order('name');

        if (error) throw error;
        return data ?? [];
      } catch (err) {
        if (__DEV__) {
          console.warn('[useCities] Baseline secours activée:', err);
        }
        return MOCK_CITIES;
      }
    },
  });
}

export function useAddMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (market: { name: string; city_id?: string; market_type: string; latitude?: number; longitude?: number }) => {
      assertSupabaseConfigured();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error('Connexion requise pour creer un marche.');
      }

      const sanitizedMarket = {
        ...market,
        name: market.name.trim(),
      };

      const { data, error } = await supabase
        .from('markets')
        .insert([sanitizedMarket])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['markets-geo'] });
    },
  });
}

export function useMarketsWithCoords() {
  return useQuery({
    queryKey: ['markets-geo'],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        assertSupabaseConfigured();
        const { data, error } = await supabase
          .from('markets')
          .select('*')
          .not('latitude', 'is', null)
          .order('name');
        
        if (error) throw error;
        return data;
      } catch (err) {
        if (__DEV__) {
          console.warn('[useMarketsWithCoords] Baseline secours activée:', err);
        }
        return MOCK_MARKETS;
      }
    },
  });
}
