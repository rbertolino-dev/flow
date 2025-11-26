import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "./useActiveOrganization";

export interface BubbleConfig {
  id: string;
  organization_id: string;
  api_url: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export function useBubbleConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const { data: config, isLoading } = useQuery({
    queryKey: ["bubble-config", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;

      const { data, error } = await supabase
        .from("bubble_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .maybeSingle();

      if (error) throw error;
      return data as BubbleConfig | null;
    },
    enabled: !!activeOrgId,
  });

  const saveConfig = useMutation({
    mutationFn: async ({ api_url, api_key }: { api_url: string; api_key: string }) => {
      if (!activeOrgId) throw new Error("No organization selected");

      const { data, error } = await supabase
        .from("bubble_configs")
        .upsert({
          organization_id: activeOrgId,
          api_url,
          api_key,
        }, {
          onConflict: 'organization_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bubble-config", activeOrgId] });
      toast({
        title: "Configuração salva",
        description: "API Bubble.io configurada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("No organization selected");

      const { error } = await supabase
        .from("bubble_configs")
        .delete()
        .eq("organization_id", activeOrgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bubble-config", activeOrgId] });
      toast({
        title: "Configuração removida",
        description: "Configuração da API Bubble.io removida com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    config,
    isLoading,
    saveConfig: saveConfig.mutate,
    isSaving: saveConfig.isPending,
    deleteConfig: deleteConfig.mutate,
    isDeleting: deleteConfig.isPending,
  };
}
