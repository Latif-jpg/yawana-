import { StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Typography } from '@/components/Typography';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import type { MarketplaceSellerLocation } from './MarketplaceSatelliteMap';

type Props = {
  sellers: MarketplaceSellerLocation[];
  onSelectSeller: (sellerId: string) => void;
};

export function MarketplaceSatelliteMap({ sellers, onSelectSeller }: Props) {
  const firstSeller = sellers[0];

  if (!firstSeller) {
    return (
      <View style={styles.empty}>
        <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.white }} />
        <Typography variant="body" style={styles.title}>Aucune boutique géolocalisée</Typography>
        <Typography variant="caption" color={Colors.textSecondary} style={styles.text}>
          Les boutiques apparaîtront ici après validation de leur position.
        </Typography>
      </View>
    );
  }

  return (
    <MapView
      style={styles.map}
      mapType="satellite"
      provider={PROVIDER_GOOGLE}
      initialRegion={{ latitude: firstSeller.latitude, longitude: firstSeller.longitude, latitudeDelta: 0.18, longitudeDelta: 0.18 }}
      showsUserLocation
      showsCompass
      showsScale
    >
      {sellers.map((seller) => (
        <Marker
          key={seller.id}
          coordinate={{ latitude: seller.latitude, longitude: seller.longitude }}
          onPress={() => onSelectSeller(seller.id)}
        >
          <View style={[styles.marker, seller.verified && styles.verifiedMarker]}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.white }} />
          </View>
          <Callout>
            <View style={styles.callout}>
              <Typography variant="body" style={{ fontWeight: '800' }}>{seller.name}</Typography>
              <Typography variant="caption">Fiabilité {seller.trustScore}/100</Typography>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 460, borderRadius: Radius.md, overflow: 'hidden' },
  marker: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderWidth: 2, borderColor: Colors.white },
  verifiedMarker: { backgroundColor: Colors.primary, borderColor: Colors.primaryMuted },
  callout: { minWidth: 150, padding: 8 },
  empty: { minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.cardSecondary, borderRadius: Radius.md },
  title: { marginTop: Spacing.md, fontWeight: '700', textAlign: 'center' },
  text: { marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20 },
});
