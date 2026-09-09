import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase, toSnapshotModel, invokeDailyRefresh } from './client';
import type { DashboardSummaryRow, SnapshotRow, ExternalSourceHealth, PriceRow } from './types';
import type { ExternalPricePoint, MarketPriceSnapshotRow } from '@/libs/scanner';
import { normalizePricePerBaseUnit } from '@/libs/normalization';
import { MOCK_DASHBOARD_SUMMARY } from '@/constants/MockData';

async function fetchLocalPrices(productId: string, marketId: string) {
  const { data, error } = await supabase
    .from('prices')
    .select(`
      *,
      products(name, category, unit),
      markets(name, city_id)
    `)
    .eq('product_id', productId)
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return ((data ?? []) as any[]).map((item) => ({
    ...item,
    unit: item.products?.unit ?? 'unit',
    quantity: Number(item.quantity ?? 1),
    price_value: Number(item.price_value ?? 0),
  })) as PriceRow[];
}

export function useDashboardSummary() {
  return useQuery<DashboardSummaryRow[]>({
    queryKey: ['dashboard-summary'],
    refetchInterval: 30000,
    staleTime: 10000,
    queryFn: async () => {
      try {
        assertSupabaseConfigured();

        const { data, error } = await supabase.rpc('get_dashboard_summary');

        if (error) {
          throw error;
        }

        return (data ?? []) as DashboardSummaryRow[];
      } catch (err) {
        if (__DEV__) {
          console.warn('[useDashboardSummary] Baseline secours activée:', err);
        }
        return MOCK_DASHBOARD_SUMMARY as DashboardSummaryRow[];
      }
    },
  });
}

export function useExternalPriceSources(productId?: string) {
  return useQuery<ExternalPricePoint[]>({
    queryKey: ['external-price-sources', productId ?? 'all'],
    queryFn: async () => {
      assertSupabaseConfigured();

      let query = supabase
        .from('external_price_sources')
        .select('*')
        .order('collected_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map((item) => ({
        ...item,
        quantity: Number(item.quantity ?? 1),
        price_value: Number(item.price_value ?? 0),
        confidence_score: Number(item.confidence_score ?? 0.5),
      })) as ExternalPricePoint[];
    },
  });
}

export function useExternalSourceHealth() {
  return useQuery<ExternalSourceHealth>({
    queryKey: ['external-source-health'],
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('external_price_sources')
        .select('source_type, collected_at, source_name')
        .order('collected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        return {
          mode: 'unknown',
          collectedAt: null,
          sourceName: null,
        };
      }

      return {
        mode: data.source_type === 'ai_web_search' ? 'ai_web_search' : 'public_dataset',
        collectedAt: data.collected_at ?? null,
        sourceName: data.source_name ?? null,
      };
    },
  });
}

export function useIntelligenceSnapshots() {
  return useQuery({
    queryKey: ['intelligence-snapshots'],
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('market_price_snapshots')
        .select(`
          *,
          products(name, category, unit),
          markets(name, city_id)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SnapshotRow[];
    },
  });
}

export function useProductMarketIntelligence(productId?: string, marketId?: string) {
  return useQuery({
    queryKey: ['product-market-intelligence', productId, marketId],
    enabled: !!productId && !!marketId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const refreshPromise = invokeDailyRefresh({ productId: productId!, marketId: marketId! });
      const localPricesPromise = fetchLocalPrices(productId!, marketId!);

      await refreshPromise;

      const { data: storedSnapshot, error: snapshotError } = await supabase
        .from('market_price_snapshots')
        .select('*')
        .eq('product_id', productId)
        .eq('market_id', marketId)
        .maybeSingle();

      const localPrices = await localPricesPromise;

      if (snapshotError && snapshotError.code !== 'PGRST116') {
        throw snapshotError;
      }

      const localNormalizedPrices = localPrices.map((item) =>
        normalizePricePerBaseUnit(item.price_value, item.unit, item.quantity).normalizedPrice
      );

      return {
        snapshot: storedSnapshot ? toSnapshotModel(storedSnapshot as MarketPriceSnapshotRow) : null,
        localNormalizedPrices,
        latestLocalPrice: localPrices[0] ?? null,
      };
    },
  });
}

export function usePersistMarketSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, marketId }: { productId: string; marketId: string }) => {
      assertSupabaseConfigured();
      return invokeDailyRefresh({ productId, marketId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['product-market-intelligence', variables.productId, variables.marketId] });
    },
  });
}

export function useRefreshAllSnapshots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      assertSupabaseConfigured();
      return invokeDailyRefresh();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });
}
