import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MarketplaceSatelliteMap } from '@/components/MarketplaceSatelliteMap';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/Theme';
import { useMarketplaceSellerLocations, useSearchableProducts } from '@/libs/queries';
import type { SearchableProductRow } from '@/libs/queries/types';

type MarketplaceFilter = 'all' | 'online' | 'verified';

type SellerGroup = {
  id: string;
  name: string;
  trustScore: number;
  verified: boolean;
  tier: string;
  products: SearchableProductRow[];
};

function getSellerLabel(item: SearchableProductRow) {
  return item.seller_full_name || 'Boutique locale';
}

function isVerifiedSeller(item: SearchableProductRow) {
  return Boolean(
    item.seller_verified_market_badge ||
      String(item.seller_market_access_tier || '').toLowerCase() === 'verified'
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { data: searchableProducts, isLoading, error } = useSearchableProducts();
  const { data: sellerLocations } = useMarketplaceSellerLocations();
  const [filter, setFilter] = useState<MarketplaceFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const sellers = useMemo<SellerGroup[]>(() => {
    const groups = new Map<string, SellerGroup>();
    const normalizedSearch = search.trim().toLowerCase();

    (searchableProducts ?? [])
      .filter((item) => item.source === 'boutique' && item.owner_id)
      .filter((item) => filter !== 'verified' || isVerifiedSeller(item))
      .filter((item) => {
        if (!normalizedSearch) return true;
        return [item.name, item.category, getSellerLabel(item)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .forEach((item) => {
        const sellerId = item.owner_id as string;
        const existing = groups.get(sellerId);
        if (existing) {
          existing.products.push(item);
          return;
        }

        groups.set(sellerId, {
          id: sellerId,
          name: getSellerLabel(item),
          trustScore: Number(item.seller_trust_score ?? 0),
          verified: isVerifiedSeller(item),
          tier: String(item.seller_market_access_tier || 'reliable'),
          products: [item],
        });
      });

    return Array.from(groups.values()).sort((left, right) => {
      if (left.verified !== right.verified) return left.verified ? -1 : 1;
      return right.trustScore - left.trustScore;
    });
  }, [filter, search, searchableProducts]);

  const visibleSellers = selectedSellerId
    ? sellers.filter((seller) => seller.id === selectedSellerId)
    : sellers;

  const openOrder = (seller: SellerGroup, product: SearchableProductRow) => {
    const productId = product.resolved_product_id || product.id;
    router.push({
      pathname: '/chat',
      params: {
        sellerId: seller.id,
        sellerName: seller.name,
        productId,
        productName: product.name,
        productCategory: product.category,
        productUnit: product.unit,
        source: 'marketplace',
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Typography variant="label" color={Colors.primary}>MARKETPLACE</Typography>
          <Typography variant="h1" style={styles.title}>Boutiques</Typography>
          <Typography variant="body" color={Colors.textSecondary} style={styles.subtitle}>
            Découvre les vendeurs éligibles et commande directement auprès d’eux.
          </Typography>
        </View>
        <View style={styles.headerIcon}>
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
        </View>
      </View>

      <View style={styles.searchBox}>
        <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Produit, catégorie ou boutique"
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
            <Typography variant="caption" color={Colors.textSecondary}>×</Typography>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {([
          ['all', 'Toutes les boutiques'],
          ['online', 'En ligne'],
          ['verified', 'Vérifiées'],
        ] as Array<[MarketplaceFilter, string]>).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.filterChip, filter === value && styles.filterChipActive]}
            activeOpacity={0.82}
          >
            <Typography variant="caption" color={filter === value ? Colors.white : Colors.textSecondary} style={styles.filterText}>
              {label}
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.viewToggle}>
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
          activeOpacity={0.82}
        >
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
          <Typography variant="caption" color={viewMode === 'list' ? Colors.white : Colors.textSecondary} style={styles.viewToggleText}>
            Catalogue
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('map')}
          style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
          activeOpacity={0.82}
        >
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
          <Typography variant="caption" color={viewMode === 'map' ? Colors.white : Colors.textSecondary} style={styles.viewToggleText}>
            Carte satellite
          </Typography>
        </TouchableOpacity>
      </View>

      {viewMode === 'map' ? (
        <Card style={styles.mapCard} variant="outline">
          <View style={styles.mapHeader}>
            <View>
              <Typography variant="h2">Boutiques physiques</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                {sellerLocations?.length ?? 0} vendeur{sellerLocations?.length === 1 ? '' : 's'} géolocalisé{sellerLocations?.length === 1 ? '' : 's'}
              </Typography>
            </View>
            <View style={styles.satelliteBadge}>
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
              <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>SATELLITE</Typography>
            </View>
          </View>
          <MarketplaceSatelliteMap
            sellers={sellerLocations ?? []}
            onSelectSeller={setSelectedSellerId}
          />
        </Card>
      ) : null}

      {viewMode === 'list' ? <View style={styles.sectionHeader}>
        <View>
          <Typography variant="h2">Boutiques disponibles</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>
            {sellers.length} boutique{sellers.length === 1 ? '' : 's'} éligible{sellers.length === 1 ? '' : 's'}
          </Typography>
        </View>
        {selectedSellerId ? (
          <TouchableOpacity onPress={() => setSelectedSellerId(null)}>
            <Typography variant="caption" color={Colors.primary} style={styles.resetText}>Voir tout</Typography>
          </TouchableOpacity>
        ) : null}
      </View> : null}

      {viewMode === 'list' && isLoading ? (
        <Card style={styles.emptyCard} variant="outline">
          <Typography variant="body">Chargement des boutiques...</Typography>
        </Card>
      ) : viewMode === 'list' && error ? (
        <Card style={styles.emptyCard} variant="outline">
          <Typography variant="body">Les boutiques sont momentanément indisponibles.</Typography>
          <Typography variant="caption" color={Colors.textSecondary} style={styles.emptyText}>
            Réessaie dans quelques instants.
          </Typography>
        </Card>
      ) : viewMode === 'list' && visibleSellers.length === 0 ? (
        <Card style={styles.emptyCard} variant="outline">
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
          <Typography variant="h2" style={styles.emptyTitle}>Aucune boutique visible</Typography>
          <Typography variant="caption" color={Colors.textSecondary} style={styles.emptyText}>
            Les boutiques apparaissent ici après validation de leur profil et de leurs produits.
          </Typography>
          <Button title="Ouvrir ma boutique" onPress={() => router.push('/(tabs)/profile')} style={styles.emptyButton} />
        </Card>
      ) : viewMode === 'list' ? (
        visibleSellers.map((seller) => (
          <Card key={seller.id} style={styles.sellerCard} variant="outline">
            <TouchableOpacity
              style={styles.sellerHeader}
              onPress={() => setSelectedSellerId(selectedSellerId === seller.id ? null : seller.id)}
              activeOpacity={0.82}
            >
              <View style={styles.sellerAvatar}>
                <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
              </View>
              <View style={styles.sellerDetails}>
                <View style={styles.sellerNameRow}>
                  <Typography variant="h2" style={styles.sellerName} numberOfLines={1}>{seller.name}</Typography>
                  {seller.verified ? <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} /> : null}
                </View>
                <Typography variant="caption" color={Colors.textSecondary}>
                  {seller.verified ? 'Vendeur vérifié' : 'Vendeur éligible'} · Fiabilité {seller.trustScore}/100
                </Typography>
              </View>
              <Typography variant="h2" color={Colors.textSecondary}>›</Typography>
            </TouchableOpacity>

            <View style={styles.availabilityRow}>
              <View style={styles.onlineDot} />
              <Typography variant="caption" color={Colors.textSecondary}>Disponible en ligne</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>·</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>{seller.products.length} article{seller.products.length === 1 ? '' : 's'}</Typography>
            </View>

            <View style={styles.productsList}>
              {seller.products.slice(0, 4).map((product) => (
                <View key={product.id} style={styles.productRow}>
                  {product.image_url ? (
                    <Image source={{ uri: product.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productPlaceholder]}>
                      <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.primary }} />
                    </View>
                  )}
                  <View style={styles.productDetails}>
                    <Typography variant="body" style={styles.productName} numberOfLines={1}>{product.name}</Typography>
                    <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                      {product.category} · {product.unit}
                    </Typography>
                  </View>
                  <View style={styles.productAction}>
                    <Typography variant="price" style={styles.productPrice}>
                      {product.price_value != null ? `${Math.round(product.price_value).toLocaleString('fr-FR')} F` : 'Sur devis'}
                    </Typography>
                    <TouchableOpacity onPress={() => openOrder(seller, product)} style={styles.orderButton} activeOpacity={0.82}>
                      <Typography variant="caption" color={Colors.white} style={styles.orderButtonText}>Commander</Typography>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ))
      ) : null}

      <View style={styles.footerNote}>
        <Typography variant="caption" color={Colors.textSecondary} style={styles.footerText}>
          Les commandes sont confirmées avec le vendeur par messagerie. Le paiement et la livraison sont convenus directement.
        </Typography>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Layout.tabScreenBottomPadding },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
  headerCopy: { flex: 1, paddingRight: Spacing.md },
  title: { marginTop: Spacing.sm, fontSize: 34 },
  subtitle: { marginTop: Spacing.sm, lineHeight: 22 },
  headerIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary + '14', borderWidth: 1, borderColor: Colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, ...Shadows.soft },
  searchInput: { flex: 1, marginLeft: Spacing.sm, color: Colors.text, fontSize: 15, paddingVertical: Spacing.sm },
  clearButton: { padding: Spacing.sm },
  filters: { gap: Spacing.sm, paddingVertical: Spacing.md },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: Spacing.sm, marginBottom: Spacing.md },
  resetText: { fontWeight: '700' },
  sellerCard: { marginBottom: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.card },
  viewToggle: { flexDirection: 'row', padding: 4, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  viewToggleButton: { flex: 1, minHeight: 42, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  viewToggleButtonActive: { backgroundColor: Colors.primary, ...Shadows.soft },
  viewToggleText: { fontWeight: '800' },
  mapCard: { padding: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.sm, paddingBottom: Spacing.md },
  satelliteBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.primaryMuted },
  sellerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sellerAvatar: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary + '14', borderWidth: 1, borderColor: Colors.border },
  sellerDetails: { flex: 1, minWidth: 0 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontSize: 18, flexShrink: 1 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.emerald },
  productsList: { marginTop: Spacing.sm },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  productImage: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.background },
  productPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  productDetails: { flex: 1, minWidth: 0 },
  productName: { fontWeight: '700', fontSize: 15 },
  productAction: { alignItems: 'flex-end', gap: 6 },
  productPrice: { fontSize: 14, color: Colors.text },
  orderButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm, backgroundColor: Colors.primary },
  orderButtonText: { fontWeight: '800', fontSize: 11 },
  emptyCard: { alignItems: 'center', padding: Spacing.xl, borderRadius: Radius.lg },
  emptyTitle: { marginTop: Spacing.md, textAlign: 'center' },
  emptyText: { textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  emptyButton: { marginTop: Spacing.md },
  footerNote: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md },
  footerText: { textAlign: 'center', lineHeight: 18 },
});
