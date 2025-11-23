import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useChatwootChats = (organizationId: string | null) => {
  return useQuery({
    queryKey: ['chatwoot-chats', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      console.log('📞 Chamando chatwoot-list-inboxes para org:', organizationId);
      
      const { data, error } = await supabase.functions.invoke('chatwoot-list-inboxes', {
        body: { organizationId },
      });

      console.log('📦 Resposta do chatwoot-list-inboxes:', data);

      if (error) {
        console.error('❌ Erro ao chamar edge function:', error);
        throw error;
      }
      if (data?.error) {
        console.error('❌ Erro retornado pela edge function:', data.error);
        throw new Error(data.error);
      }
      
      // Garantir que retornamos um array
      const inboxesList = data?.inboxes || data?.payload || data || [];
      console.log('📋 Inboxes processadas:', inboxesList);
      
      return Array.isArray(inboxesList) ? inboxesList : [];
    },
    enabled: !!organizationId,
  });
};

