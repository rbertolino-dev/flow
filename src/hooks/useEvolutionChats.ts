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
    if (!instanceId || !activeOrgId) {
      console.log('⏸️ Aguardando instanceId e activeOrgId...');
      setChats([]);
      return;
    }

    try {
      setLoading(true);
      
      console.log(`📞 Buscando chats para instância: ${instanceId}`);
      
      // Chamar edge function que busca chats da Evolution API
      const { data, error } = await supabase.functions.invoke('evolution-fetch-chats', {
        body: { instanceId }
      });

      if (error) {
        console.error('Erro da edge function:', error);
        throw error;
      }

      if (!data || !data.chats) {
        console.warn('Resposta sem chats:', data);
        setChats([]);
        return;
      }

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

      console.log(`✅ ${chatsList.length} conversas carregadas`);
      setChats(chatsList);
    } catch (error: any) {
      console.error('Error fetching Evolution chats:', error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message || "Não foi possível conectar à Evolution API",
        variant: "destructive",
      });
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!instanceId || !activeOrgId) {
      setChats([]);
      setLoading(false);
      return;
    }

    fetchChats();
    
    // Atualizar a cada 5 segundos apenas se tiver instância
    const interval = setInterval(fetchChats, 5000);
    
    return () => clearInterval(interval);
  }, [instanceId, activeOrgId]);

  return {
    chats,
    loading,
    refetch: fetchChats,
  };
}
