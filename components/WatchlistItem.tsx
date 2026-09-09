import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Typography } from './Typography';
import { Sparkline } from './Sparkline';
import { Colors, Spacing, Radius } from '@/constants/Theme';

interface WatchlistItemProps {
  name: string;
  marketName: string;
  price: number;
  changePercent: number | null;
  trend: number[];
  actionLabel?: string;
  actionHint?: string;
  actionOnPress?: () => void;
  onPress?: () => void;
}

export const WatchlistItem = ({
  name,
  marketName,
  price,
  changePercent,
  trend,
  actionLabel,
  actionHint,
  actionOnPress,
  onPress,
}: WatchlistItemProps) => {
  const isPositive = (changePercent ?? 0) >= 0;
  const color = isPositive ? Colors.emerald : Colors.error;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Typography variant="h2" style={styles.name} numberOfLines={1}>
          {name}
        </Typography>
        <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
          {marketName}
        </Typography>
        {actionLabel ? (
          <TouchableOpacity
            style={styles.actionPill}
            activeOpacity={0.8}
            onPress={actionOnPress}
            disabled={!actionOnPress}
          >
            <Typography variant="caption" color={Colors.primary} style={styles.actionLabel} numberOfLines={1}>
              {actionLabel}
            </Typography>
            {actionHint ? (
              <Typography variant="caption" color={Colors.textSecondary} style={styles.actionHint} numberOfLines={1}>
                {actionHint}
              </Typography>
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.center}>
        <Sparkline data={trend} color={color} width={70} height={24} />
      </View>

      <View style={styles.right}>
        <Typography variant="price" style={styles.price}>
          {price.toLocaleString()}
        </Typography>
        <View style={[styles.pill, { backgroundColor: color }]}>
          <Typography variant="label" color={Colors.white} style={styles.pillText}>
            {changePercent !== null ? `${isPositive ? '+' : ''}${changePercent.toFixed(1)}%` : '--'}
          </Typography>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  left: {
    flex: 2,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  center: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flex: 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  price: {
    fontSize: 18,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    minWidth: 65,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  actionPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    fontWeight: '800',
  },
  actionHint: {
    marginTop: 2,
  },
});
