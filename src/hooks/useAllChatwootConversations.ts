import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para buscar conversas de todas as inboxes do Chatwoot em paralelo
 */
export const useAllChatwootConversations = (organizationId: string | null, inboxes: any[]) => {
  const queries = useQueries({
    queries: inboxes.map((inbox) => ({
      queryKey: ['chatwoot-conversations', organizationId, inbox.id],
      queryFn: async () => {
        if (!organizationId || !inbox.id) return [];
        
        try {
          console.log('📞 Buscando conversas da inbox:', inbox.id);
          
          const { data, error } = await supabase.functions.invoke('chatwoot-get-conversations', {
            body: { organizationId, inboxId: inbox.id },
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
          console.log(`💬 ${conversationsList.length} conversas encontradas na inbox ${inbox.name}`);
          
          // Adicionar informações da inbox em cada conversa
          return Array.isArray(conversationsList) 
            ? conversationsList.map((conv: any) => ({
                ...conv,
                inboxId: inbox.id,
                inboxName: inbox.name,
              }))
            : [];
        } catch (err) {
          console.error('❌ Exceção ao buscar conversas:', err);
          return [];
        }
      },
      enabled: !!organizationId && !!inbox.id,
    })),
  });

  // Combinar todas as conversas de todas as inboxes
  const allConversations = queries
    .flatMap((query) => query.data || [])
    .sort((a: any, b: any) => {
      const timeA = a.timestamp ? a.timestamp * 1000 : new Date(a.created_at || 0).getTime();
      const timeB = b.timestamp ? b.timestamp * 1000 : new Date(b.created_at || 0).getTime();
      return timeB - timeA; // Mais recente primeiro
    });

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);

  return {
    conversations: allConversations,
    isLoading,
    isError,
    refetch: () => queries.forEach((query) => query.refetch()),
  };
};



