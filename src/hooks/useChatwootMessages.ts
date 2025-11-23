import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatwootMessage {
  id: number;
  content: string;
  message_type: number | 'incoming' | 'outgoing'; // 0 = incoming, 1 = outgoing
  created_at: string;
  sender?: {
    name: string;
  };
}

export const useChatwootMessages = (
  organizationId: string | null,
  conversationId: string | null
) => {
  const [messages, setMessages] = useState<ChatwootMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    if (!organizationId || !conversationId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-get-messages', {
        body: {
          organizationId,
          conversationId,
        },
      });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        setMessages([]);
        return;
      }

      if (data?.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Atualizar mensagens a cada 30 segundos (otimizado)
    const interval = setInterval(() => {
      // Só buscar se a aba estiver ativa
      if (!document.hidden) {
        fetchMessages();
      }
    }, 30000); // 30 segundos
    
    // Buscar quando a aba voltar a ficar ativa
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMessages();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [organizationId, conversationId]);

  return { messages, loading, refetch: fetchMessages };
};
