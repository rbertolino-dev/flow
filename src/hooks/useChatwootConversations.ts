import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useChatwootConversations = (organizationId: string | null, inboxId: number | null) => {
  return useQuery({
    queryKey: ['chatwoot-conversations', organizationId, inboxId],
    queryFn: async () => {
      if (!organizationId || !inboxId) return [];
      
      try {
        console.log('📞 Buscando conversas da inbox:', inboxId);
        
        const { data, error } = await supabase.functions.invoke('chatwoot-get-conversations', {
          body: { organizationId, inboxId },
        });

        if (error) {
          console.error('❌ Erro ao buscar conversas:', error);
          return [];
        }
        
        if (data?.error) {
          console.error('❌ Erro retornado:', data.error);
          return [];
        }
        
        const conversationsList = data?.conversations?.data?.payload || data?.conversations?.payload || data?.conversations || [];
        console.log('💬 Conversas encontradas:', conversationsList);
        
        return Array.isArray(conversationsList) ? conversationsList : [];
      } catch (err) {
        console.error('❌ Exceção ao buscar conversas:', err);
        return [];
      }
    },
    enabled: !!organizationId && !!inboxId,
  });
};
