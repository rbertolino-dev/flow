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
  const [hasMore, setHasMore] = useState(true);

  // ✅ OTIMIZAÇÃO 2: Lazy loading - carregar apenas últimas 50 mensagens
  const fetchMessages = async (limit = 50) => {
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
          limit, // Limitar quantidade de mensagens
        },
      });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        setMessages([]);
        return;
      }

      if (data?.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        // Se retornar menos que o limite, não há mais mensagens
        setHasMore(data.messages.length >= limit);
      } else {
        setMessages([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
      setMessages([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar mais mensagens antigas
  const loadMore = async () => {
    if (!hasMore || loading) return;
    await fetchMessages(100); // Carregar mais 50
  };

  useEffect(() => {
    // Buscar mensagens iniciais
    fetchMessages();

    if (!organizationId || !conversationId) return;

    // Conectar ao Realtime para receber mensagens instantaneamente (SEM POLLING!)
    console.log('🔌 Conectando ao Realtime para conversa:', conversationId);
    
    const channel = supabase
      .channel('chatwoot-messages')
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          console.log('📨 Nova mensagem via Realtime:', payload);
          
          // Verificar se a mensagem é desta conversa
          if (payload.payload.conversationId === conversationId) {
            const newMessage = payload.payload.message;
            
            setMessages(prev => {
              // Evitar duplicatas
              const exists = prev.some(m => m.id === newMessage.id);
              if (exists) return prev;
              
              return [...prev, newMessage];
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do Realtime:', status);
      });

    // ✅ OTIMIZAÇÃO: Removido polling de 30s - apenas Realtime!
    // Buscar quando a aba voltar a ficar ativa (apenas uma vez)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Aba ativa - buscando mensagens');
        fetchMessages();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('🔌 Desconectando do Realtime');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [organizationId, conversationId]);

  return { messages, loading, refetch: fetchMessages, loadMore, hasMore };
};
