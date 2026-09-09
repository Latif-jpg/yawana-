import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase } from './client';
import type { BoutiqueItemRow, SearchableProductRow, SearchableProductsDebugRow } from './types';
import { normalizeProductName, normalizeUnit } from '@/libs/normalization';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useUserBoutiqueItems(userId: string) {
  return useQuery({
    queryKey: ['boutique-items', userId],
    enabled: !!userId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('boutique_items')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /boutique_items/i.test(String((error as any)?.message || ''))) {
          return [];
        }
        throw error;
      }
      return (data ?? []) as BoutiqueItemRow[];
    },
  });
}

export function useVisibleBoutiqueItems() {
  return useQuery({
    queryKey: ['boutique-items', 'visible'],
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('boutique_items')
        .select('*')
        .eq('is_visible_in_search', true)
        .order('created_at', { ascending: false });

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /boutique_items/i.test(String((error as any)?.message || ''))) {
          return [];
        }
        throw error;
      }

      return (data ?? []) as BoutiqueItemRow[];
    },
  });
}

export function useMarketplaceSellerLocations() {
  return useQuery({
    queryKey: ['marketplace-seller-locations'],
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data: items, error: itemsError } = await supabase
        .from('boutique_items')
        .select('owner_id')
        .eq('is_visible_in_search', true);

      if (itemsError) {
        if (String((itemsError as any)?.code || '') === '42P01' || /boutique_items/i.test(String((itemsError as any)?.message || ''))) {
          return [];
        }
        throw itemsError;
      }

      const ownerIds = Array.from(new Set((items ?? []).map((item: any) => item.owner_id).filter(Boolean)));
      if (!ownerIds.length) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, trust_score, market_access_tier, verified_market_badge, last_location_latitude, last_location_longitude')
        .in('id', ownerIds);

      if (profilesError) throw profilesError;

      return (profiles ?? [])
        .filter((profile: any) => Number.isFinite(Number(profile.last_location_latitude)) && Number.isFinite(Number(profile.last_location_longitude)))
        .map((profile: any) => ({
          id: profile.id,
          name: profile.full_name || 'Boutique locale',
          latitude: Number(profile.last_location_latitude),
          longitude: Number(profile.last_location_longitude),
          trustScore: Number(profile.trust_score ?? 0),
          verified: Boolean(profile.verified_market_badge) || String(profile.market_access_tier || '').toLowerCase() === 'verified',
        }));
    },
  });
}

export function useSearchableProducts() {
  return useQuery<SearchableProductRow[]>({
    queryKey: ['searchable-products'],
    queryFn: async () => {
      assertSupabaseConfigured();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const startedAt = Date.now();

      if (__DEV__) {
        console.log('[searchable_products] start', {
          userId: session?.user?.id ?? null,
        });
      }

      let rows: SearchableProductRow[] = [];
      const useRpc = String(process.env.EXPO_PUBLIC_ENABLE_SEARCHABLE_PRODUCTS_RPC || '').toLowerCase() === 'true';

      if (useRpc) {
        try {
          const { data, error } = await supabase.rpc('searchable_products');
          if (error) {
            if (__DEV__) {
              console.warn('[searchable_products] rpc fallback activated', {
                code: (error as any)?.code ?? null,
                message: (error as any)?.message ?? String(error),
              });
            }
          } else {
            rows = (data ?? []) as SearchableProductRow[];
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('[searchable_products] rpc exception fallback activated', {
              message: (error as any)?.message ?? String(error),
            });
          }
        }
      }

      let counts = {
        products: 0,
        boutiqueVisible: 0,
        boutiqueOwned: 0,
      };

      try {
        const [{ count: productsCount }, { count: visibleBoutiqueCount }, { count: ownedBoutiqueCount }] = await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('boutique_items').select('*', { count: 'exact', head: true }).eq('is_visible_in_search', true),
          session?.user?.id
            ? supabase.from('boutique_items').select('*', { count: 'exact', head: true }).eq('owner_id', session.user.id)
            : Promise.resolve({ count: 0 } as any),
        ]);

        counts = {
          products: Number(productsCount ?? 0),
          boutiqueVisible: Number(visibleBoutiqueCount ?? 0),
          boutiqueOwned: Number(ownedBoutiqueCount ?? 0),
        };
      } catch (countError) {
        if (__DEV__) {
          console.warn('[searchable_products] count snapshot fallback', {
            message: (countError as any)?.message ?? String(countError),
          });
        }
      }

      const fallbackRows: SearchableProductRow[] = [];
      if (!rows.length && (counts.products > 0 || counts.boutiqueVisible > 0 || counts.boutiqueOwned > 0)) {
        const [{ data: rawProducts }, { data: visibleBoutiqueItems }, { data: sellerProfiles }] = await Promise.all([
          supabase.from('products').select('*').order('name'),
          supabase.from('boutique_items').select('*').eq('is_visible_in_search', true).order('created_at', { ascending: false }),
          supabase.from('profiles').select('id, full_name, trust_score, market_access_tier, verified_market_badge'),
        ]);

        const sellerProfileById = new Map<string, any>();
        (sellerProfiles ?? []).forEach((profile: any) => {
          sellerProfileById.set(profile.id, profile);
        });

        const rawBoutiqueItems = visibleBoutiqueItems ?? [];

        const catalogRows = (rawProducts ?? []).map((product: any) => ({
          id: product.id,
          resolved_product_id: product.id,
          boutique_item_id: null,
          owner_id: null,
          name: product.name,
          category: product.category,
          unit: product.unit,
          image_url: product.image_url ?? null,
          price_value: null,
          source: 'catalog' as const,
          is_visible_in_search: true,
          created_at: product.created_at ?? null,
        }));

        const seen = new Set<string>();
        const mergedCatalog = new Map<string, SearchableProductRow>();
        catalogRows.forEach((row) => mergedCatalog.set(row.id, row));

        (rawBoutiqueItems ?? []).forEach((item: any) => {
          const sellerProfile = sellerProfileById.get(item.owner_id);
          const sellerTrustScore = Number(sellerProfile?.trust_score ?? 0);
          const sellerAccessTier = String(sellerProfile?.market_access_tier || '').toLowerCase();
          const sellerVerified = Boolean(sellerProfile?.verified_market_badge);
          const sellerEligible =
            sellerVerified ||
            sellerAccessTier === 'verified' ||
            sellerTrustScore >= 60;

          if (!sellerEligible) {
            return;
          }

          const key = item.product_id || [
            normalizeProductName(item.label || ''),
            normalizeProductName(item.category || ''),
            normalizeUnit(item.unit || 'unit'),
          ].join('|');

          if (seen.has(key)) {
            return;
          }
          seen.add(key);

          const fallbackCatalog = (rawProducts ?? []).find((product: any) => {
            return (
              normalizeProductName(product.name || '') === normalizeProductName(item.label || '') &&
              normalizeProductName(product.category || '') === normalizeProductName(item.category || '') &&
              normalizeUnit(product.unit || 'unit') === normalizeUnit(item.unit || 'unit')
            );
          });

          const resolvedProductId = item.product_id || fallbackCatalog?.id || null;
          const row: SearchableProductRow = {
            id: resolvedProductId || `boutique-${item.id}`,
            resolved_product_id: resolvedProductId,
            boutique_item_id: item.id,
            owner_id: item.owner_id,
            name: item.label,
            category: item.category,
            unit: item.unit,
            image_url: item.image_url ?? null,
            price_value: item.price_value != null ? Number(item.price_value) : null,
            source: 'boutique',
            is_visible_in_search: Boolean(item.is_visible_in_search),
            seller_full_name: sellerProfile?.full_name ?? null,
            seller_trust_score: sellerProfile?.trust_score ?? null,
            seller_market_access_tier: sellerProfile?.market_access_tier ?? null,
            seller_verified_market_badge: sellerProfile?.verified_market_badge ?? null,
            created_at: item.created_at ?? null,
          };

          if (resolvedProductId && mergedCatalog.has(resolvedProductId)) {
            mergedCatalog.set(resolvedProductId, {
              ...mergedCatalog.get(resolvedProductId)!,
              ...row,
              id: resolvedProductId,
              source: 'boutique',
            });
            return;
          }

          fallbackRows.push(row);
        });

        fallbackRows.push(...Array.from(mergedCatalog.values()));
      }

      const effectiveRows = rows.length ? rows : fallbackRows;
      const dedupedRows = Array.from(
        effectiveRows.reduce((map, row) => {
          const existing = map.get(row.id);
          if (!existing || (row.source === 'boutique' && existing.source !== 'boutique')) {
            map.set(row.id, row);
          }
          return map;
        }, new Map<string, SearchableProductRow>()).values()
      );

      if (__DEV__) {
        const summary = dedupedRows.reduce(
          (acc, row) => {
            const source = String(row.source || 'catalog');
            acc.total += 1;
            if (source === 'boutique') {
              acc.boutique += 1;
            } else {
              acc.catalog += 1;
            }
            if (row.boutique_item_id) {
              acc.withBoutiqueItemId += 1;
            }
            if (row.resolved_product_id) {
              acc.withResolvedProductId += 1;
            }
            return acc;
          },
          { total: 0, catalog: 0, boutique: 0, withBoutiqueItemId: 0, withResolvedProductId: 0 }
        );

        console.log('[searchable_products] done', {
          durationMs: Date.now() - startedAt,
          counts,
          usedFallback: rows.length === 0 && fallbackRows.length > 0,
          summary,
          sample: dedupedRows.slice(0, 5).map((row) => ({
            id: row.id,
            source: row.source,
            name: row.name,
            category: row.category,
            unit: row.unit,
            price_value: row.price_value,
            is_visible_in_search: row.is_visible_in_search,
            boutique_item_id: row.boutique_item_id,
            resolved_product_id: row.resolved_product_id,
          })),
        });

        if (!rows.length) {
          console.warn('[searchable_products] empty result set');
          console.warn('[searchable_products] counts snapshot', counts);
          if (fallbackRows.length) {
            console.warn('[searchable_products] fallback activated', {
              fallbackCount: fallbackRows.length,
              fallbackSample: fallbackRows.slice(0, 5).map((row) => ({
                id: row.id,
                source: row.source,
                name: row.name,
                category: row.category,
                unit: row.unit,
              })),
            });
          }
        }
      }

      return dedupedRows;
    },
  });
}

export function useSearchableProductsDebug() {
  return useQuery<SearchableProductsDebugRow[]>({
    queryKey: ['searchable-products-debug'],
    refetchInterval: 5000,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('search_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /search_debug_logs/i.test(String((error as any)?.message || ''))) {
          return [];
        }
        throw error;
      }

      return (data ?? []) as SearchableProductsDebugRow[];
    },
  });
}

export function useAddBoutiqueItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      owner_id: string;
      product_id?: string | null;
      label: string;
      category: string;
      unit: string;
      price_value?: number | null;
      image_url?: string | null;
      is_visible_in_search?: boolean;
    }) => {
      assertSupabaseConfigured();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id || session.user.id !== item.owner_id) {
        throw new Error('Session invalide. Connectez-vous avant d’ajouter un produit boutique.');
      }

      const sanitizedItem = {
        owner_id: item.owner_id,
        product_id: item.product_id ?? null,
        label: item.label.trim(),
        category: item.category.trim(),
        unit: item.unit.trim(),
        price_value: typeof item.price_value === 'number' && Number.isFinite(item.price_value) ? item.price_value : null,
        image_url: item.image_url?.trim() || null,
        is_visible_in_search: item.is_visible_in_search ?? true,
      };

      const { data, error } = await supabase
        .from('boutique_items')
        .insert([sanitizedItem])
        .select()
        .single();

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /boutique_items/i.test(String((error as any)?.message || ''))) {
          throw new Error('La table boutique_items n’est pas encore installée côté base. Lance la migration avant d’ajouter un produit boutique.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['boutique-items', variables.owner_id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
