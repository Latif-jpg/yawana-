import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/Typography';
import { Colors, Radius, Spacing } from '@/constants/Theme';
import type { MarketplaceSellerLocation } from './MarketplaceSatelliteMap';

type Props = {
  sellers: MarketplaceSellerLocation[];
  onSelectSeller: (sellerId: string) => void;
};

export function MarketplaceSatelliteMap({ sellers }: Props) {
  return (
    <View style={styles.container}>
      <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: Colors.primary }} />
      <Typography variant="body" style={styles.title}>Carte OpenStreetMap disponible sur mobile</Typography>
      <Typography variant="caption" color={Colors.textSecondary} style={styles.text}>
        La carte satellite utilise Google Maps sur Android et iOS. {sellers.length} boutique(s) sont géolocalisée(s).
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.cardSecondary, borderRadius: Radius.md },
  title: { marginTop: Spacing.md, fontWeight: '700', textAlign: 'center' },
  text: { marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20 },
});
