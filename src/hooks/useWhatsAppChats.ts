import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WhatsAppChat {
  phone: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  direction: 'incoming' | 'outgoing';
}

export function useWhatsAppChats() {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchChats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para ver as conversas",
          variant: "destructive",
        });
        return;
      }

      // Buscar última mensagem de cada conversa
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Agrupar por telefone e pegar última mensagem
      const chatMap = new Map<string, WhatsAppChat>();
      
      data?.forEach((msg: any) => {
        if (!chatMap.has(msg.phone)) {
          chatMap.set(msg.phone, {
            phone: msg.phone,
            contactName: msg.contact_name || msg.phone,
            lastMessage: msg.message_text || '[Mídia]',
            lastMessageTime: new Date(msg.timestamp),
            unreadCount: msg.direction === 'incoming' && !msg.read_status ? 1 : 0,
            direction: msg.direction,
          });
        } else {
          // Incrementar contador de não lidas
          const chat = chatMap.get(msg.phone)!;
          if (msg.direction === 'incoming' && !msg.read_status) {
            chat.unreadCount++;
          }
        }
      });

      const chatsList = Array.from(chatMap.values())
        .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

      setChats(chatsList);
    } catch (error: any) {
      console.error('Error fetching chats:', error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();

    // Realtime para atualizar quando novas mensagens chegarem
    const channel = supabase
      .channel('whatsapp_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    chats,
    loading,
    refetch: fetchChats,
  };
}