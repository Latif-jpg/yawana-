import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, ShoppingBag, Sparkles } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Typography } from '@/components/Typography';
import { Colors, Layout, Radius, Spacing } from '@/constants/Theme';
import { useAuth } from '@/libs/auth';
import { formatTimeAgo } from '@/libs/format';
import { useChatInbox } from '@/libs/queries';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: conversations, isLoading } = useChatInbox(user?.id || null);

  const handleBack = () => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/profile');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={18} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="label" color={Colors.textSecondary}>
            Espace messages
          </Typography>
          <Typography variant="h1" numberOfLines={1}>
            Messagerie
          </Typography>
        </View>
      </View>

      <Card variant="elevated" style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <MessageCircle size={22} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h2">Conversations client-vendeur</Typography>
            <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
              Retrouve ici les echanges lies aux produits disponibles chez les vendeurs.
            </Typography>
          </View>
        </View>
      </Card>

      <View style={styles.list}>
        {isLoading ? (
          <Card variant="outline" style={styles.emptyCard}>
            <Typography variant="body" color={Colors.textSecondary}>
              Chargement des conversations...
            </Typography>
          </Card>
        ) : conversations?.length ? (
          conversations.map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              activeOpacity={0.86}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: {
                    conversationId: conversation.id,
                  },
                })
              }
            >
              <Card variant="outline" style={styles.conversationCard}>
                <View style={styles.productIcon}>
                  <ShoppingBag size={17} color={Colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body" style={{ fontWeight: '900' }} numberOfLines={1}>
                    {conversation.products?.name || 'Conversation'}
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {conversation.last_message_preview || 'Aucun message pour le moment.'}
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                    {formatTimeAgo(conversation.last_message_at || conversation.created_at)}
                  </Typography>
                </View>
                <View style={styles.openPill}>
                  <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                    Ouvrir
                  </Typography>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card variant="outline" style={styles.emptyCard}>
            <Sparkles size={20} color={Colors.primary} />
            <Typography variant="body" style={{ fontWeight: '900', marginTop: 10 }}>
              Aucune conversation
            </Typography>
            <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: 6 }}>
              Les discussions apparaitront ici quand un client ouvre un produit vendeur eligible.
            </Typography>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Layout.screenBottomPadding,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroCard: {
    borderRadius: Radius.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  list: {
    gap: 10,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  productIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '14',
  },
  openPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 18,
  },
});
