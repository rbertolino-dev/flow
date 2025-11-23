import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatwootMessage {
  id: number;
  content: string;
  message_type: 'incoming' | 'outgoing';
  created_at: string;
  sender?: {
    name: string;
  };
}

export const useChatwootMessages = (
  organizationId: string | null,
  inboxIdentifier: string | null,
  contactIdentifier: string | null,
  conversationId: string | null
) => {
  const [messages, setMessages] = useState<ChatwootMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    if (!organizationId || !inboxIdentifier || !contactIdentifier || !conversationId) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-get-messages', {
        body: {
          organizationId,
          inboxIdentifier,
          contactIdentifier,
          conversationId,
        },
      });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        return;
      }

      if (data?.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Atualizar mensagens a cada 5 segundos
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [organizationId, inboxIdentifier, contactIdentifier, conversationId]);

  return { messages, loading, refetch: fetchMessages };
};
