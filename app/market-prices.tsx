import { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Clock3, Filter, MapPin, ShoppingBag } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Spacing } from '@/constants/Theme';
import { formatPrice, formatTimeAgo } from '@/libs/format';
import { normalizePricePerBaseUnit } from '@/libs/normalization';
import { useAuth } from '@/libs/auth';
import { useToast } from '@/components/ToastProvider';
import { useMarketsWithCoords, usePrices, useRecordProductConsultation } from '@/libs/queries';

type MarketPriceRecord = {
  id: string;
  product_id: string;
  market_id: string;
  price_value: number;
  quantity: number;
  created_at: string;
  reliability_status?: string | null;
  products?: { name?: string; category?: string; unit?: string } | null;
};

function formatMarketTypeLabel(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) return 'Autre';
  if (normalized === 'physical') return 'Physique';
  if (normalized === 'virtual') return 'Virtuel';
  if (normalized === 'wholesale') return 'Gros';
  if (normalized === 'retail') return 'Détail';

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function MarketPricesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();
  const recordConsultation = useRecordProductConsultation();
  const params = useLocalSearchParams<{ marketId?: string; marketName?: string }>();
  const marketId = typeof params.marketId === 'string' ? params.marketId : '';
  const fallbackMarketName = typeof params.marketName === 'string' ? params.marketName : 'Marché';

  const { data: markets } = useMarketsWithCoords();
  const { data: prices } = usePrices();

  const selectedMarket = useMemo(
    () => ((markets ?? []) as any[]).find((market) => market.id === marketId) ?? null,
    [marketId, markets]
  );

  const cityNameById = useMemo(
    () =>
      new Map(
        ((markets ?? []) as any[])
          .filter((market) => !!market.city_id)
          .map((market) => [market.city_id, market.city?.name || market.city_name || 'Ville inconnue'])
      ),
    [markets]
  );

  const marketPrices = useMemo(() => {
    if (!marketId) return [];

    return ((prices ?? []) as MarketPriceRecord[])
      .filter((price) => price.market_id === marketId)
      .map((price) => {
        const unit = price.products?.unit || 'unit';
        const normalizedPrice = normalizePricePerBaseUnit(price.price_value, unit, price.quantity).normalizedPrice;

        return {
          id: price.id,
          productId: price.product_id,
          productName: price.products?.name || 'Produit',
          category: price.products?.category || 'Catégorie',
          unit,
          quantity: price.quantity,
          priceValue: normalizedPrice,
          priceLabel: formatPrice(normalizedPrice),
          ageLabel: formatTimeAgo(price.created_at),
        };
      })
      .sort((left, right) => {
        if (left.priceValue !== right.priceValue) return left.priceValue - right.priceValue;
        return left.productName.localeCompare(right.productName, 'fr', { sensitivity: 'base' });
      });
  }, [marketId, prices]);

  const summary = useMemo(() => {
    const uniqueProducts = new Set(marketPrices.map((item) => item.productName)).size;
    const cheapest = marketPrices[0] ?? null;
    const mostExpensive = marketPrices[marketPrices.length - 1] ?? null;

    return [
      {
        label: 'Prix listés',
        value: marketPrices.length,
        hint: 'Triés du moins cher au plus cher',
      },
      {
        label: 'Produits',
        value: uniqueProducts,
        hint: 'Différentes références suivies',
      },
      {
        label: 'Plus bas',
        value: cheapest ? cheapest.priceLabel : '—',
        hint: cheapest ? cheapest.productName : 'Aucune donnée',
      },
      {
        label: 'Plus haut',
        value: mostExpensive ? mostExpensive.priceLabel : '—',
        hint: mostExpensive ? mostExpensive.productName : 'Aucune donnée',
      },
    ];
  }, [marketPrices]);

  const marketName = selectedMarket?.name || fallbackMarketName;
  const cityName = selectedMarket ? cityNameById.get(selectedMarket.city_id || '') || 'Ville inconnue' : '';

  const handleConsultProduct = (productId: string, productName: string) => {
    if (!marketId) return;

    if (!session?.user?.id) {
      showToast({
        title: 'Connexion requise',
        message: 'Connecte-toi pour enregistrer les consultations.',
        tone: 'info',
      });
      return;
    }

    recordConsultation.mutate(
      { marketId, productId },
      {
        onSuccess: () => {
          showToast({
            title: 'Consultation enregistrée',
            message: `${productName} a été ajouté au suivi des consultations.`,
            tone: 'success',
          });
        },
      }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={18} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Typography variant="label" style={styles.pageTitle}>
            Prix du marché
          </Typography>
          <Typography variant="caption" color={Colors.textSecondary}>
            Liste complète triée du moins cher au plus cher
          </Typography>
        </View>
      </View>

      <Card style={styles.marketCard} variant="outline">
        <View style={styles.marketTitleRow}>
          <View style={styles.marketIcon}>
            <MapPin size={16} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Typography variant="label" numberOfLines={1}>
              {marketName}
            </Typography>
            <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
              {cityName || 'Ville inconnue'} · {selectedMarket ? formatMarketTypeLabel(selectedMarket.market_type) : 'Marché'}
            </Typography>
          </View>
        </View>
      </Card>

      <View style={styles.summaryGrid}>
        {summary.map((item) => (
          <Card key={item.label} style={styles.summaryCard} variant="outline">
            <Typography variant="caption" color={Colors.textSecondary} style={styles.summaryLabel}>
              {item.label}
            </Typography>
            <Typography variant="label" style={styles.summaryValue}>
              {item.value}
            </Typography>
            <Typography variant="caption" color={Colors.textSecondary}>
              {item.hint}
            </Typography>
          </Card>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <ShoppingBag size={16} color={Colors.primary} />
        <Typography variant="label" style={{ marginLeft: 8 }}>
          Tous les prix
        </Typography>
      </View>

      <View style={styles.list}>
        {marketPrices.length > 0 ? (
          marketPrices.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.88}
              onPress={() => handleConsultProduct(item.productId, item.productName)}
            >
              <Card style={styles.priceCard} variant="outline">
              <View style={styles.priceTopRow}>
                <View style={styles.rankBadge}>
                  <Typography variant="caption" style={styles.rankText}>
                    #{index + 1}
                  </Typography>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="label" numberOfLines={1}>
                    {item.productName}
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {item.category} · {item.quantity} {item.unit}
                  </Typography>
                </View>
                <View style={styles.priceBadge}>
                  <Typography variant="label" style={styles.priceValue}>
                    {item.priceLabel}
                  </Typography>
                </View>
              </View>

              <View style={styles.priceMetaRow}>
                <View style={styles.metaPill}>
                  <Clock3 size={12} color={Colors.textSecondary} />
                  <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 6 }}>
                    {item.ageLabel}
                  </Typography>
                </View>
                <View style={styles.metaPill}>
                  <Filter size={12} color={Colors.textSecondary} />
                  <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 6 }}>
                    Base normalisée
                  </Typography>
                </View>
              </View>
              <Typography variant="caption" color={Colors.textSecondary} style={styles.tapHint}>
                Appuie pour compter cette consultation
              </Typography>
            </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.emptyState} variant="outline">
            <Typography variant="label">Aucun prix trouvé</Typography>
            <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
              Ce marché n’a pas encore de relevés exploitables.
            </Typography>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    paddingBottom: Layout.screenBottomPadding,
    gap: 12,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    fontWeight: '800',
  },
  marketCard: {
    padding: 14,
  },
  marketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marketIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    padding: 14,
  },
  summaryLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginVertical: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  list: {
    gap: 10,
  },
  priceCard: {
    padding: 14,
    gap: 10,
  },
  priceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '18',
  },
  rankText: {
    fontWeight: '800',
    color: Colors.primary,
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceValue: {
    fontWeight: '800',
    color: Colors.primary,
  },
  priceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tapHint: {
    marginTop: 2,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
  },
  emptyState: {
    padding: 16,
  },
});
