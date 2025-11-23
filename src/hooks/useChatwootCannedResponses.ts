import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useChatwootCannedResponses = (organizationId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cannedResponses = [], isLoading } = useQuery({
    queryKey: ['chatwoot-canned-responses', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase.functions.invoke('chatwoot-list-canned-responses', {
        body: { organizationId },
      });

      if (error || data?.error) {
        console.error('Erro ao buscar respostas prontas:', error || data?.error);
        return [];
      }
      
      return data?.cannedResponses || [];
    },
    enabled: !!organizationId,
  });

  const createCannedResponse = useMutation({
    mutationFn: async ({ shortCode, content }: { shortCode: string; content: string }) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data, error } = await supabase.functions.invoke('chatwoot-create-canned-response', {
        body: { organizationId, shortCode, content },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Erro ao criar resposta pronta');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatwoot-canned-responses', organizationId] });
      toast({ title: "Resposta pronta criada" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao criar resposta pronta", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  return {
    cannedResponses,
    isLoading,
    createCannedResponse: createCannedResponse.mutate,
  };
};
