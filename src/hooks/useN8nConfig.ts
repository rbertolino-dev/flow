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

  const normalizeApiUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin;
    } catch {
      return url.replace(/\/$/, '');
    }
  };

  const buildApiPath = (path: string) => {
    const base = normalizeApiUrl(config?.api_url || '');
    const sep = path.startsWith('/') ? '' : '/';
    return `${base}${sep}${path}`;
  };

  const testConnection = async () => {
    if (!config) throw new Error("Configuração não encontrada");

    try {
      const apiUrl = normalizeApiUrl(config.api_url);
      const response = await fetch(`${apiUrl}/api/v1/workflows`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': config.api_key,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro na conexão: ${response.status} ${response.statusText}`);
      }

      // Atualizar status da conexão
      await (supabase
        .from('n8n_configs' as any)
        .update({
          connection_status: 'connected',
          last_connection_test: new Date().toISOString(),
        } as any)
        .eq('id', config.id));

      queryClient.invalidateQueries({ queryKey: ["n8n-config", activeOrgId] });

      return { success: true, message: "Conexão bem-sucedida!" };
    } catch (error: any) {
      // Atualizar status da conexão
      if (config) {
        await (supabase
          .from('n8n_configs' as any)
          .update({
            connection_status: 'error',
            last_connection_test: new Date().toISOString(),
          } as any)
          .eq('id', config.id));
      }

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

  // Funções para gerenciar workflows
  const listWorkflows = async (): Promise<N8nWorkflow[]> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath('/api/v1/workflows'), {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar workflows: ${response.status}`);
    }

    return response.json();
  };

  const getWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/workflows/${workflowId}`), {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar workflow: ${response.status}`);
    }

    return response.json();
  };

  const createWorkflow = async (workflowData: Partial<N8nWorkflow>): Promise<N8nWorkflow> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath('/api/v1/workflows'), {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao criar workflow: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  const updateWorkflow = async (workflowId: string, workflowData: Partial<N8nWorkflow>): Promise<N8nWorkflow> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/workflows/${workflowId}`), {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao atualizar workflow: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  const deleteWorkflow = async (workflowId: string): Promise<void> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/workflows/${workflowId}`), {
      method: 'DELETE',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar workflow: ${response.status}`);
    }
  };

  const activateWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/workflows/${workflowId}/activate`), {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao ativar workflow: ${response.status}`);
    }

    return response.json();
  };

  const deactivateWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/workflows/${workflowId}/deactivate`), {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao desativar workflow: ${response.status}`);
    }

    return response.json();
  };

  const executeWorkflow = async (workflowId: string, inputData?: any): Promise<N8nWorkflowExecution> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/workflows/${workflowId}/execute`), {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inputData || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao executar workflow: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  const getExecution = async (executionId: string): Promise<N8nWorkflowExecution> => {
    if (!config) throw new Error("Configuração não encontrada");

    const response = await fetch(buildApiPath(`/api/v1/executions/${executionId}`), {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar execução: ${response.status}`);
    }

    return response.json();
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

