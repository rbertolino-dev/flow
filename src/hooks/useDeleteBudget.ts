import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";

export function useDeleteBudget() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budgetId: string) => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      const { error } = await (supabase as any)
        .from('budgets')
        .delete()
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({
        title: "Orçamento excluído",
        description: "O orçamento foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir orçamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

