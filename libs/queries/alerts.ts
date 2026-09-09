import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase } from './client';
import type { PriceAlertRow, PriceAlertActionRow } from './types';

export function usePriceAlerts() {
  return useQuery<PriceAlertRow[]>({
    queryKey: ['price-alerts'],
    refetchInterval: 30000,
    queryFn: async () => {
      assertSupabaseConfigured();

      const [{ data: alerts, error: alertsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
        supabase
          .from('price_alerts')
          .select(`
            *,
            products(name, category, unit),
            markets(name, city_id)
          `)
          .eq('status', 'active')
          .order('priority', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(12),
        supabase
          .from('market_price_snapshots')
          .select('product_id, market_id, latest_price, status, confidence_score'),
      ]);

      if (alertsError) throw alertsError;
      if (snapshotsError) throw snapshotsError;

      const snapshotByPair = new Map(
        (snapshots ?? []).map((snapshot) => [
          `${snapshot.product_id}:${snapshot.market_id}`,
          snapshot,
        ])
      );

      return ((alerts ?? []) as PriceAlertRow[]).map((alert) => {
        const snapshot = snapshotByPair.get(`${alert.product_id}:${alert.market_id}`);
        return {
          ...alert,
          current_price: snapshot?.latest_price ? Number(snapshot.latest_price) : null,
          snapshot_status: snapshot?.status ?? null,
          snapshot_confidence: snapshot?.confidence_score ? Number(snapshot.confidence_score) : null,
        };
      });
    },
  });
}

export function useTargetedPriceAlerts(input: {
  cityId?: string | null;
  marketId?: string | null;
  role?: string | null;
}) {
  return useQuery<PriceAlertRow[]>({
    queryKey: ['price-alerts', 'targeted', input.cityId ?? 'all', input.marketId ?? 'all', input.role ?? 'client'],
    refetchInterval: 30000,
    queryFn: async () => {
      assertSupabaseConfigured();

      let alertsQuery = supabase
        .from('price_alerts')
        .select(`
          *,
          products(name, category, unit),
          markets(name, city_id)
        `)
        .eq('status', 'active');

      if (input.marketId) {
        alertsQuery = alertsQuery.eq('market_id', input.marketId);
      } else if (input.cityId) {
        alertsQuery = alertsQuery.eq('markets.city_id', input.cityId);
      }

      const { data: alerts, error: alertsError } = await alertsQuery
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(50);

      if (alertsError) {
        throw alertsError;
      }

      const { data: snapshots, error: snapshotsError } = await supabase
        .from('market_price_snapshots')
        .select('product_id, market_id, latest_price, status, confidence_score');

      if (snapshotsError) {
        throw snapshotsError;
      }

      const snapshotByPair = new Map(
        (snapshots ?? []).map((snapshot) => [
          `${snapshot.product_id}:${snapshot.market_id}`,
          snapshot,
        ])
      );

      const rolePriority = (alertType: string) => {
        const normalizedRole = String(input.role || 'client').toLowerCase();

        if (normalizedRole === 'seller' || normalizedRole === 'merchant' || normalizedRole === 'commercant') {
          if (alertType === 'price_spike') return 3;
          if (alertType === 'opportunity') return 2;
          return 1;
        }

        if (normalizedRole === 'collector') {
          if (alertType === 'conflict') return 3;
          if (alertType === 'stale_price') return 2;
          return 1;
        }

        if (alertType === 'opportunity') return 3;
        if (alertType === 'stale_price') return 2;
        return 1;
      };

      return ((alerts ?? []) as PriceAlertRow[])
        .map((alert) => {
          const snapshot = snapshotByPair.get(`${alert.product_id}:${alert.market_id}`);
          return {
            ...alert,
            current_price: snapshot?.latest_price ? Number(snapshot.latest_price) : null,
            snapshot_status: snapshot?.status ?? null,
            snapshot_confidence: snapshot?.confidence_score ? Number(snapshot.confidence_score) : null,
          };
        })
        .sort((a, b) => {
          const roleDelta = rolePriority(b.alert_type) - rolePriority(a.alert_type);
          if (roleDelta !== 0) {
            return roleDelta;
          }
          return b.priority - a.priority;
        });
    },
  });
}

export function useUserAlertActions(userId: string) {
  return useQuery<PriceAlertActionRow[]>({
    queryKey: ['user-alert-actions', userId],
    enabled: !!userId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('price_alert_actions')
        .select(`
          *,
          price_alerts(product_id, market_id)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as PriceAlertActionRow[];
    },
  });
}

export function useActOnPriceAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { alertId: string; userId: string; actionType: 'viewed' | 'confirmed' | 'dismissed' | 'updated_price' }) => {
      assertSupabaseConfigured();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id || session.user.id !== payload.userId) {
        throw new Error('Session invalide. Connectez-vous avant d agir sur une alerte.');
      }

      const { data, error } = await supabase.rpc('act_on_price_alert', {
        p_alert_id: payload.alertId,
        p_action_type: payload.actionType,
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['price-alerts', 'targeted'] });
      queryClient.invalidateQueries({ queryKey: ['user-alert-actions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-reward-summary', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-badges', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['zone-leaderboard'] });
    },
  });
}
