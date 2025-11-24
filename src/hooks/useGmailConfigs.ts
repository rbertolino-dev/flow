import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface GmailConfig {
  id: string;
  organization_id: string;
  account_name: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  is_active: boolean;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useGmailConfigs() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: configs, isLoading, error } = useQuery({
    queryKey: ["gmail-configs", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("gmail_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar configurações do Gmail:", error);
        throw error;
      }
      
      return data as GmailConfig[];
    },
    enabled: !!activeOrgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from("gmail_configs")
        .delete()
        .eq("id", configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-configs"] });
      toast({
        title: "Conta removida",
        description: "A conta do Gmail foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover conta",
        description: error.message || "Não foi possível remover a conta.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GmailConfig> }) => {
      const { error } = await supabase
        .from("gmail_configs")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar conta",
        description: error.message || "Não foi possível atualizar a conta.",
        variant: "destructive",
      });
    },
  });

  return {
    configs: configs || [],
    isLoading,
    error,
    deleteConfig: deleteMutation.mutate,
    updateConfig: updateMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

