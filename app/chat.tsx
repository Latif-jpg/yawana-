import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, Send, Shield, ShoppingBag, Sparkles } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Typography } from '@/components/Typography';
import { Colors, Radius, Shadows, Spacing } from '@/constants/Theme';
import { useAuth } from '@/libs/auth';
import { formatTimeAgo } from '@/libs/format';
import { useChatThread, useProfile } from '@/libs/queries';
import { useToast } from '@/components/ToastProvider';

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    sellerId?: string | string[];
    sellerName?: string | string[];
    productId?: string | string[];
    productName?: string | string[];
    productCategory?: string | string[];
    productUnit?: string | string[];
    source?: string | string[];
  }>();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId || '';
  const sellerId = Array.isArray(params.sellerId) ? params.sellerId[0] : params.sellerId || '';
  const sellerName = Array.isArray(params.sellerName) ? params.sellerName[0] : params.sellerName || '';
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId || '';
  const productName = Array.isArray(params.productName) ? params.productName[0] : params.productName || 'Produit';
  const productCategory = Array.isArray(params.productCategory) ? params.productCategory[0] : params.productCategory || '';
  const productUnit = Array.isArray(params.productUnit) ? params.productUnit[0] : params.productUnit || '';
  const source = Array.isArray(params.source) ? params.source[0] : params.source || 'catalog';

  const { conversation, messages, isSending, sendMessage } = useChatThread({
    userId: user?.id || null,
    conversationId: conversationId || null,
    sellerId: sellerId || null,
    productId: productId || null,
  });

  const counterpartId = useMemo(() => {
    if (!user?.id) return sellerId || null;
    if (!conversation) return sellerId || null;
    return conversation.seller_id === user.id ? conversation.client_id : conversation.seller_id;
  }, [conversation, sellerId, user?.id]);

  const { data: counterpartProfile } = useProfile(counterpartId || '');

  const title = useMemo(() => {
    if (counterpartProfile?.full_name) return counterpartProfile.full_name;
    if (sellerName) return sellerName;
    if (conversation) return 'Conversation en cours';
    return 'Messagerie';
  }, [conversation, counterpartProfile?.full_name, sellerName]);

  const productTitle = conversation?.products?.name || productName;
  const productMeta = [conversation?.products?.category || productCategory, conversation?.products?.unit || productUnit]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  const canSend = Boolean(user?.id && (conversationId || (sellerId && productId) || conversation?.id));

  const handleBack = () => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)');
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      await sendMessage(trimmed);
      setMessage('');
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Message non envoye',
        message: (error as any)?.message || 'Impossible de publier le message pour le moment.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <ArrowLeft size={18} color={Colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Typography variant="label" color={Colors.textSecondary}>
              Messagerie client-vendeur
            </Typography>
            <Typography variant="h2" numberOfLines={1}>
              {title}
            </Typography>
          </View>
          <View style={styles.headerBadge}>
            <Shield size={14} color={Colors.white} />
            <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800', marginLeft: 6 }}>
              Public
            </Typography>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.threadScroll}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <Card variant="elevated" style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <MessageCircle size={20} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label" color={Colors.primary}>
                  Fil actif
                </Typography>
                <Typography variant="body" color={Colors.textSecondary}>
                  {conversation
                    ? "La conversation garde l'historique avec ce vendeur."
                    : 'Ouvre un produit vendeur pour demarrer une conversation persistante.'}
                </Typography>
              </View>
            </View>
          </Card>

          <Card variant="outline" style={styles.contextCard}>
            <View style={styles.contextTopRow}>
              <View style={styles.contextIcon}>
                <ShoppingBag size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label" color={Colors.textSecondary}>
                  Produit lie
                </Typography>
                <Typography variant="h2" style={{ marginTop: 4 }} numberOfLines={1}>
                  {productTitle}
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }} numberOfLines={1}>
                  {productMeta || `Source: ${source === 'boutique' ? 'Boutique' : 'Catalogue'}`}
                </Typography>
              </View>
            </View>
          </Card>

          {messages.length ? (
            messages.map((item) => {
              const isMine = item.sender_id === user?.id;

              return (
                <View key={item.id} style={[styles.messageBubble, isMine ? styles.clientBubble : styles.vendorBubble]}>
                  <Typography
                    variant="caption"
                    color={isMine ? Colors.white : Colors.text}
                    style={styles.messageText}
                  >
                    {item.body}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={isMine ? Colors.white : Colors.textSecondary}
                    style={styles.messageTime}
                  >
                    {formatTimeAgo(item.created_at)}
                  </Typography>
                </View>
              );
            })
          ) : (
            <Card variant="outline" style={styles.emptyStateCard}>
              <View style={styles.emptyStateRow}>
                <Sparkles size={18} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Typography variant="body" style={{ fontWeight: '800' }}>
                    Aucun message pour le moment
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    Ecris le premier message pour lancer l'echange.
                  </Typography>
                </View>
              </View>
            </Card>
          )}
        </ScrollView>

        <View style={styles.composerWrap}>
          <View style={styles.composerTopRow}>
            <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
              {counterpartProfile?.full_name || sellerName || 'Vendeur'}
            </Typography>
            <View style={styles.livePill}>
              <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                {conversation ? 'Conversation active' : 'Pret a ouvrir'}
              </Typography>
            </View>
          </View>

          <View style={styles.composer}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={canSend ? 'Ecris un message au vendeur...' : 'Ouvre un produit vendeur pour commencer...'}
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
              multiline
              editable={canSend && !isSending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!canSend || isSending || !message.trim()) && styles.sendBtnDisabled]}
              onPress={handleSend}
              activeOpacity={0.85}
              disabled={!canSend || isSending || !message.trim()}
            >
              {isSending ? <ActivityIndicator size="small" color={Colors.white} /> : <Send size={18} color={Colors.white} />}
            </TouchableOpacity>
          </View>

          {!canSend ? (
            <Card variant="outline" style={styles.emptyHintCard}>
              <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
                Seuls les produits avec vendeur visible ouvrent une vraie conversation.
              </Typography>
            </Card>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardContainer: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'android' ? 12 : 22,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  threadScroll: {
    flex: 1,
    minHeight: 0,
  },
  threadContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    gap: 10,
  },
  heroCard: {
    borderRadius: 24,
    paddingVertical: Platform.OS === 'android' ? 10 : undefined,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.premium,
  },
  contextCard: {
    marginBottom: 4,
  },
  contextTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contextIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clientBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
  },
  vendorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    lineHeight: 18,
  },
  messageTime: {
    marginTop: 6,
    opacity: 0.8,
  },
  emptyStateCard: {
    marginTop: 6,
    paddingVertical: 12,
  },
  emptyStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Platform.OS === 'android' ? 10 : 18,
    gap: 8,
    backgroundColor: Colors.background,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  livePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.premium,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  emptyHintCard: {
    paddingVertical: 12,
  },
});
