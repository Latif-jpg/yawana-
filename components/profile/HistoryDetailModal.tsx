import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Spacing } from '@/constants/Theme';
import { formatPrice, formatTimeAgo } from '@/libs/format';

interface HistoryDetailModalProps {
  entry: any | null;
  onClose: () => void;
}

export function HistoryDetailModal({ entry, onClose }: HistoryDetailModalProps) {
  return (
    <Modal visible={!!entry} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Typography variant="h2">Detail du releve</Typography>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {entry ? (
            <View style={{ gap: 16 }}>
              <Card variant="outline">
                <Typography variant="body" style={{ fontWeight: '800' }}>
                  {entry.products?.name || 'Produit'}
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 6 }}>
                  {entry.markets?.name || 'Marché'}
                </Typography>
                <View style={styles.historyDetailGrid}>
                  <View>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Prix
                    </Typography>
                    <Typography variant="body" color={Colors.primary} style={{ fontWeight: '800', marginTop: 4 }}>
                      {formatPrice(Math.round(Number(entry.price_value || 0)))} F
                    </Typography>
                  </View>
                  <View>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Quantite
                    </Typography>
                    <Typography variant="body" style={{ fontWeight: '800', marginTop: 4 }}>
                      {entry.quantity} {entry.products?.unit || 'u'}
                    </Typography>
                  </View>
                </View>
                <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 12 }}>
                  Saisi {formatTimeAgo(entry.created_at)}
                </Typography>
              </Card>

              <Card variant="outline">
                <Typography variant="caption" color={Colors.textSecondary}>
                  Cet historique est désormais en lecture simple. Les confirmations et corrections se font dans
                  « À confirmer près de vous ».
                </Typography>
              </Card>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Layout.screenBottomPadding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  historyDetailGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 16,
  },
});
