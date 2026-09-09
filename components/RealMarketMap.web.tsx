import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/Theme';
import { Typography } from '@/components/Typography';
import { MarketAtlas } from '@/components/MarketAtlas';

type MarketPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

interface RealMarketMapProps {
  markets: MarketPoint[];
  onSelectMarket: (market: MarketPoint) => void;
  selectedMarketId?: string;
  userLocation?: { latitude: number; longitude: number } | null;
}

export const RealMarketMap = ({
  markets,
  onSelectMarket,
  selectedMarketId,
  userLocation,
}: RealMarketMapProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerPill}>
          <View style={styles.headerDot} />
          <Typography variant="caption" color={Colors.textSecondary} style={{ fontWeight: '700' }}>
            Atlas visuel
          </Typography>
        </View>
        <Typography variant="caption" color={Colors.textSecondary}>
          {markets.length} marchés, avec repères régionaux et noms visibles
        </Typography>
      </View>

      <View style={styles.atlasWrap}>
        <MarketAtlas
          markets={markets}
          onSelectMarket={onSelectMarket}
          selectedMarketId={selectedMarketId}
          userLocation={userLocation}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Typography variant="caption" color={Colors.textSecondary}>
            Marché
          </Typography>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.emerald }]} />
          <Typography variant="caption" color={Colors.textSecondary}>
            Votre position
          </Typography>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#F7F9FC',
    ...Shadows.soft,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 8,
    gap: 8,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  headerDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  atlasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
});
