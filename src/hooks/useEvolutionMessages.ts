import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EvolutionMessage {
  id: string;
  messageText: string;
  messageType: string;
  mediaUrl?: string;
  direction: 'incoming' | 'outgoing';
  timestamp: Date;
  readStatus: boolean;
}

export function useEvolutionMessages(instanceId: string | null, remoteJid: string | null) {
  const [messages, setMessages] = useState<EvolutionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMessages = async () => {
    if (!instanceId || !remoteJid) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('evolution-fetch-messages', {
        body: { instanceId, remoteJid }
      });

      if (error) throw error;

      const messagesList: EvolutionMessage[] = (data.messages || []).map((msg: any) => ({
        id: msg.key?.id || Math.random().toString(),
        messageText: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[Mídia]',
        messageType: msg.messageType || 'text',
        mediaUrl: msg.message?.imageMessage?.url || msg.message?.videoMessage?.url,
        direction: msg.key?.fromMe ? 'outgoing' : 'incoming',
        timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date(),
        readStatus: msg.status === 'READ' || msg.key?.fromMe,
      }));

      setMessages(messagesList);
    } catch (error: any) {
      console.error('Error fetching Evolution messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message || "Não foi possível buscar mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Atualizar a cada 3 segundos
    const interval = setInterval(fetchMessages, 3000);
    
    return () => clearInterval(interval);
  }, [instanceId, remoteJid]);

  return {
    messages,
    loading,
    refetch: fetchMessages,
  };
}
