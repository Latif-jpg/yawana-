import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase, buildSubmissionHash, invokeDailyRefresh } from './client';
import type { PriceRow, ProductConsultationRow, UserPriceHistoryRow } from './types';
import { MOCK_PRICES } from '@/constants/MockData';
import { normalizeProductName, normalizeUnit } from '@/libs/normalization';

export function usePrices() {
  return useQuery<PriceRow[]>({
    queryKey: ['prices'],
    refetchInterval: 60000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        assertSupabaseConfigured();

        const { data, error } = await supabase
          .from('prices')
          .select(`
            *,
            products(name, category, unit),
            markets(name, city_id),
            shops!shop_id(id, name, contact_info, trust_score, is_verified)
          `)
          .order('created_at', { ascending: false })
          .limit(200);
        
        if (error) throw error;
        return (data ?? []).map((item) => ({
          ...item,
          unit: item.products?.unit ?? 'unit',
          quantity: Number(item.quantity ?? 1),
          price_value: Number(item.price_value ?? 0),
        })) as PriceRow[];
      } catch (err) {
        if (__DEV__) {
          console.warn('[usePrices] Baseline secours activée:', err);
        }
        return MOCK_PRICES as PriceRow[];
      }
    },
  });
}

export function useMarketProductConsultations(marketId?: string) {
  return useQuery<ProductConsultationRow[]>({
    queryKey: ['product-consultations', marketId ?? 'all'],
    enabled: !!marketId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('price_consultations')
        .select(`
          id,
          user_id,
          market_id,
          product_id,
          source,
          created_at,
          products(name, category, unit)
        `)
        .eq('market_id', marketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ProductConsultationRow[];
    },
  });
}

export function useRecordProductConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ marketId, productId }: { marketId: string; productId: string }) => {
      assertSupabaseConfigured();

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        return null;
      }

      const { error } = await supabase.from('price_consultations').insert({
        market_id: marketId,
        product_id: productId,
        user_id: userId,
        source: 'market_prices',
      });

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-consultations'] });
    },
  });
}

export function useUserRecentMarkets(userId: string) {
  return useQuery({
    queryKey: ['user-recent-markets', userId],
    enabled: !!userId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('prices')
        .select(`
          market_id,
          created_at,
          markets(name, city_id)
        `)
        .eq('recorded_by', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const seen = new Set<string>();
      return (data ?? []).filter((entry: any) => {
        if (!entry.market_id || seen.has(entry.market_id)) {
          return false;
        }

        seen.add(entry.market_id);
        return true;
      });
    },
  });
}

export function useUserPriceHistory(userId: string, options?: { enabled?: boolean }) {
  return useQuery<UserPriceHistoryRow[]>({
    queryKey: ['user-price-history', userId],
    enabled: !!userId && (options?.enabled ?? true),
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('prices')
        .select(`
          id,
          product_id,
          market_id,
          price_value,
          quantity,
          currency,
          created_at,
          reliability_status,
          reliability_score,
          validation_note,
          verified_at,
          products(name, category, unit),
          markets(name, city_id)
        `)
        .eq('recorded_by', userId)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;

      return ((data ?? []) as any[]).map((item) => ({
        ...item,
        quantity: Number(item.quantity ?? 1),
        price_value: Number(item.price_value ?? 0),
      })) as UserPriceHistoryRow[];
    },
  });
}

export function useLatestPrice(productId?: string, marketId?: string) {
  return useQuery({
    queryKey: ['latest-price', productId, marketId],
    enabled: !!productId && !!marketId,
    queryFn: async () => {
      assertSupabaseConfigured();
      const { data, error } = await supabase
        .from('prices')
        .select('*')
        .eq('product_id', productId)
        .eq('market_id', marketId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
}

export function useAddPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPrice: { 
      product_id: string; 
      price_value: number; 
      quantity: number; 
      market_id: string; 
      shop_id?: string;
      recorded_by: string 
    }) => {
      assertSupabaseConfigured();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id || session.user.id !== newPrice.recorded_by) {
        throw new Error('Session invalide. Connectez-vous avant d envoyer un releve de prix.');
      }

      const submissionHash = buildSubmissionHash(newPrice);
      const duplicateWindowIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: existingDuplicate, error: duplicateError } = await supabase
        .from('prices')
        .select('id, created_at')
        .eq('submission_hash', submissionHash)
        .gte('created_at', duplicateWindowIso)
        .maybeSingle();

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        throw duplicateError;
      }

      if (existingDuplicate) {
        throw new Error('Ce prix semble deja avoir ete envoye recemment pour ce produit dans ce marche.');
      }

      const { data, error } = await supabase.rpc('submit_price_entry', {
        p_product_id: newPrice.product_id,
        p_market_id: newPrice.market_id,
        p_price_value: newPrice.price_value,
        p_quantity: newPrice.quantity,
        p_submission_hash: submissionHash,
        p_shop_id: newPrice.shop_id ?? null,
      });
      
      if (error) throw error;

      return data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats', variables.recorded_by] });
      queryClient.invalidateQueries({ queryKey: ['user-reward-summary', variables.recorded_by] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.recorded_by] });
      queryClient.invalidateQueries({ queryKey: ['user-badges', variables.recorded_by] });
      queryClient.invalidateQueries({ queryKey: ['zone-leaderboard'] });
      void invokeDailyRefresh({ productId: variables.product_id, marketId: variables.market_id })
        .catch(() => undefined)
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ['intelligence-snapshots'] });
          queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['product-market-intelligence', variables.product_id, variables.market_id] });
        });
    },
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newProduct: { name: string; category: string; unit: string; image_url?: string | null }) => {
      assertSupabaseConfigured();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error('Connexion requise pour creer un produit.');
      }

      const sanitizedProduct = {
        ...newProduct,
        name: newProduct.name.trim(),
        category: newProduct.category.trim(),
        unit: newProduct.unit.trim(),
        image_url: newProduct.image_url?.trim() || null,
      };

      const { data: existingProducts, error: existingProductsError } = await supabase
        .from('products')
        .select('id, name, category, unit');

      if (existingProductsError) throw existingProductsError;

      const normalizedName = normalizeProductName(sanitizedProduct.name);
      const normalizedCategory = normalizeProductName(sanitizedProduct.category);
      const normalizedUnit = normalizeUnit(sanitizedProduct.unit);

      const duplicate = (existingProducts ?? []).find((product: any) => {
        return (
          normalizeProductName(product.name || '') === normalizedName &&
          normalizeProductName(product.category || '') === normalizedCategory &&
          normalizeUnit(product.unit || 'unit') === normalizedUnit
        );
      });

      if (duplicate) {
        throw new Error('Ce produit existe deja dans cette categorie avec la meme unite.');
      }

      const { data, error } = await supabase
        .from('products')
        .insert([sanitizedProduct])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
