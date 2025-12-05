import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  
  // Refs to prevent re-renders and avoid dependency issues
  const configsRef = useRef<EvolutionConfig[]>([]);
  const chatsRef = useRef<EvolutionChatWithInstance[]>([]);
  const initialLoadDoneRef = useRef(false);
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeOrgIdRef = useRef<string | null>(null);

  // Create stable key for configs - only recalculate if configs reference changes
  const configsKey = useMemo(() => {
    if (!configs || configs.length === 0) return '';
    return configs.map(c => c.id).sort().join(',');
  }, [configs]);

  // Update refs silently (no re-renders)
  useEffect(() => {
    configsRef.current = configs || [];
  }, [configs]);

  useEffect(() => {
    activeOrgIdRef.current = activeOrgId;
  }, [activeOrgId]);

  // Background fetch function - doesn't trigger re-renders unless data changed
  const fetchAllChatsBackground = useCallback(async () => {
    const currentConfigs = configsRef.current;
    const currentOrgId = activeOrgIdRef.current;
    
    if (!currentConfigs || currentConfigs.length === 0 || !currentOrgId) {
      return;
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const results = await Promise.all(
        currentConfigs.map(async (config) => {
          try {
            const { data, error } = await supabase.functions.invoke('evolution-fetch-chats', {
              body: { instanceId: config.id }
            });

            if (error) {
              console.error(`[Background] Erro instância ${config.instance_name}:`, error);
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
            console.error(`[Background] Erro instância ${config.instance_name}:`, err);
            return [];
          }
        })
      );

      const allChats = results.flat();
      
      // Only update state if data actually changed (compare JSON to avoid unnecessary renders)
      const currentChatsJson = JSON.stringify(chatsRef.current.map(c => ({ 
        remoteJid: c.remoteJid, 
        lastMessage: c.lastMessage,
        unreadCount: c.unreadCount 
      })));
      const newChatsJson = JSON.stringify(allChats.map(c => ({ 
        remoteJid: c.remoteJid, 
        lastMessage: c.lastMessage,
        unreadCount: c.unreadCount 
      })));
      
      if (currentChatsJson !== newChatsJson) {
        console.log(`🔄 Chats atualizados: ${allChats.length} conversas`);
        chatsRef.current = allChats;
        setChats(allChats);
      }
    } catch (error) {
      console.error('[Background] Error fetching chats:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Initial fetch - shows loading
  const fetchInitial = useCallback(async () => {
    const currentConfigs = configsRef.current;
    const currentOrgId = activeOrgIdRef.current;
    
    if (!currentConfigs || currentConfigs.length === 0 || !currentOrgId) {
      setChats([]);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
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
      console.log(`✅ Carregadas ${allChats.length} conversas de ${currentConfigs.length} instâncias`);
      chatsRef.current = allChats;
      setChats(allChats);
      initialLoadDoneRef.current = true;
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
      isFetchingRef.current = false;
    }
  }, [toast]);

  // Main effect - only runs when configsKey or activeOrgId actually change
  useEffect(() => {
    if (!configsKey || !activeOrgId) {
      setChats([]);
      chatsRef.current = [];
      setLoading(false);
      initialLoadDoneRef.current = false;
      
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset and fetch initial
    initialLoadDoneRef.current = false;
    fetchInitial();
    
    // Setup background polling every 90 seconds (optimized for cost)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      fetchAllChatsBackground();
    }, 90000); // 90 seconds - balanced between freshness and cost
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [configsKey, activeOrgId, fetchInitial, fetchAllChatsBackground]);

  return {
    chats,
    loading,
    refetch: fetchInitial,
  };
}
