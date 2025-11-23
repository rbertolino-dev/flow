import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useChatwootLabels = (organizationId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['chatwoot-labels', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase.functions.invoke('chatwoot-list-labels', {
        body: { organizationId },
      });

      if (error || data?.error) {
        console.error('Erro ao buscar labels:', error || data?.error);
        return [];
      }
      
      return data?.labels || [];
    },
    enabled: !!organizationId,
  });

  const createLabel = useMutation({
    mutationFn: async ({ title, color }: { title: string; color: string }) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data, error } = await supabase.functions.invoke('chatwoot-create-label', {
        body: { organizationId, title, color },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Erro ao criar label');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatwoot-labels', organizationId] });
      toast({ title: "Label criada com sucesso" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao criar label", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const applyLabel = useMutation({
    mutationFn: async ({ conversationId, labelId }: { conversationId: number; labelId: number }) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data, error } = await supabase.functions.invoke('chatwoot-apply-label', {
        body: { organizationId, conversationId, labelId },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Erro ao aplicar label');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatwoot-conversations'] });
      toast({ title: "Label aplicada" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao aplicar label", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  return {
    labels,
    isLoading,
    createLabel: createLabel.mutate,
    applyLabel: applyLabel.mutate,
  };
};
