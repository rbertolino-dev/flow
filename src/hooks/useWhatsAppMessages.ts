import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WhatsAppMessage {
  id: string;
  messageText: string;
  messageType: string;
  mediaUrl?: string;
  direction: 'incoming' | 'outgoing';
  timestamp: Date;
  readStatus: boolean;
}

export function useWhatsAppMessages(phone: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMessages = async () => {
    if (!phone) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      setMessages(
        (data || []).map((msg: any) => ({
          id: msg.id,
          messageText: msg.message_text,
          messageType: msg.message_type,
          mediaUrl: msg.media_url,
          direction: msg.direction,
          timestamp: new Date(msg.timestamp),
          readStatus: msg.read_status,
        }))
      );

      // Marcar mensagens como lidas
      if (data && data.length > 0) {
        await supabase
          .from('whatsapp_messages')
          .update({ read_status: true })
          .eq('user_id', user.id)
          .eq('phone', phone)
          .eq('direction', 'incoming')
          .eq('read_status', false);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!phone) return;

    // Realtime para novas mensagens
    const channel = supabase
      .channel(`whatsapp_messages_${phone}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `phone=eq.${phone}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phone]);

  return {
    messages,
    loading,
    refetch: fetchMessages,
  };
}