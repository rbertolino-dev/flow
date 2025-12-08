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
    // n8n API retorna diretamente um array de workflows
    // Se vier dentro de um objeto, extrair o array
    if (Array.isArray(response)) {
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (response?.workflows && Array.isArray(response.workflows)) {
      return response.workflows;
    }
    return [];
  };

  const getWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "GET");
  };

  const createWorkflow = async (workflowData: Partial<N8nWorkflow>): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    
    // n8n API não aceita 'active' no POST - é read-only
    const { active, ...rest } = workflowData;
    
    // Gerar UUIDs válidos para nodes se não tiverem
    const ensureNodeIds = (nodes: any[]): any[] => {
      return nodes.map((node, index) => {
        // n8n requer UUIDs válidos no formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        if (!node.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.id)) {
          // Gerar UUID v4 válido
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          node.id = uuid;
        }
        
        // Garantir propriedades obrigatórias
        if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
          node.position = [250 + (index * 300), 300];
        }
        
        if (!node.typeVersion) {
          node.typeVersion = 1;
        }
        
        if (!node.parameters) {
          node.parameters = {};
        }
        
        return node;
      });
    };
    
    // n8n requer pelo menos um node (preferencialmente trigger)
    let nodes = rest.nodes && rest.nodes.length > 0 ? rest.nodes : [];
    
    // Se não tiver nodes, criar um manual trigger padrão
    if (nodes.length === 0) {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      nodes = [{
        id: uuid,
        name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [250, 300],
        parameters: {},
      }];
    } else {
      nodes = ensureNodeIds(nodes);
    }
    
    // Estrutura do payload conforme documentação n8n API
    const payload = {
      name: rest.name || `Workflow ${new Date().toISOString()}`,
      nodes: nodes,
      connections: rest.connections || {},
      settings: rest.settings || {
        executionOrder: "v1",
        saveDataErrorExecution: "all",
        saveDataSuccessExecution: "all",
        saveManualExecutions: true,
        callerPolicy: "workflowsFromSameOwner",
        errorWorkflow: null,
      },
      staticData: rest.staticData || null,
      tags: rest.tags || [],
    };
    
    console.log("[n8n] Creating workflow with payload:", JSON.stringify(payload, null, 2));
    
    const result = await callN8nProxy(activeOrgId, "/api/v1/workflows", "POST", payload);
    
    console.log("[n8n] Workflow created:", result);
    
    return result;
  };

  const updateWorkflow = async (workflowId: string, workflowData: Partial<N8nWorkflow>): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    // Remove read-only 'active' property before update
    const { active, ...rest } = workflowData;
    const payload = {
      settings: { executionOrder: "v1" },
      ...rest,
    };
    return callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "PUT", payload);
  };

  const deleteWorkflow = async (workflowId: string): Promise<void> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    await callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "DELETE");
  };

  const activateWorkflow = async (workflowId: string): Promise<N8nWorkflow> => {
    if (!config || !activeOrgId) throw new Error("Configuração não encontrada");
    
    console.log("[n8n] Fetching workflow before activation:", workflowId);
    
    // First fetch the workflow to check if it has trigger nodes
    const workflow = await callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "GET");
    
    console.log("[n8n] Workflow fetched:", workflow?.name, "Nodes count:", workflow?.nodes?.length);
    
    // Check for ACTIVATABLE trigger nodes (manualTrigger cannot be activated!)
    // Only webhooks, scheduleTrigger, and poller types can be activated
    const activatableTriggerTypes = [
      "n8n-nodes-base.scheduletrigger",
      "n8n-nodes-base.webhook",
      "n8n-nodes-base.cron",
      "poller"
    ];
    
    const hasActivatableTrigger = workflow?.nodes?.some((node: any) => {
      const nodeType = node.type?.toLowerCase() || "";
      const isActivatable = activatableTriggerTypes.some(t => nodeType.includes(t)) ||
        (nodeType.includes("webhook") && !nodeType.includes("manual"));
      const hasValidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.id);
      console.log("[n8n] Node:", node.type, "Activatable:", isActivatable, "Valid ID:", hasValidId);
      return isActivatable && hasValidId;
    });
    
    console.log("[n8n] Has activatable trigger:", hasActivatableTrigger);
    
    // If no activatable trigger, add a scheduleTrigger (runs every hour by default)
    if (!hasActivatableTrigger) {
      console.log("[n8n] Adding scheduleTrigger node for activation");
      
      const uuid = crypto.randomUUID();
      
      // Use scheduleTrigger instead of manualTrigger - it CAN be activated
      const scheduleTriggerNode = {
        parameters: {
          rule: {
            interval: [{ field: "hours", hoursInterval: 1 }]
          }
        },
        id: uuid,
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1.2,
        position: [250, 300],
      };
      
      // Keep existing non-manual-trigger nodes
      const existingNodes = (workflow?.nodes || []).filter((node: any) => {
        return node.type !== "n8n-nodes-base.manualTrigger";
      });
      
      const updatePayload: Record<string, any> = {
        name: workflow?.name || "Workflow",
        nodes: [scheduleTriggerNode, ...existingNodes],
        connections: workflow?.connections || {},
        settings: { executionOrder: "v1" },
      };
      
      console.log("[n8n] Updating workflow with scheduleTrigger");
      
      const updateResult = await callN8nProxy(activeOrgId, `/api/v1/workflows/${workflowId}`, "PUT", updatePayload);
      
      if (!updateResult?.nodes?.some((n: any) => n.id === uuid)) {
        console.error("[n8n] Update verification failed");
        throw new Error("Falha ao adicionar trigger ao workflow");
      }
      
      console.log("[n8n] Workflow updated with scheduleTrigger");
    }
    
    console.log("[n8n] Activating workflow");
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
