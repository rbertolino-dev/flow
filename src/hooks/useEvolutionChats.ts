import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface EvolutionChat {
  remoteJid: string;
  name: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  profilePicUrl?: string;
}

export function useEvolutionChats(instanceId: string | null) {
  const [chats, setChats] = useState<EvolutionChat[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const fetchChats = async () => {
    if (!instanceId || !activeOrgId) return;

    try {
      setLoading(true);
      
      // Chamar edge function que busca chats da Evolution API
      const { data, error } = await supabase.functions.invoke('evolution-fetch-chats', {
        body: { instanceId }
      });

      if (error) throw error;

      const chatsList: EvolutionChat[] = (data.chats || []).map((chat: any) => ({
        remoteJid: chat.id,
        name: chat.name || chat.id.split('@')[0],
        lastMessage: chat.lastMessage?.message?.conversation || '[Mídia]',
        lastMessageTime: chat.lastMessage?.messageTimestamp 
          ? new Date(chat.lastMessage.messageTimestamp * 1000)
          : new Date(),
        unreadCount: chat.unreadCount || 0,
        profilePicUrl: chat.profilePicUrl,
      }));

      setChats(chatsList);
    } catch (error: any) {
      console.error('Error fetching Evolution chats:', error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message || "Não foi possível conectar à Evolution API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
    
    // Atualizar a cada 5 segundos
    const interval = setInterval(fetchChats, 5000);
    
    return () => clearInterval(interval);
  }, [instanceId, activeOrgId]);

  return {
    chats,
    loading,
    refetch: fetchChats,
  };
}
