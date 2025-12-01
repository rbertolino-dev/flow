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
          console.error(`❌ Erro ao buscar conversas da inbox ${inboxId}:`, error);
          return [];
        }
        
        if (data?.error) {
          console.error(`❌ Erro retornado da inbox ${inboxId}:`, data.error);
          // Mesmo com erro, retornar array vazio ao invés de quebrar
          return [];
        }
        
        // A função agora retorna todas as conversas paginadas automaticamente
        const conversationsList = data?.conversations || [];
        
        if (!Array.isArray(conversationsList)) {
          console.warn(`⚠️ Resposta da inbox ${inboxId} não é um array:`, typeof conversationsList);
          return [];
        }
        
        console.log(`💬 ${conversationsList.length} conversas encontradas na inbox ${inboxId} (Total: ${data?.total || conversationsList.length})`);
        
        return conversationsList;
      } catch (err) {
        console.error('❌ Exceção ao buscar conversas:', err);
        return [];
      }
    },
    enabled: !!organizationId && !!inboxId,
  });
};
