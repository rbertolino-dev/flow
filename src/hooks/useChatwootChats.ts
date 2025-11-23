import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useChatwootChats = (organizationId: string | null) => {
  return useQuery({
    queryKey: ['chatwoot-chats', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase.functions.invoke('chatwoot-list-inboxes', {
        body: { organizationId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      // Retornar a lista de inboxes (caixas de entrada)
      return data.inboxes || [];
    },
    enabled: !!organizationId,
  });
};
