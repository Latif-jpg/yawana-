import React from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Spacing } from '@/constants/Theme';

interface PriceCorrectionModalProps {
  visible: boolean;
  alert: any | null;
  correctedPrice: string;
  onChangePrice: (text: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function PriceCorrectionModal({
  visible,
  alert,
  correctedPrice,
  onChangePrice,
  onCancel,
  onSubmit,
  isPending,
}: PriceCorrectionModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Typography variant="h2" style={{ marginBottom: 20 }}>
            Corriger le prix
          </Typography>

          <Typography variant="body" color={Colors.textSecondary}>
            {alert?.products?.name || 'Produit'} · {alert?.markets?.name || 'Marché'}
          </Typography>

          <Typography variant="label" style={{ marginBottom: 8, marginTop: 20 }}>
            Nouveau prix
          </Typography>
          <TextInput
            value={correctedPrice}
            onChangeText={onChangePrice}
            style={styles.input}
            keyboardType="numeric"
            placeholder="Entrez le prix corrigé"
          />

          <View style={styles.modalButtons}>
            <Button
              title="Annuler"
              variant="secondary"
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <View style={{ width: 12 }} />
            <Button
              title={isPending ? 'Enregistrement...' : 'Corriger'}
              onPress={onSubmit}
              style={{ flex: 1 }}
              loading={isPending}
              disabled={!correctedPrice || isPending}
            />
          </View>
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
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 30,
  },
});
