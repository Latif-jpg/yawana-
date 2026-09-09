import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Typography } from './Typography';
import { Colors, Radius, Spacing, Shadows } from '@/constants/Theme';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';

export interface TickerItemProps {
  id: string;
  name: string;
  marketName: string;
  price: number;
  previousPrice?: number | null;
  change: 'up' | 'down' | 'stable';
  changePercent?: number | null;
  status?: string;
}

const ITEM_WIDTH = Platform.OS === 'android' ? 190 : 220;

const TickerItem = ({
  item,
  onPress,
}: {
  item: TickerItemProps;
  onPress?: (item: TickerItemProps) => void;
}) => {
  const color = item.change === 'up' ? Colors.error : item.change === 'down' ? Colors.emerald : Colors.textSecondary;
  const Icon = item.change === 'up' ? TrendingUp : item.change === 'down' ? TrendingDown : Minus;

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={() => onPress?.(item)}>
      <View style={styles.itemRow}>
        <View style={styles.itemTextBlock}>
          <Typography variant="caption" style={styles.itemTitle} numberOfLines={1}>
            {item.name}
          </Typography>
          <Typography variant="caption" color={Colors.textSecondary} style={styles.marketName} numberOfLines={1}>
            {item.marketName}
          </Typography>
        </View>
        <View style={styles.priceBadge}>
          <Typography variant="caption" color={color} style={styles.priceText} numberOfLines={1}>
            {item.price.toLocaleString()} F
          </Typography>
          <Icon size={12} color={color} style={{ marginLeft: 4 }} />
          {typeof item.changePercent === 'number' ? (
            <Typography variant="caption" color={color} style={styles.changeText} numberOfLines={1}>
              {item.changePercent > 0 ? '+' : ''}
              {item.changePercent.toFixed(1)}%
            </Typography>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const PriceTicker = ({
  items,
  onPressItem,
}: {
  items: TickerItemProps[];
  onPressItem?: (item: TickerItemProps) => void;
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const visibleItems = useMemo(() => items.slice(0, Platform.OS === 'android' ? 2 : 3), [items]);
  const displayItems = useMemo(() => [...visibleItems, ...visibleItems], [visibleItems]);
  const loopWidth = visibleItems.length * ITEM_WIDTH;
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!visibleItems.length || isPaused) {
      return;
    }

    cancelAnimation(translateX);
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(-loopWidth, {
        duration: Math.max(1, (loopWidth / 18) * 1000),
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => cancelAnimation(translateX);
  }, [isPaused, loopWidth, translateX, visibleItems.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!items.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.label}>
        <Typography variant="caption" color={Colors.white} style={styles.labelText}>
          DIRECT
        </Typography>
      </View>
      <View style={styles.viewport}>
        <Animated.View style={[styles.tickerWrapper, animatedStyle]}>
          {displayItems.map((item, index) => (
            <TickerItem key={`${item.id}-${index}`} item={item} onPress={onPressItem} />
          ))}
        </Animated.View>
      </View>
      <TouchableOpacity style={styles.pauseButton} onPress={() => setIsPaused((value) => !value)}>
        <Typography variant="caption" color={Colors.primary} style={styles.pauseText}>
          {isPaused ? 'LIVE' : 'STOP'}
        </Typography>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: Platform.OS === 'android' ? 72 : 56,
    marginTop: Platform.OS === 'android' ? 64 : Spacing.sm,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    minWidth: 62,
    alignSelf: 'stretch',
    justifyContent: 'center',
    zIndex: 10,
    ...Shadows.soft,
  },
  labelText: {
    fontWeight: '800',
    fontSize: 10,
    lineHeight: 12,
  },
  tickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  item: {
    width: ITEM_WIDTH,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'android' ? 8 : 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 4,
  },
  itemTextBlock: {
    minWidth: 0,
    gap: 1,
  },
  itemTitle: {
    fontWeight: '800',
    lineHeight: Platform.OS === 'android' ? 16 : 17,
    includeFontPadding: false,
  },
  marketName: {
    fontSize: Platform.OS === 'android' ? 9 : 10,
    lineHeight: Platform.OS === 'android' ? 11 : 12,
    includeFontPadding: false,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  priceText: {
    fontWeight: '800',
    lineHeight: 16,
    includeFontPadding: false,
  },
  changeText: {
    marginLeft: 6,
    fontWeight: '700',
    includeFontPadding: false,
  },
  pauseButton: {
    paddingHorizontal: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    backgroundColor: Colors.background,
  },
  pauseText: {
    fontWeight: '800',
    lineHeight: 12,
    includeFontPadding: false,
  },
});
