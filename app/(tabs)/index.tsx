import { useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Filter, Info, MapPin, Search, Sparkles, TrendingDown, TrendingUp, X, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PriceTicker } from '@/components/PriceTicker';
import { Skeleton } from '@/components/Skeleton';
import { Typography } from '@/components/Typography';
import { WatchlistItem } from '@/components/WatchlistItem';
import { useAuth } from '@/libs/auth';
import {
  useExternalSourceHealth,
  useIntelligenceSnapshots,
  useDashboardSummary,
  useRefreshAllSnapshots,
  useCities,
  useMarketsWithCoords,
  useProfile,
  useSearchableProducts,
} from '@/libs/queries';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/Theme';
import { formatTimeAgo } from '@/libs/format';
import { normalizeProductName } from '@/libs/normalization';

const CATEGORY_ICONS: Record<string, string> = {
  Cereales: '🌾',
  Fruits: '🍎',
  Epicerie: '🫘',
  Viandes: '🥩',
  Legumes: '🥬',
};

function getReliabilityBadge(item: any) {
  const status = String(item.reliability_status || '').toLowerCase();
  const score = Number(item.reliability_score ?? 0);

  if (status === 'trusted') {
    return {
      label: 'Fiable',
      color: Colors.emerald,
      bg: Colors.emerald + '12',
      note: item.validation_note || 'Référence soutenue par plusieurs relevés cohérents.',
      scoreLabel: `${Math.round(score * 100)}% confiance`,
    };
  }

  if (status === 'confirmed') {
    return {
      label: 'Confirmé',
      color: Colors.emerald,
      bg: Colors.emerald + '12',
      note: item.validation_note || 'Prix cohérent avec l’historique local.',
      scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
    };
  }

  if (status === 'conflicted') {
    return {
      label: 'À vérifier',
      color: Colors.error,
      bg: Colors.error + '12',
      note: item.validation_note || 'Des relevés voisins restent contradictoires.',
      scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
    };
  }

  return {
    label: 'Brut',
    color: Colors.gold,
    bg: Colors.gold + '18',
    note: item.validation_note || 'Prix reçu, encore en attente de recoupements.',
    scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
  };
}

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  const rounded = value.toFixed(1);
  return `${value > 0 ? '+' : ''}${rounded}%`;
}

function formatSignedCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded} F`;
}

function getSellerPalette(input: any) {
  const trustScore = Number(input?.trust_score ?? input?.seller_trust_score ?? 0);
  const verified = Boolean(input?.is_verified ?? input?.seller_verified_market_badge);
  const accessTier = String(input?.market_access_tier || input?.seller_market_access_tier || '').toLowerCase();

  if (verified || accessTier === 'verified') {
    return 'palette2' as const;
  }

  if (trustScore >= 60 || (accessTier === 'reliable' && trustScore >= 60)) {
    return 'palette1' as const;
  }

  return null;
}

function getBoutiqueOffer(item: any) {
  if (!item || item.source !== 'boutique' || !item.owner_id || item.is_visible_in_search === false) {
    return null;
  }

  const palette = getSellerPalette(item);
  if (!palette) {
    return null;
  }

  const productId = item.resolved_product_id || item.resolvedProductId || item.id;
  if (!productId) {
    return null;
  }

  return {
    productId,
    sellerId: item.owner_id,
    sellerName: item.seller_full_name || 'Vendeur confirmé',
    palette,
    price: typeof item.price_value === 'number' ? item.price_value : null,
    item,
  };
}

function getChatTargetFromPrice(item: any) {
  const sellerId = item?.shops?.owner_id || item?.seller_id || item?.recorded_by || null;
  const palette = getSellerPalette(item?.shops ?? item);
  if (!sellerId || !palette) {
    return null;
  }

  return {
    sellerId,
    sellerName: item?.shops?.name || item?.seller_full_name || 'Vendeur confirmé',
    palette,
  };
}

export default function FeedScreen() {
  const { user, session } = useAuth();
  const router = useRouter();
  const { data: profile } = useProfile(user?.id || '');
  const { data: cities } = useCities();
  const { data: markets } = useMarketsWithCoords();
  const { data: dashboardSummary, isLoading, error, refetch } = useDashboardSummary();
  const { data: searchableProducts } = useSearchableProducts();
  const { data: snapshots } = useIntelligenceSnapshots();
  const { data: externalSourceHealth } = useExternalSourceHealth();
  const refreshAllSnapshots = useRefreshAllSnapshots();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const [selectedTickerItem, setSelectedTickerItem] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const currentCity = useMemo(
    () => (cities ?? []).find((city: any) => city.id === profile?.city_id) ?? null,
    [cities, profile?.city_id]
  );
  const currentMarket = useMemo(() => {
    if (!profile?.preferred_market_id) {
      return null;
    }

    return (markets ?? []).find((market: any) => market.id === profile.preferred_market_id) ?? null;
  }, [markets, profile?.preferred_market_id]);
  const trustScore = useMemo(() => {
    if (profile?.trust_score != null) {
      return Number(profile.trust_score);
    }

    return 35;
  }, [profile?.trust_score]);

  const searchableCatalog = useMemo(() => {
    return searchableProducts ?? [];
  }, [searchableProducts]);

  const sellerOfferByProductId = useMemo(() => {
    const offers = new Map<string, NonNullable<ReturnType<typeof getBoutiqueOffer>>>();

    searchableCatalog.forEach((item: any) => {
      const offer = getBoutiqueOffer(item);
      if (!offer) {
        return;
      }

      const existing = offers.get(offer.productId);
      if (!existing) {
        offers.set(offer.productId, offer);
        return;
      }

      const offerRank = offer.palette === 'palette2' ? 2 : 1;
      const existingRank = existing.palette === 'palette2' ? 2 : 1;
      const offerPrice = offer.price ?? Number.POSITIVE_INFINITY;
      const existingPrice = existing.price ?? Number.POSITIVE_INFINITY;

      if (offerRank > existingRank || (offerRank === existingRank && offerPrice < existingPrice)) {
        offers.set(offer.productId, offer);
      }
    });

    return offers;
  }, [searchableCatalog]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refreshAllSnapshots.mutateAsync()]);
    setIsRefreshing(false);
  };

  const dashboardItems = useMemo(() => {
    if (!dashboardSummary) return [];

    return dashboardSummary.map((item) => {
      const boutiqueOffer = sellerOfferByProductId.get(item.product_id);
      
      const priceChatTarget = item.seller_id ? {
        sellerId: item.seller_id,
        sellerName: item.shop_name || 'Vendeur confirmé',
        palette: getSellerPalette({ trust_score: item.shop_trust_score, is_verified: item.shop_verified }),
      } : null;

      const chatTarget = boutiqueOffer
        ? {
            sellerId: boutiqueOffer.sellerId,
            sellerName: boutiqueOffer.sellerName,
            palette: boutiqueOffer.palette,
          }
        : priceChatTarget;
      
      const sellerPalette = chatTarget?.palette ?? null;
      const shopName = chatTarget?.sellerName || '';
      const actionLabel =
        sellerPalette === 'palette2'
          ? `Acheter chez ${shopName || 'ce vendeur'}`
          : sellerPalette === 'palette1'
          ? `Disponible chez ${shopName || 'ce vendeur'}`
          : undefined;

      const currentPrice = Number(item.latest_price);

      return {
        id: `${item.product_id}:${item.market_id}`,
        productId: item.product_id,
        name: item.product_name || 'Produit',
        marketName: item.market_name || 'Marché',
        category: item.product_category,
        shopName: item.shop_name || null,
        shopVerified: Boolean(item.shop_verified),
        chatTarget,
        price: currentPrice,
        changePercent: item.change_percent ? Number(item.change_percent) : null,
        trend: item.trend?.length > 1 ? item.trend.map(Number) : [currentPrice * 0.98, currentPrice],
        actionLabel,
        actionHint: actionLabel
          ? sellerPalette === 'palette2'
            ? 'Palette 2 · achat direct'
            : 'Palette 1 · disponibilité confirmée'
          : undefined,
      };
    });
  }, [dashboardSummary, sellerOfferByProductId]);

  const filteredItems = useMemo(() => {
    return dashboardItems.filter((item) => {
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.marketName.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [dashboardItems, searchQuery, selectedCategory]);

  const openChatForPrice = (item: any) => {
    const target = item?.chatTarget;
    if (!target?.sellerId || !item?.id) {
      return;
    }

    router.push({
      pathname: '/chat',
      params: {
        sellerId: target.sellerId,
        sellerName: target.sellerName,
        productId: item.productId,
        productName: item.name,
        productCategory: item.category || '',
        productUnit: '',
        source: 'boutique',
      },
    });
  };

  const catalogResults = useMemo(() => {
    const normalizedTerm = normalizeProductName(searchQuery);

    return searchableCatalog.filter((item: any) => {
      const haystack = [
        item.name,
        item.category,
        item.unit,
        item.price_value != null ? String(item.price_value) : '',
      ]
        .map((value) => normalizeProductName(String(value || '')))
        .join(' ');

      const matchesSearch = !normalizedTerm || haystack.includes(normalizedTerm);
      const matchesCategory = !selectedCategory || selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, searchableCatalog, selectedCategory]);

  const sellerResults = useMemo(() => {
    return catalogResults.filter((item: any) => getBoutiqueOffer(item) !== null);
  }, [catalogResults]);

  const tickerItems = useMemo(() => {
    return dashboardItems.map((item) => {
      const change: 'up' | 'down' | 'stable' =
        item.changePercent === null
          ? 'stable'
          : item.changePercent > 0.5
          ? 'up'
          : item.changePercent < -0.5
          ? 'down'
          : 'stable';

      return {
        ...item,
        change,
      };
    }).slice(0, 12);
  }, [dashboardItems]);

  const insightModel = useMemo(() => {
    const snapshotList = (snapshots ?? []) as any[];
    const totalSignals = snapshotList.length;
    const uniqueProducts = new Set(snapshotList.map((snapshot) => snapshot.product_id).filter(Boolean));
    const uniqueMarkets = new Set(snapshotList.map((snapshot) => snapshot.market_id).filter(Boolean));
    const confidenceValues = snapshotList
      .map((snapshot) => Number(snapshot.confidence_score ?? 0))
      .filter((value) => Number.isFinite(value));
    const gapValues = snapshotList
      .map((snapshot) => Number(snapshot.external_gap_percent ?? 0))
      .filter((value) => Number.isFinite(value));

    const averageConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0;
    const averageExternalGap = gapValues.length
      ? gapValues.reduce((sum, value) => sum + value, 0) / gapValues.length
      : 0;

    const scoredSnapshots = snapshotList.map((snapshot) => {
      const trend7d = Number(snapshot.trend_7d ?? 0);
      const trend30d = Number(snapshot.trend_30d ?? 0);
      const externalGap = Number(snapshot.external_gap_percent ?? 0);
      const confidence = Number(snapshot.confidence_score ?? 0);
      const volatilityScore =
        snapshot.status === 'volatile' || snapshot.status === 'anomaly'
          ? 1
          : Math.abs(externalGap) >= 15
          ? 0.8
          : Math.abs(externalGap) >= 8
          ? 0.5
          : 0;

      return {
        snapshot,
        trendScore: trend7d * 0.7 + trend30d * 0.3,
        trend7d,
        trend30d,
        externalGap,
        confidence,
        volatilityScore,
      };
    });

    const rising = [...scoredSnapshots]
      .filter((item) => item.trendScore > 0 || item.trend7d > 0)
      .sort((a, b) => b.trendScore - a.trendScore)[0] ?? null;

    const falling = [...scoredSnapshots]
      .filter((item) => item.trendScore < 0 || item.trend7d < 0)
      .sort((a, b) => a.trendScore - b.trendScore)[0] ?? null;

    const opportunity = [...scoredSnapshots]
      .filter((item) => Math.abs(item.externalGap) >= 8 && item.confidence >= 0.5)
      .sort((a, b) => Math.abs(b.externalGap) - Math.abs(a.externalGap))[0] ?? null;

    const caution = [...scoredSnapshots]
      .filter((item) => item.confidence < 0.45 || item.volatilityScore > 0)
      .sort((a, b) => b.volatilityScore - a.volatilityScore || a.confidence - b.confidence)[0] ?? null;

    const stable = [...scoredSnapshots]
      .filter((item) => Math.abs(item.externalGap) <= 5 && item.confidence >= 0.65)
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

    const signalCards = [
      rising
        ? {
            tone: 'success' as const,
            title: 'Tendance haussière',
            product: rising.snapshot.products?.name || 'Produit',
            market: rising.snapshot.markets?.name || 'Marché',
            detail: `Signal sur ${formatSignedPercent(rising.trend7d)} en 7 jours et ${formatSignedPercent(rising.trend30d)} en 30 jours.`,
          }
        : null,
      falling
        ? {
            tone: 'error' as const,
            title: 'Tendance baissière',
            product: falling.snapshot.products?.name || 'Produit',
            market: falling.snapshot.markets?.name || 'Marché',
            detail: `Baisse détectée avec ${formatSignedPercent(falling.trend7d)} sur 7 jours et ${formatSignedPercent(falling.trend30d)} sur 30 jours.`,
          }
        : null,
      opportunity
        ? {
            tone: 'warning' as const,
            title: 'Signal opportunité',
            product: opportunity.snapshot.products?.name || 'Produit',
            market: opportunity.snapshot.markets?.name || 'Marché',
            detail: `Écart web ${formatSignedPercent(opportunity.externalGap)} avec une confiance de ${Math.round(opportunity.confidence * 100)}%.`,
          }
        : null,
      caution
        ? {
            tone: 'info' as const,
            title: 'Signal prudence',
            product: caution.snapshot.products?.name || 'Produit',
            market: caution.snapshot.markets?.name || 'Marché',
            detail: caution.snapshot.status === 'volatile' || caution.snapshot.status === 'anomaly'
              ? 'Le marché bouge vite ou présente des anomalies.'
              : `Confiance faible (${Math.round(caution.confidence * 100)}%).`,
          }
        : null,
      stable
        ? {
            tone: 'success' as const,
            title: 'Zone stable',
            product: stable.snapshot.products?.name || 'Produit',
            market: stable.snapshot.markets?.name || 'Marché',
            detail: `Prix aligné au web avec un écart de ${formatSignedPercent(stable.externalGap)} et une bonne confiance.`,
          }
        : null,
    ].filter(Boolean);

    return {
      totalSignals,
      uniqueProducts: uniqueProducts.size,
      uniqueMarkets: uniqueMarkets.size,
      averageConfidence,
      averageExternalGap,
      signalCards,
      featuredSignal: signalCards[0] ?? null,
    };
  }, [snapshots]);

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Typography variant="h2" color={Colors.error}>Chargement impossible</Typography>
        <Button title="Réessayer" onPress={() => refetch()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PriceTicker items={tickerItems} onPressItem={setSelectedTickerItem} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Typography variant="label" color={Colors.textSecondary} style={styles.dateLabel}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
          <View style={styles.headerTitleRow}>
            <Typography variant="h1">Yawana</Typography>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setShowInsight(true)}>
              <Sparkles size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <Card style={styles.contextCard} variant="outline">
          <View style={styles.contextTopRow}>
            <View style={{ flex: 1 }}>
              <Typography variant="label" color={Colors.primary}>
                Ton contexte
              </Typography>
              <Typography variant="body" style={{ fontWeight: '800', marginTop: 4 }}>
                {currentCity?.name || 'Ville non définie'}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                {currentMarket?.name ? `Marché de référence : ${currentMarket.name}` : 'Marché de référence à confirmer'}
              </Typography>
            </View>
            <View style={styles.contextScorePill}>
              <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                {trustScore}/100
              </Typography>
            </View>
          </View>

          <View style={styles.contextActions}>
            <TouchableOpacity style={styles.contextAction} onPress={() => router.push('/(tabs)/add-price')}>
              <Typography variant="caption" style={styles.contextActionText}>
                Ajouter un prix
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextAction} onPress={() => router.push('/(tabs)/map')}>
              <Typography variant="caption" style={styles.contextActionText}>
                Ouvrir la carte
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextAction} onPress={() => router.push('/(tabs)/profile')}>
              <Typography variant="caption" style={styles.contextActionText}>
                Voir le profil
              </Typography>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Search color={Colors.textSecondary} size={18} />
            <TextInput
              placeholder="Rechercher"
              style={styles.searchInput}
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity style={[styles.chip, !selectedCategory && styles.chipActive]} onPress={() => setSelectedCategory(null)}>
            <Typography variant="caption" color={!selectedCategory ? Colors.white : Colors.textSecondary}>Tout</Typography>
          </TouchableOpacity>
          {Object.keys(CATEGORY_ICONS).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Typography variant="caption" style={{ marginRight: 4 }}>{CATEGORY_ICONS[cat]}</Typography>
              <Typography variant="caption" color={selectedCategory === cat ? Colors.white : Colors.textSecondary}>{cat}</Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {searchQuery ? (
          <View style={styles.catalogSection}>
            <View style={styles.sectionHeader}>
              <Typography variant="h2">Vendeurs trouvés</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                {sellerResults.length} vendeur{sellerResults.length > 1 ? 's' : ''}
              </Typography>
            </View>

                {sellerResults.length ? (
              <View style={styles.catalogGrid}>
                {sellerResults.slice(0, 8).map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.catalogCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      const sellerName = item.seller_full_name || 'Vendeur confirmé';

                      router.push({
                        pathname: '/chat',
                        params: {
                          productId: item.resolved_product_id || item.resolvedProductId || item.id,
                          productName: item.name,
                          productCategory: item.category || '',
                          productUnit: item.unit || '',
                          sellerId: item.owner_id || '',
                          sellerName: sellerName,
                          source: item.source,
                        },
                      });
                    }}
                  >
                    <View style={styles.catalogCardTopRow}>
                      <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }} numberOfLines={1}>
                        Vendeur confirmé
                      </Typography>
                      <View style={styles.catalogPricePill}>
                        <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                          Chat
                        </Typography>
                      </View>
                    </View>
                    {(() => {
                      const offer = getBoutiqueOffer(item);
                      const sellerName = offer?.sellerName || item.seller_full_name || 'ce vendeur';
                      const label =
                        offer?.palette === 'palette2'
                          ? `Acheter chez ${sellerName}`
                          : `Disponible chez ${sellerName}`;

                      return (
                        <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800', marginTop: 8 }} numberOfLines={1}>
                          {label}
                        </Typography>
                      );
                    })()}
                    <Typography variant="h2" style={styles.catalogTitle} numberOfLines={2}>
                      {item.seller_full_name || 'Vendeur confirmé'}
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                      {item.name} · {item.category} · {item.unit}
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary} style={styles.catalogHint} numberOfLines={1}>
                      Ouvrir le lien vendeur
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Card variant="outline" style={styles.catalogEmptyCard}>
                <Typography variant="body" color={Colors.textSecondary}>
                  Aucun vendeur confirmé n’a déclaré ce produit.
                </Typography>
              </Card>
            )}
          </View>
        ) : null}

        <View style={styles.watchlist}>
          {isLoading ? (
            [1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.skeletonItem}>
                <Skeleton height={60} width="100%" borderRadius={Radius.sm} />
              </View>
            ))
          ) : (
            filteredItems.map((item) => (
              <WatchlistItem
                key={item.id}
                name={item.name}
                marketName={item.marketName}
                price={item.price}
                changePercent={item.changePercent}
                trend={item.trend}
                actionLabel={item.actionLabel}
                actionHint={item.actionHint}
                actionOnPress={item.actionLabel ? () => openChatForPrice(item) : undefined}
                onPress={() => setSelectedTickerItem(item)}
              />
            ))
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Typography variant="h2">Radar IA</Typography>
        </View>

        {snapshots?.slice(0, 3).map((snapshot, idx) => (
          <TouchableOpacity key={idx} style={styles.insightCard} onPress={() => setShowInsight(true)}>
            <Typography variant="label" color={Colors.primary} style={{ marginBottom: 4 }}>Signal IA</Typography>
            <Typography variant="h2" style={{ fontSize: 18, marginBottom: 4 }}>{snapshot.products?.name}</Typography>
            <Typography variant="body" color={Colors.textSecondary} numberOfLines={2}>
              Écart de {snapshot.external_gap_percent?.toFixed(1)}% constaté par rapport aux prix web. 
              Marché : {snapshot.markets?.name}.
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showInsight} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalHeader}>
                <Typography variant="h2">Intelligence Yawana</Typography>
                <TouchableOpacity onPress={() => setShowInsight(false)}><X size={24} color={Colors.textSecondary} /></TouchableOpacity>
              </View>

              <Card variant="elevated" style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroIconWrap}>
                    <Sparkles size={22} color={Colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label" color={Colors.primary}>Intelligence active</Typography>
                    <Typography variant="h2" style={{ marginTop: 4 }}>
                      Lecture instantanée des tendances
                    </Typography>
                  </View>
                </View>
                <Typography variant="body" color={Colors.textSecondary} style={{ marginTop: 12 }}>
                  Le moteur observe les snapshots disponibles, détecte les tendances, repère les écarts et remonte les signaux utiles.
                </Typography>
                <View style={styles.heroBadgesRow}>
                  <View style={styles.heroBadge}>
                    <Typography variant="caption" color={Colors.white} style={styles.heroBadgeValue}>
                      {insightModel.totalSignals}
                    </Typography>
                    <Typography variant="caption" color={Colors.white}>
                      signaux
                    </Typography>
                  </View>
                  <View style={[styles.heroBadge, styles.heroBadgeSoft]}>
                    <Typography variant="caption" color={Colors.text} style={styles.heroBadgeValueSoft}>
                      {Math.round(insightModel.averageConfidence * 100)}%
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      confiance
                    </Typography>
                  </View>
                </View>
              </Card>

              <View style={styles.insightSummaryGrid}>
                <Card variant="outline" style={styles.insightSummaryCard}>
                  <Typography variant="label" color={Colors.textSecondary}>Signaux</Typography>
                  <Typography variant="h2" style={styles.insightValue}>{insightModel.totalSignals}</Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>Snapshots analysés</Typography>
                </Card>
                <Card variant="outline" style={styles.insightSummaryCard}>
                  <Typography variant="label" color={Colors.textSecondary}>Marchés</Typography>
                  <Typography variant="h2" style={styles.insightValue}>{insightModel.uniqueMarkets}</Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>Couverture active</Typography>
                </Card>
                <Card variant="outline" style={styles.insightSummaryCard}>
                  <Typography variant="label" color={Colors.textSecondary}>Produits</Typography>
                  <Typography variant="h2" style={styles.insightValue}>{insightModel.uniqueProducts}</Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>Références suivies</Typography>
                </Card>
                <Card variant="outline" style={styles.insightSummaryCard}>
                  <Typography variant="label" color={Colors.textSecondary}>Confiance</Typography>
                  <Typography variant="h2" style={styles.insightValue}>{Math.round(insightModel.averageConfidence * 100)}%</Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>Moyenne des snapshots</Typography>
                </Card>
              </View>

              {insightModel.featuredSignal ? (
                <Card variant="elevated" style={styles.featuredCard}>
                  <View style={styles.featuredHeader}>
                    <View>
                      <Typography variant="label" color={Colors.primary}>Signal principal</Typography>
                      <Typography variant="h2" style={{ marginTop: 4 }}>
                        {insightModel.featuredSignal.product}
                      </Typography>
                    </View>
                    <View style={styles.featuredPill}>
                      <Zap size={14} color={Colors.white} />
                      <Typography variant="caption" color={Colors.white} style={{ marginLeft: 6 }}>
                        En direct
                      </Typography>
                    </View>
                  </View>
                  <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 6 }}>
                    {insightModel.featuredSignal.market}
                  </Typography>
                  <View style={styles.featuredDetailBox}>
                    <Typography variant="body" color={Colors.text}>
                      {insightModel.featuredSignal.detail}
                    </Typography>
                  </View>
                </Card>
              ) : null}

              <View style={styles.sectionHeader}>
                <Typography variant="h2">Signaux forts</Typography>
              </View>

              <View style={{ gap: 12 }}>
                {insightModel.signalCards.length ? (
                  insightModel.signalCards.map((signal: any, index) => (
                    <Card key={`${signal.title}-${index}`} variant="outline" style={styles.signalCard}>
                      <View style={styles.signalCardTopRow}>
                        <Typography
                          variant="label"
                          color={
                            signal.tone === 'success'
                              ? Colors.emerald
                              : signal.tone === 'error'
                              ? Colors.error
                              : signal.tone === 'warning'
                              ? Colors.gold
                              : Colors.primary
                          }
                        >
                          {signal.title}
                        </Typography>
                        <View
                          style={[
                            styles.signalPill,
                            signal.tone === 'success'
                              ? styles.signalPillSuccess
                              : signal.tone === 'error'
                              ? styles.signalPillError
                              : signal.tone === 'warning'
                              ? styles.signalPillWarning
                              : styles.signalPillInfo,
                          ]}
                        >
                          <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                            {signal.tone === 'success'
                              ? 'Tendance'
                              : signal.tone === 'error'
                              ? 'Pression'
                              : signal.tone === 'warning'
                              ? 'Opportunité'
                              : 'Vigilance'}
                          </Typography>
                        </View>
                      </View>
                      <Typography variant="h2" style={{ fontSize: 18, marginBottom: 4 }}>
                        {signal.product}
                      </Typography>
                      <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 6 }}>
                        {signal.market}
                      </Typography>
                      <View style={styles.signalMetaRow}>
                        <View style={styles.signalMetaChip}>
                          <Typography variant="caption" color={Colors.textSecondary}>
                            Tendances 7j / 30j
                          </Typography>
                        </View>
                        <View style={styles.signalMetaChip}>
                          <Typography variant="caption" color={Colors.textSecondary}>
                            Écart web
                          </Typography>
                        </View>
                      </View>
                      <Typography variant="body" color={Colors.textSecondary}>
                        {signal.detail}
                      </Typography>
                    </Card>
                  ))
                ) : (
                  <Card variant="outline" style={styles.signalCard}>
                    <Typography variant="body" color={Colors.textSecondary}>
                      Pas encore assez de données pour générer des signaux robustes.
                    </Typography>
                  </Card>
                )}
              </View>

              <View style={styles.sectionHeader}>
                <Typography variant="h2">Lecture rapide</Typography>
              </View>

              <Card variant="outline" style={styles.signalCard}>
                <View style={styles.quickLine}>
                  <Zap size={16} color={Colors.primary} />
                  <Typography variant="body" style={styles.quickText}>
                    Les signaux haussiers et baissiers s’appuient sur `trend_7d` et `trend_30d`.
                  </Typography>
                </View>
                <View style={styles.quickLine}>
                  <TrendingUp size={16} color={Colors.emerald} />
                  <Typography variant="body" style={styles.quickText}>
                    Les opportunités remontent quand l’écart web est fort et que la confiance reste correcte.
                  </Typography>
                </View>
                <View style={styles.quickLine}>
                  <TrendingDown size={16} color={Colors.error} />
                  <Typography variant="body" style={styles.quickText}>
                    Les zones prudence apparaissent si le marché est volatile ou trop peu fiable.
                  </Typography>
                </View>
                <View style={styles.quickLine}>
                  <MapPin size={16} color={Colors.gold} />
                  <Typography variant="body" style={styles.quickText}>
                    L’écart moyen web observé est de {formatSignedPercent(insightModel.averageExternalGap)}.
                  </Typography>
                </View>
              </Card>

              <Button title="Fermer" onPress={() => setShowInsight(false)} style={{ marginTop: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedTickerItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h2">Détails du Signal</Typography>
              <TouchableOpacity onPress={() => setSelectedTickerItem(null)}><X size={24} color={Colors.textSecondary} /></TouchableOpacity>
            </View>
            {selectedTickerItem && (
              <View style={{ gap: 12 }}>
                <Typography variant="h1" color={Colors.primary}>{selectedTickerItem.name}</Typography>
                <Typography variant="body" color={Colors.textSecondary}>{selectedTickerItem.marketName}</Typography>
                {selectedTickerItem.actionLabel || selectedTickerItem.actionHint ? (
                  <View style={styles.modalActionPill}>
                    {selectedTickerItem.actionLabel ? (
                      <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                        {selectedTickerItem.actionLabel}
                      </Typography>
                    ) : null}
                    {selectedTickerItem.actionHint ? (
                      <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                        {selectedTickerItem.actionHint}
                      </Typography>
                    ) : null}
                  </View>
                ) : null}
                {selectedTickerItem.shopVerified ? (
                  <View style={styles.premiumFeatureRow}>
                    <View style={styles.premiumFeaturePill}>
                      <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                        Messagerie client-vendeur
                      </Typography>
                    </View>
                    <View style={styles.premiumFeaturePill}>
                      <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                        Proposition de livraison
                      </Typography>
                    </View>
                    <View style={styles.premiumFeaturePill}>
                      <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                        Vitrine boutique
                      </Typography>
                    </View>
                  </View>
                ) : (
                  <Typography variant="caption" color={Colors.textSecondary}>
                    La palette fiable affiche le produit, la boutique vérifiée ouvre les services premium.
                  </Typography>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Typography variant="h2">{selectedTickerItem.price.toLocaleString()} F</Typography>
                  <Typography variant="h2" color={selectedTickerItem.changePercent && selectedTickerItem.changePercent > 0 ? Colors.error : Colors.emerald}>
                    {selectedTickerItem.changePercent?.toFixed(1)}%
                  </Typography>
                </View>
              </View>
            )}
            <Button title="Fermer" onPress={() => setSelectedTickerItem(null)} style={{ marginTop: 24 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: Layout.tabScreenBottomPadding },
  header: { paddingHorizontal: Spacing.md, paddingTop: 60, marginBottom: Spacing.md },
  dateLabel: { textTransform: 'uppercase', marginBottom: 4, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center' },
  contextCard: {
    marginHorizontal: Spacing.md,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.white,
    ...Shadows.soft,
  },
  contextTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  contextScorePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '18',
  },
  contextActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contextActionText: {
    fontWeight: '800',
    color: Colors.text,
  },
  searchBarContainer: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, height: 36, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 17, color: Colors.text, backgroundColor: 'transparent' },
  chipsScroll: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, paddingHorizontal: 12, height: 32, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  watchlist: { marginTop: Spacing.sm },
  catalogSection: {
    marginBottom: Spacing.lg,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: Spacing.md,
  },
  catalogCard: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    minHeight: 130,
  },
  catalogCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  catalogPricePill: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catalogTitle: {
    fontSize: 15,
    marginBottom: 6,
  },
  catalogHint: {
    marginTop: 10,
    fontWeight: '700',
  },
  catalogEmptyCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  skeletonItem: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  sectionHeader: { paddingHorizontal: Spacing.md, marginTop: 40, marginBottom: 16 },
  insightCard: { marginHorizontal: Spacing.md, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalActionPill: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  premiumFeatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  premiumFeaturePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  heroCard: {
    padding: 18,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.premium,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  heroBadge: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  heroBadgeSoft: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroBadgeValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
  },
  heroBadgeValueSoft: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  insightSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  insightSummaryCard: {
    width: '48%',
    padding: 16,
    borderRadius: 20,
  },
  insightValue: {
    marginTop: 6,
    marginBottom: 2,
  },
  featuredCard: {
    padding: 18,
    marginTop: 8,
    borderRadius: 24,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  featuredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  featuredDetailBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signalCard: {
    padding: 16,
    borderRadius: 22,
  },
  signalCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  signalPillSuccess: {
    backgroundColor: Colors.emerald,
  },
  signalPillError: {
    backgroundColor: Colors.error,
  },
  signalPillWarning: {
    backgroundColor: Colors.gold,
  },
  signalPillInfo: {
    backgroundColor: Colors.primary,
  },
  signalMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  signalMetaChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  quickText: {
    flex: 1,
  },
});

