import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface EvolutionChatWithInstance {
  remoteJid: string;
  name: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  profilePicUrl?: string;
  instanceId: string;
  instanceName: string;
}

interface EvolutionConfig {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
}

export function useAllEvolutionChats(configs: EvolutionConfig[]) {
  const [chats, setChats] = useState<EvolutionChatWithInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const fetchAllChats = useCallback(async () => {
    if (!configs || configs.length === 0 || !activeOrgId) {
      setChats([]);
      return;
    }

    try {
      setLoading(true);
      
      // Buscar chats de todas as instâncias em paralelo
      const results = await Promise.all(
        configs.map(async (config) => {
          try {
            const { data, error } = await supabase.functions.invoke('evolution-fetch-chats', {
              body: { instanceId: config.id }
            });

            if (error) {
              console.error(`Erro ao buscar chats da instância ${config.instance_name}:`, error);
              return [];
            }

            if (!data?.chats) return [];

            return (data.chats || []).map((chat: any) => ({
              remoteJid: chat.id,
              name: chat.name || chat.id.split('@')[0],
              lastMessage: chat.lastMessage?.message?.conversation || '[Mídia]',
              lastMessageTime: chat.lastMessage?.messageTimestamp 
                ? new Date(chat.lastMessage.messageTimestamp * 1000)
                : new Date(),
              unreadCount: chat.unreadCount || 0,
              profilePicUrl: chat.profilePicUrl,
              instanceId: config.id,
              instanceName: config.instance_name,
            }));
          } catch (err) {
            console.error(`Erro ao buscar chats da instância ${config.instance_name}:`, err);
            return [];
          }
        })
      );

      // Combinar todos os resultados
      const allChats = results.flat();
      console.log(`✅ Total de ${allChats.length} conversas de ${configs.length} instâncias`);
      setChats(allChats);
    } catch (error: any) {
      console.error('Error fetching all Evolution chats:', error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message || "Não foi possível conectar às instâncias",
        variant: "destructive",
      });
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [configs, activeOrgId, toast]);

  useEffect(() => {
    if (!configs || configs.length === 0 || !activeOrgId) {
      setChats([]);
      setLoading(false);
      return;
    }

    fetchAllChats();
    
    // Atualizar a cada 5 segundos
    const interval = setInterval(fetchAllChats, 5000);
    
    return () => clearInterval(interval);
  }, [configs, activeOrgId, fetchAllChats]);

  return {
    chats,
    loading,
    refetch: fetchAllChats,
  };
}
