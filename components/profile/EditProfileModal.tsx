import React from 'react';
import { Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/Theme';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  onChangeName: (text: string) => void;
  bio: string;
  onChangeBio: (text: string) => void;
  role: string;
  onChangeRole: (role: string) => void;
  cityId: string | null;
  onChangeCityId: (cityId: string | null) => void;
  cities: any[];
  isDetectingZone: boolean;
  zoneDetectionState: string;
  zoneDetectionDebug: string | null;
  onDetectCity: () => void;
  onSave: () => void;
}

export function EditProfileModal({
  visible,
  onClose,
  name,
  onChangeName,
  bio,
  onChangeBio,
  role,
  onChangeRole,
  cityId,
  onChangeCityId,
  cities,
  isDetectingZone,
  zoneDetectionState,
  zoneDetectionDebug,
  onDetectCity,
  onSave,
}: EditProfileModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Typography variant="h2" style={{ marginBottom: 20 }}>
            Modifier le profil
          </Typography>

          <Typography variant="label" style={{ marginBottom: 8 }}>
            Nom complet
          </Typography>
          <TextInput value={name} onChangeText={onChangeName} style={styles.input} placeholder="Votre nom" />

          <Typography variant="label" style={{ marginBottom: 8, marginTop: 16 }}>
            Bio
          </Typography>
          <TextInput
            value={bio}
            onChangeText={onChangeBio}
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline
            placeholder="Parlez-nous de vous..."
          />

          <Typography variant="label" style={{ marginBottom: 8, marginTop: 16 }}>
            Role
          </Typography>
          <View style={styles.roleRow}>
            {['client', 'seller', 'collector'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.choiceChip, role === r && styles.choiceChipActive]}
                onPress={() => onChangeRole(r)}
              >
                <Typography variant="caption" color={role === r ? Colors.white : Colors.text}>
                  {r}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Typography variant="label" style={{ marginBottom: 8, marginTop: 16 }}>
            Ville prioritaire
          </Typography>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.detectCityButton}
            onPress={onDetectCity}
            disabled={isDetectingZone}
          >
            <MapPin size={16} color={Colors.white} />
            <View style={{ flex: 1 }}>
              <Typography variant="caption" color={Colors.white} style={{ fontWeight: '900' }}>
                {isDetectingZone ? 'Détection en cours...' : 'Détecter ma ville par GPS'}
              </Typography>
              <Typography variant="caption" color={Colors.white + 'CC'}>
                La ville détectée sera rattachée au profil.
              </Typography>
            </View>
          </TouchableOpacity>

          {zoneDetectionState === 'permission_denied' ? (
            <Typography variant="caption" color={Colors.error} style={styles.gpsHint}>
              Autorisez la localisation pour rattacher votre ville.
            </Typography>
          ) : null}
          {zoneDetectionState === 'not_found' ? (
            <Typography variant="caption" color={Colors.textSecondary} style={styles.gpsHint}>
              Ville introuvable automatiquement. Essayez depuis votre marché.
            </Typography>
          ) : null}
          {zoneDetectionDebug ? (
            <Typography variant="caption" color={Colors.textSecondary} style={styles.zoneDebugText}>
              {zoneDetectionDebug}
            </Typography>
          ) : null}
          <View style={styles.cityList}>
            <TouchableOpacity
              style={[styles.choiceChip, !cityId && styles.choiceChipActive]}
              onPress={() => onChangeCityId(null)}
            >
              <Typography variant="caption" color={!cityId ? Colors.white : Colors.text}>
                Toutes
              </Typography>
            </TouchableOpacity>
            {(cities ?? []).slice(0, 8).map((c: any) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.choiceChip, cityId === c.id && styles.choiceChipActive]}
                onPress={() => onChangeCityId(c.id)}
              >
                <Typography variant="caption" color={cityId === c.id ? Colors.white : Colors.text}>
                  {c.name}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <Button title="Annuler" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <View style={{ width: 12 }} />
            <Button title="Enregistrer" onPress={onSave} style={{ flex: 1 }} />
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
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  cityList: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detectCityButton: {
    minHeight: 58,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadows.soft,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  choiceChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  gpsHint: {
    marginTop: 10,
    fontWeight: '800',
  },
  zoneDebugText: {
    marginTop: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontFamily: 'monospace',
  },
});
