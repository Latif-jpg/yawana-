import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase, GUEST_PROFILE_ID, EMPTY_REWARD_SUMMARY } from './client';
import type { ProfileRow, UserRewardSummary } from './types';

export function useProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
}

export function useUserStats(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user-stats', userId],
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { count, error } = await supabase
        .from('prices')
        .select('*', { count: 'exact', head: true })
        .eq('recorded_by', userId);
      
      if (error) throw error;
      return { priceCount: count || 0 };
    },
  });
}

export function useUserRewardSummary(userId: string) {
  return useQuery({
    queryKey: ['user-reward-summary', userId],
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      assertSupabaseConfigured();

      if (userId === GUEST_PROFILE_ID) {
        return EMPTY_REWARD_SUMMARY;
      }

      const { data, error } = await supabase.rpc('compute_user_reward_summary', {
        p_user_id: userId,
      });

      if (error) throw error;

      const summary = Array.isArray(data) ? (data[0] as UserRewardSummary | undefined) : undefined;
      if (!summary) {
        return EMPTY_REWARD_SUMMARY;
      }

      return {
        priceCount: Number(summary.reward_price_count ?? 0),
        confirmedCount: Number(summary.reward_confirmed_count ?? 0),
        correctedCount: Number(summary.reward_corrected_count ?? 0),
        dismissedCount: Number(summary.reward_dismissed_count ?? 0),
        totalPoints: Number(summary.reward_total_points ?? 0),
        level: Number(summary.reward_level ?? 1),
        nextLevelAt: Number(summary.reward_next_level_at ?? 80),
        progressToNextLevel: Number(summary.reward_progress_to_next_level ?? 0),
        trustScore: Number(summary.reward_trust_score ?? 35),
        breakdown: [
          { label: 'Prix utiles', value: Number(summary.reward_contribution_points ?? 0) },
          { label: 'Confirmations', value: Number(summary.reward_confirmation_points ?? 0) },
          { label: 'Corrections', value: Number(summary.reward_correction_points ?? 0) },
          { label: 'Bonus focus', value: Number(summary.reward_focus_bonus ?? 0) },
        ],
      };
    },
  });
}

export function useZoneLeaderboard(cityId?: string | null, role?: string | null, options?: { enabled?: boolean }) {
  const devBoostEnabled = String(process.env.EXPO_PUBLIC_ENABLE_DEMO_RANKING || '').toLowerCase() === 'true';

  return useQuery({
    queryKey: ['zone-leaderboard', cityId ?? 'all', role ?? 'all'],
    enabled: !!cityId && (options?.enabled ?? true),
    queryFn: async () => {
      assertSupabaseConfigured();

      const [{ data: prices, error: pricesError }, { data: actions, error: actionsError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          supabase
            .from('prices')
            .select(`
              recorded_by,
              market_id,
              markets(city_id)
            `),
          supabase
            .from('price_alert_actions')
            .select('user_id, action_type'),
          supabase
            .from('profiles')
            .select('id, full_name, role, trust_score, city_id, market_access_tier, verified_market_badge'),
        ]);

      if (pricesError) throw pricesError;
      if (actionsError) throw actionsError;
      if (profilesError) throw profilesError;

      const priceCounts = new Map<string, number>();
      (prices ?? []).forEach((price: any) => {
        if (price.markets?.city_id !== cityId) {
          return;
        }

        const userId = price.recorded_by;
        if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
          return;
        }

        priceCounts.set(userId, (priceCounts.get(userId) ?? 0) + 1);
      });

      const actionStats = new Map<string, { confirmed: number; corrected: number }>();
      (actions ?? []).forEach((action: any) => {
        const current = actionStats.get(action.user_id) ?? { confirmed: 0, corrected: 0 };
        if (action.action_type === 'confirmed') current.confirmed += 1;
        if (action.action_type === 'updated_price') current.corrected += 1;
        actionStats.set(action.user_id, current);
      });

      const normalizedRole = role ? String(role).toLowerCase() : null;

      return ((profiles ?? []) as ProfileRow[])
        .filter(
          (profile: any) =>
            priceCounts.has(profile.id) ||
            profile.verified_market_badge ||
            String(profile.market_access_tier || '').toLowerCase() === 'verified' ||
            (devBoostEnabled && profile.id === '853d7644-0ef0-4560-ac80-585c541121ed')
        )
        .filter((profile: any) => !normalizedRole || String(profile.role || 'client').toLowerCase() === normalizedRole)
        .map((profile: any) => {
          const priceCount = priceCounts.get(profile.id) ?? 0;
          const stats = actionStats.get(profile.id) ?? { confirmed: 0, corrected: 0 };
          const verifiedBonus = profile.verified_market_badge || String(profile.market_access_tier || '').toLowerCase() === 'verified' ? 1000 : 0;
          const realScore = priceCount * 2 + stats.confirmed + stats.corrected * 3 + verifiedBonus;
          const demoScore = devBoostEnabled && profile.id === '853d7644-0ef0-4560-ac80-585c541121ed' ? 9999 : 0;
          const score = demoScore > 0 ? Math.max(realScore, demoScore) : realScore;

          return {
            userId: profile.id,
            fullName: profile.full_name || 'Contributeur',
            role: profile.role || 'client',
            priceCount,
            confirmedCount: stats.confirmed,
            correctedCount: stats.corrected,
            trustScore: profile.trust_score ?? 35,
            accessTier: String(profile.market_access_tier || 'reliable'),
            verifiedMarketBadge: Boolean(profile.verified_market_badge),
            score,
          };
        })
        .sort((a, b) => b.score - a.score || b.trustScore - a.trustScore)
        .slice(0, 100)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
    },
  });
}

export function useUserBadges(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user-badges', userId],
    enabled: !!userId && (options?.enabled ?? true),
    queryFn: async () => {
      assertSupabaseConfigured();

      const [
        { data: storedBadges, error: storedBadgesError },
        { data: allBadges, error: allBadgesError },
        { count: priceCount, error: priceError },
        { data: actions, error: actionsError },
      ] = await Promise.all([
        supabase
          .from('user_badges')
          .select(`
            *,
            badges(*)
          `)
          .eq('user_id', userId),
        supabase
          .from('badges')
          .select('*'),
        supabase
          .from('prices')
          .select('*', { count: 'exact', head: true })
          .eq('recorded_by', userId),
        supabase
          .from('price_alert_actions')
          .select('action_type')
          .eq('user_id', userId),
      ]);

      if (storedBadgesError) throw storedBadgesError;
      if (allBadgesError) throw allBadgesError;
      if (priceError) throw priceError;
      if (actionsError) throw actionsError;

      const confirmedCount = (actions ?? []).filter((action) => action.action_type === 'confirmed').length;
      const correctedCount = (actions ?? []).filter((action) => action.action_type === 'updated_price').length;

      const earnedBadgeNames = new Set<string>((storedBadges ?? []).map((entry: any) => entry.badges?.name).filter(Boolean));

      if ((priceCount || 0) >= 1) earnedBadgeNames.add('Pionnier');
      if ((priceCount || 0) >= 10) earnedBadgeNames.add('Analyste');
      if (confirmedCount >= 3 || correctedCount >= 2) earnedBadgeNames.add('Sentinelle');

      const syntheticBadges = (allBadges ?? [])
        .filter((badge: any) => earnedBadgeNames.has(badge.name))
        .map((badge: any) => ({
          id: `virtual-${badge.id}`,
          user_id: userId,
          badge_id: badge.id,
          awarded_at: new Date().toISOString(),
          badges: badge,
        }));

      const storedByBadgeId = new Set((storedBadges ?? []).map((entry: any) => entry.badge_id));
      const merged = [
        ...(storedBadges ?? []),
        ...syntheticBadges.filter((entry: any) => !storedByBadgeId.has(entry.badge_id)),
      ];

      return merged;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: ProfileRow) => {
      assertSupabaseConfigured();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id || session.user.id !== profile.id) {
        throw new Error('Session profil invalide. Connectez-vous avant de modifier votre profil.');
      }

      const currentMetadata = session.user.user_metadata ?? {};
      const metadataUpdate: Record<string, string> = {};
      if (typeof profile.full_name === 'string' && profile.full_name !== currentMetadata.full_name) {
        metadataUpdate.full_name = profile.full_name;
      }
      if (typeof profile.phone === 'string' && profile.phone !== currentMetadata.phone) {
        metadataUpdate.phone = profile.phone;
      }
      if (typeof profile.role === 'string' && profile.role !== currentMetadata.role) {
        metadataUpdate.role = profile.role;
      }

      if (Object.keys(metadataUpdate).length > 0) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: metadataUpdate,
        });

        if (authUpdateError) {
          throw authUpdateError;
        }
      }

      let writableProfile: Record<string, any> = { ...profile };
      let lastError: any = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await supabase
          .from('profiles')
          .upsert(writableProfile)
          .select()
          .single();

        if (!error) {
          return data;
        }

        lastError = error;
        const message = String(error.message || '');
        const missingColumn = message.match(/'([^']+)' column of 'profiles'/)?.[1];
        const knownOptionalColumns = new Set([
          'preferred_market_id',
          'last_location_latitude',
          'last_location_longitude',
          'last_location_verified_at',
        ]);

        if (missingColumn && knownOptionalColumns.has(missingColumn) && missingColumn in writableProfile) {
          const { [missingColumn]: _removed, ...nextProfile } = writableProfile;
          writableProfile = nextProfile;
          console.warn(`[profiles] retrying update without missing column ${missingColumn}`);
          continue;
        }

        throw error;
      }

      throw lastError;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['profile', variables.id], data);
      queryClient.invalidateQueries({ queryKey: ['profile', variables.id] });
    },
  });
}
