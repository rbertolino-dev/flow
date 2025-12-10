import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface HubSpotConfig {
  id: string;
  organization_id: string;
  access_token: string;
  portal_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_settings: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export function useHubSpotConfigs() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["hubspot-config", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;

      const { data, error } = await supabase
        .from("hubspot_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar configuração do HubSpot:", error);
        throw error;
      }
      
      return data as HubSpotConfig | null;
    },
    enabled: !!activeOrgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from("hubspot_configs")
        .delete()
        .eq("id", configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-config"] });
      toast({
        title: "Configuração removida",
        description: "A configuração do HubSpot foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover configuração",
        description: error.message || "Não foi possível remover a configuração.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<HubSpotConfig> }) => {
      const { error } = await supabase
        .from("hubspot_configs")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-config"] });
      toast({
        title: "Configuração atualizada",
        description: "A configuração do HubSpot foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar configuração",
        description: error.message || "Não foi possível atualizar a configuração.",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      access_token: string;
      portal_id?: string;
      is_active?: boolean;
      sync_settings?: Record<string, any>;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data: newConfig, error } = await supabase
        .from("hubspot_configs")
        .insert({
          organization_id: activeOrgId,
          access_token: data.access_token,
          portal_id: data.portal_id || null,
          is_active: data.is_active ?? true,
          sync_settings: data.sync_settings || {},
        })
        .select()
        .single();

      if (error) throw error;
      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-config"] });
      toast({
        title: "Configuração criada",
        description: "A configuração do HubSpot foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar configuração",
        description: error.message || "Não foi possível criar a configuração.",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-test-connection`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao testar conexão");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão bem-sucedida",
        description: data.message || "Conexão com HubSpot estabelecida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível conectar com o HubSpot.",
        variant: "destructive",
      });
    },
  });

  const syncContactsMutation = useMutation({
    mutationFn: async (options?: { incremental?: boolean; limit?: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-sync-contacts`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options || {}),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao sincronizar contatos");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-config"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Sincronização concluída",
        description: `Criados: ${data.stats.created}, Atualizados: ${data.stats.updated}, Ignorados: ${data.stats.skipped}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar contatos.",
        variant: "destructive",
      });
    },
  });

  return {
    config,
    isLoading,
    error,
    deleteConfig: deleteMutation.mutate,
    updateConfig: updateMutation.mutate,
    createConfig: createMutation.mutate,
    testConnection: testConnectionMutation.mutate,
    syncContacts: syncContactsMutation.mutate,
    isDeleting: deleteMutation.isPending,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isTestingConnection: testConnectionMutation.isPending,
    isSyncing: syncContactsMutation.isPending,
  };
}

