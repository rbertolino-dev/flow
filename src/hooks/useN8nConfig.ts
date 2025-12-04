import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "./useActiveOrganization";

export interface N8nConfig {
  id: string;
  organization_id: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
  last_connection_test: string | null;
  connection_status: 'connected' | 'disconnected' | 'error' | 'unknown';
  created_at: string;
  updated_at: string;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  settings?: any;
  staticData?: any;
  tags?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface N8nWorkflowExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  waitTill?: string;
  data?: any;
  workflowData?: any;
}

// Helper function to call n8n API through proxy
async function callN8nProxy(
  organizationId: string,
  path: string,
  method: string = "GET",
  data?: any
) {
  const { data: response, error } = await supabase.functions.invoke("n8n-proxy", {
    body: {
      organization_id: organizationId,
      path,
      method,
      data,
    },
  });

  if (error) {
    throw new Error(error.message || "Erro ao conectar com n8n");
  }

  if (!response.success) {
    throw new Error(response.error || `Erro ${response.status} ao acessar n8n`);
  }

  return response.data;
}

export function useN8nConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const { data: config, isLoading } = useQuery({
    queryKey: ["n8n-config", activeOrgId],
    queryFn: async (): Promise<N8nConfig | null> => {
      if (!activeOrgId) return null;

      try {
        const { data, error } = await supabase
          .from("n8n_configs" as any)
          .select("*")
          .eq("organization_id", activeOrgId)
          .maybeSingle();

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('Tabela n8n_configs não encontrada. Aplique a migração primeiro.');
            return null;
          }
          throw error;
        }
        return data as unknown as N8nConfig | null;
      } catch (error: any) {
        console.error('Erro ao buscar configuração n8n:', error);
        return null;
      }
    },
    enabled: !!activeOrgId,
    retry: false,
  });

  const testConnection = async () => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");

    try {
      await callN8nProxy(activeOrgId, "/api/v1/workflows", "GET");
      queryClient.invalidateQueries({ queryKey: ["n8n-config", activeOrgId] });
      return { success: true, message: "Conexão bem-sucedida!" };
    } catch (error: any) {
      queryClient.invalidateQueries({ queryKey: ["n8n-config", activeOrgId] });
      throw error;
    }
  };

  const saveConfig = useMutation({
    mutationFn: async ({ api_url, api_key }: { api_url: string; api_key: string }) => {
      if (!activeOrgId) throw new Error("Nenhuma organização selecionada");

      const { data, error } = await (supabase
        .from("n8n_configs" as any)
        .upsert({
          organization_id: activeOrgId,
          api_url,
          api_key,
          connection_status: 'unknown',
        } as any, {
          onConflict: 'organization_id'
        })
        .select()
        .single());

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["n8n-config", activeOrgId] });
      toast({
        title: "Configuração salva",
        description: "API n8n configurada com sucesso",
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
      if (!activeOrgId) throw new Error("Nenhuma organização selecionada");

      const { error } = await (supabase
        .from("n8n_configs" as any)
        .delete()
        .eq("organization_id", activeOrgId));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["n8n-config", activeOrgId] });
      toast({
        title: "Configuração removida",
        description: "Configuração da API n8n removida com sucesso",
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

  // Funções para gerenciar workflows (usando proxy)
  const listWorkflows = async (): Promise<N8nWorkflow[]> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    const response = await callN8nProxy(activeOrgId, "/api/v1/workflows", "GET");
    // n8n pode retornar { data: [...] } ou diretamente o array
    return response?.data || response || [];
  };

  const getWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "GET");
  };

  const createWorkflow = async (workflowData: Partial<N8nWorkflow>): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    // n8n requires settings property in the request body
    const payload = {
      name: workflowData.name || "New Workflow",
      nodes: workflowData.nodes || [],
      connections: workflowData.connections || {},
      settings: workflowData.settings || {
        executionOrder: "v1",
      },
      ...workflowData,
    };
    return callN8nProxy(activeOrgId, "/api/v1/workflows", "POST", payload);
  };

  const updateWorkflow = async (workflowId: string, workflowData: Partial<N8nWorkflow>): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    // Ensure settings is included for update
    const payload = {
      settings: { executionOrder: "v1" },
      ...workflowData,
    };
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "PUT", payload);
  };

  const deleteWorkflow = async (workflowId: string): Promise<void> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    await callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "DELETE");
  };

  const activateWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}/activate`, "POST");
  };

  const deactivateWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}/deactivate`, "POST");
  };

  const executeWorkflow = async (workflowId: string, inputData?: any): Promise<N8nWorkflowExecution> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}/execute`, "POST", inputData || {});
  };

  const getExecution = async (executionId: string): Promise<N8nWorkflowExecution> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    return callN8nProxy(activeOrgId, `/api/v1/executions/${executionId}`, "GET");
  };

  return {
    config,
    isLoading,
    saveConfig: saveConfig.mutate,
    isSaving: saveConfig.isPending,
    deleteConfig: deleteConfig.mutate,
    isDeleting: deleteConfig.isPending,
    testConnection,
    // Workflow functions
    listWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    deactivateWorkflow,
    executeWorkflow,
    getExecution,
  };
}
