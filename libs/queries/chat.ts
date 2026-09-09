import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabase } from './client';
import type { ChatConversationRow, ChatMessageRow } from './types';

export function useChatInbox(userId?: string | null) {
  return useQuery<ChatConversationRow[]>({
    queryKey: ['chat-inbox', userId ?? 'guest'],
    enabled: !!userId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          id,
          product_id,
          seller_id,
          client_id,
          last_message_preview,
          last_message_at,
          created_at,
          products(
            id,
            name,
            category,
            unit,
            image_url
          )
        `)
        .or(`seller_id.eq.${userId},client_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /chat_conversations/i.test(String((error as any)?.message || ''))) {
          return [];
        }
        throw error;
      }

      return (data ?? []) as ChatConversationRow[];
    },
  });
}

export function useChatThread(input: {
  userId?: string | null;
  conversationId?: string | null;
  sellerId?: string | null;
  productId?: string | null;
}) {
  const queryClient = useQueryClient();
  const hasSeedParameters = Boolean(input.conversationId) || (Boolean(input.sellerId) && Boolean(input.productId));

  const conversationIdQuery = useQuery({
    queryKey: [
      'chat-thread-seed',
      input.userId ?? 'guest',
      input.conversationId ?? 'none',
      input.sellerId ?? 'none',
      input.productId ?? 'none',
    ],
    enabled: !!input.userId && hasSeedParameters,
    queryFn: async () => {
      assertSupabaseConfigured();

      if (input.conversationId) {
        return input.conversationId;
      }

      if (!input.userId || !input.sellerId || !input.productId) {
        return null;
      }

      const findExistingConversation = async () => {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('product_id', input.productId)
          .eq('seller_id', input.sellerId)
          .eq('client_id', input.userId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data?.id ?? null;
      };

      const existingId = await findExistingConversation();
      if (existingId) {
        return existingId;
      }

      const { error: insertError } = await supabase.from('chat_conversations').insert({
        product_id: input.productId,
        seller_id: input.sellerId,
        client_id: input.userId,
      });

      if (insertError) {
        if (String((insertError as any)?.code || '') === '42P01' || /chat_conversations/i.test(String((insertError as any)?.message || ''))) {
          throw new Error('La messagerie n est pas encore installee cote base.');
        }

        const conflictOrDuplicate =
          String((insertError as any)?.code || '') === '23505' ||
          String((insertError as any)?.code || '') === '409' ||
          /duplicate|conflict/i.test(String((insertError as any)?.message || ''));

        if (conflictOrDuplicate) {
          const recoveredId = await findExistingConversation();
          if (recoveredId) {
            return recoveredId;
          }
        }

        throw insertError;
      }

      return await findExistingConversation();
    },
  });

  const activeConversationId = input.conversationId ?? conversationIdQuery.data ?? null;

  const conversationQuery = useQuery<ChatConversationRow | null>({
    queryKey: ['chat-conversation', activeConversationId ?? 'none'],
    enabled: !!activeConversationId,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          id,
          product_id,
          seller_id,
          client_id,
          last_message_preview,
          last_message_at,
          created_at,
          products(
            id,
            name,
            category,
            unit,
            image_url
          )
        `)
        .eq('id', activeConversationId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as ChatConversationRow | null;
    },
  });

  const messagesQuery = useQuery<ChatMessageRow[]>({
    queryKey: ['chat-messages', activeConversationId ?? 'none'],
    enabled: !!activeConversationId,
    refetchInterval: 8000,
    queryFn: async () => {
      assertSupabaseConfigured();

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, conversation_id, sender_id, body, created_at, read_at')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /chat_messages/i.test(String((error as any)?.message || ''))) {
          return [];
        }
        throw error;
      }

      return (data ?? []) as ChatMessageRow[];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      assertSupabaseConfigured();

      const trimmed = body.trim();
      if (!trimmed) {
        throw new Error('Message vide.');
      }

      if (!activeConversationId || !input.userId) {
        throw new Error('Conversation introuvable.');
      }

      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: activeConversationId,
        sender_id: input.userId,
        body: trimmed,
      });

      if (error) {
        if (String((error as any)?.code || '') === '42P01' || /chat_messages/i.test(String((error as any)?.message || ''))) {
          throw new Error('La messagerie n est pas encore installee cote base.');
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversationId ?? 'none'] }),
        queryClient.invalidateQueries({ queryKey: ['chat-conversation', activeConversationId ?? 'none'] }),
        queryClient.invalidateQueries({ queryKey: ['chat-inbox', input.userId ?? 'guest'] }),
      ]);
    },
  });

  return {
    conversationId: activeConversationId,
    conversation: conversationQuery.data ?? null,
    messages: messagesQuery.data ?? [],
    isLoading: conversationIdQuery.isLoading || conversationQuery.isLoading || messagesQuery.isLoading,
    isSending: sendMessage.isPending,
    sendMessage: sendMessage.mutateAsync,
  };
}
