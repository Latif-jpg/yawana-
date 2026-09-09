import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BellRing, MapPin, Shield, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/Theme';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  showAccountSignOut: boolean;
  isSigningOut: boolean;
  onSignOut: () => void;
}

export function SettingsModal({
  visible,
  onClose,
  showAccountSignOut,
  isSigningOut,
  onSignOut,
}: SettingsModalProps) {
  const router = useRouter();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.settingsModalContent]}>
          <View style={styles.modalHeader}>
            <Typography variant="h2">Paramètres du compte</Typography>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsModalBody}>
            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 18 }}>
              Cet espace sert de base pour les réglages principaux du profil. On pourra y brancher les vraies options
              ensuite sans changer la structure.
            </Typography>

            {showAccountSignOut ? (
              <TouchableOpacity
                activeOpacity={0.82}
                style={styles.settingsLogoutButton}
                onPress={onSignOut}
                disabled={isSigningOut}
              >
                <Shield color={Colors.white} size={18} />
                <View style={{ flex: 1 }}>
                  <Typography variant="body" color={Colors.white} style={{ fontWeight: '800' }}>
                    {isSigningOut ? 'Déconnexion...' : 'Déconnexion'}
                  </Typography>
                  <Typography variant="caption" color={Colors.white + 'CC'}>
                    Fermer la session sur cet appareil.
                  </Typography>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.82}
                style={[styles.settingsLogoutButton, styles.settingsLoginButton]}
                onPress={() => {
                  onClose();
                  router.push('/(auth)/login');
                }}
              >
                <Shield color={Colors.white} size={18} />
                <View style={{ flex: 1 }}>
                  <Typography variant="body" color={Colors.white} style={{ fontWeight: '800' }}>
                    Se connecter
                  </Typography>
                  <Typography variant="caption" color={Colors.white + 'CC'}>
                    Ouvrir une session pour gérer ton compte.
                  </Typography>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.settingsList}>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemHeader}>
                  <BellRing size={18} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Typography variant="body" style={{ fontWeight: '700' }}>
                      Notifications
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Alertes prix, rappels d’action et messages utiles.
                    </Typography>
                  </View>
                </View>
                <Typography variant="caption" color={Colors.primary} style={styles.settingsHint}>
                  À définir
                </Typography>
              </View>

              <View style={styles.settingsItem}>
                <View style={styles.settingsItemHeader}>
                  <Shield size={18} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Typography variant="body" style={{ fontWeight: '700' }}>
                      Confidentialité
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Visibilité du profil, historique et données partagées.
                    </Typography>
                  </View>
                </View>
                <Typography variant="caption" color={Colors.primary} style={styles.settingsHint}>
                  À définir
                </Typography>
              </View>

              <View style={styles.settingsItem}>
                <View style={styles.settingsItemHeader}>
                  <MapPin size={18} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Typography variant="body" style={{ fontWeight: '700' }}>
                      Zone et localisation
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Ville prioritaire, détection auto et rayon de suivi.
                    </Typography>
                  </View>
                </View>
                <Typography variant="caption" color={Colors.primary} style={styles.settingsHint}>
                  À définir
                </Typography>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Button title="Fermer" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </ScrollView>
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
  settingsModalContent: {
    maxHeight: '88%',
  },
  settingsModalBody: {
    paddingBottom: Layout.screenBottomPadding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsLogoutButton: {
    minHeight: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.soft,
  },
  settingsLoginButton: {
    backgroundColor: Colors.primary,
  },
  settingsList: {
    gap: 12,
  },
  settingsItem: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  settingsItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsHint: {
    alignSelf: 'flex-start',
    fontWeight: '800',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 30,
  },
});
