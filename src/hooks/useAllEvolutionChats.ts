import { useState, useEffect, useCallback, useRef } from "react";
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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  
  // Use refs to avoid dependency issues
  const configsRef = useRef<EvolutionConfig[]>([]);
  const initialLoadDoneRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Update refs when configs change
  useEffect(() => {
    configsRef.current = configs || [];
  }, [configs]);

  const fetchAllChats = useCallback(async (isInitialLoad = false) => {
    const currentConfigs = configsRef.current;
    
    if (!currentConfigs || currentConfigs.length === 0 || !activeOrgId) {
      setChats([]);
      setLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      
      const results = await Promise.all(
        currentConfigs.map(async (config) => {
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

      const allChats = results.flat();
      console.log(`✅ Total de ${allChats.length} conversas de ${currentConfigs.length} instâncias`);
      setChats(allChats);
      initialLoadDoneRef.current = true;
    } catch (error: any) {
      console.error('Error fetching all Evolution chats:', error);
      if (isInitialLoad) {
        toast({
          title: "Erro ao carregar conversas",
          description: error.message || "Não foi possível conectar às instâncias",
          variant: "destructive",
        });
      }
      setChats([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (!configs || configs.length === 0 || !activeOrgId) {
      setChats([]);
      setLoading(false);
      initialLoadDoneRef.current = false;
      return;
    }

    // Initial fetch
    initialLoadDoneRef.current = false;
    fetchAllChats(true);
    
    // Polling every 60 seconds (reduced for cost savings)
    const interval = setInterval(() => {
      fetchAllChats(false);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [configs?.length, activeOrgId, fetchAllChats]);

  return {
    chats,
    loading,
    refetch: () => fetchAllChats(true),
  };
}
