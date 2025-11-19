import { supabase } from "@/integrations/supabase/client";
import type {
  Agent,
  AgentUsageMetric,
  AgentVersion,
  CreateAgentPayload,
  UpdateAgentPayload,
} from "@/types/agents";

type SyncTarget = "openai" | "evolution";

const invokeAgentSync = async (agentId: string, target: SyncTarget) => {
  const functionName =
    target === "openai" ? "agents-sync-openai" : "agents-sync-evolution";

  console.log(`🔷🔷🔷 [AgentManager] Invocando Edge Function: ${functionName}`);
  console.log(`📋 [AgentManager] AgentId:`, agentId);

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { agent_id: agentId },
    });

    console.log(`📦 [AgentManager] Resposta bruta do Supabase:`, { data, error });

    // Verificar erro retornado pelo Supabase client
    if (error) {
      console.error(`❌ [AgentManager] Erro do Supabase client ao invocar ${functionName}:`, error);
      console.error(`📋 [AgentManager] Error completo:`, JSON.stringify(error, null, 2));
      
      // Tentar capturar o corpo da resposta HTTP diretamente
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/${functionName}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ agent_id: agentId }),
            }
          );
          
          const responseText = await response.text();
          console.error(`📄 [AgentManager] Corpo da resposta HTTP (${response.status}):`, responseText);
          
          let errorMessage = error.message || `Falha ao sincronizar agente (${target}).`;
          
          // Tentar parsear o JSON da resposta
          try {
            const responseJson = JSON.parse(responseText);
            if (responseJson.error) {
              errorMessage = typeof responseJson.error === 'string' 
                ? responseJson.error 
                : JSON.stringify(responseJson.error);
            }
          } catch (e) {
            // Se não for JSON, usar o texto da resposta
            if (responseText) {
              errorMessage = `${errorMessage}\n\nDetalhes: ${responseText}`;
            }
          }
          
          throw new Error(errorMessage);
        } else {
          throw new Error(
            error.message || `Falha ao sincronizar agente (${target}).`
          );
        }
      } catch (fetchError) {
        console.error(`❌ [AgentManager] Erro ao capturar corpo da resposta:`, fetchError);
        throw fetchError instanceof Error ? fetchError : new Error(
          error.message || `Falha ao sincronizar agente (${target}).`
        );
      }
    }

    // Verificar se o Edge Function retornou erro no corpo da resposta
    if (data && typeof data === 'object' && 'error' in data) {
      console.error(`❌ [AgentManager] Erro retornado pelo Edge Function ${functionName}:`, data.error);
      console.error(`📋 [AgentManager] Data completo:`, JSON.stringify(data, null, 2));
      throw new Error(
        typeof data.error === 'string' ? data.error : `Falha ao sincronizar agente (${target}).`
      );
    }

    console.log(`✅ [AgentManager] Sincronização ${target} bem-sucedida!`);
    console.log(`📊 [AgentManager] Data retornado:`, JSON.stringify(data, null, 2));

    return data;
  } catch (err) {
    console.error(`❌❌❌ [AgentManager] Erro capturado no invokeAgentSync:`, err);
    throw err;
  }
};

export const AgentManager = {
  async listAgents(organizationId: string): Promise<Agent[]> {
    const { data, error } = await (supabase as any)
      .from("agents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return (data || []) as Agent[];
  },

  async getAgent(agentId: string): Promise<Agent | null> {
    const { data, error } = await (supabase as any)
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as Agent) || null;
  },

  async createAgent(payload: CreateAgentPayload): Promise<Agent> {
    // VALIDAÇÃO OBRIGATÓRIA: Garantir que response_format sempre tenha valor válido
    const validatedPayload = {
      ...payload,
      response_format: payload.response_format && (payload.response_format === 'text' || payload.response_format === 'json')
        ? payload.response_format
        : 'text', // Sempre garantir valor padrão
      metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : null,
    };
    
    console.log("💾 [AgentManager.createAgent] Payload validado:", {
      response_format: validatedPayload.response_format,
      split_messages: validatedPayload.split_messages,
    });
    
    const { data, error } = await (supabase as any)
      .from("agents")
      .insert(validatedPayload)
      .select()
      .single();

    if (error) {
      console.error("❌ [AgentManager.createAgent] Erro ao inserir:", error);
      throw new Error(error.message);
    }

    console.log("✅ [AgentManager.createAgent] Agente inserido com sucesso:", {
      id: data.id,
      response_format: data.response_format,
      split_messages: data.split_messages,
    });

    await this.saveVersionSnapshot(data.id, 1, "Criação inicial");

    return data as Agent;
  },

  async updateAgent(agentId: string, payload: UpdateAgentPayload) {
    // VALIDAÇÃO OBRIGATÓRIA: Garantir que response_format sempre tenha valor válido
    const validatedPayload: any = {
      ...payload,
      response_format: payload.response_format && (payload.response_format === 'text' || payload.response_format === 'json')
        ? payload.response_format
        : 'text', // Sempre garantir valor padrão
      metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : undefined,
    };
    
    console.log("💾 [AgentManager.updateAgent] Payload validado:", {
      agentId,
      response_format: validatedPayload.response_format,
      split_messages: validatedPayload.split_messages,
    });
    
    const { data, error } = await (supabase as any)
      .from("agents")
      .update(validatedPayload)
      .eq("id", agentId)
      .select()
      .single();

    if (error) {
      console.error("❌ [AgentManager.updateAgent] Erro ao atualizar:", error);
      throw new Error(error.message);
    }

    console.log("✅ [AgentManager.updateAgent] Agente atualizado com sucesso:", {
      id: data.id,
      response_format: data.response_format,
      split_messages: data.split_messages,
    });

    if (payload.version) {
      await this.saveVersionSnapshot(
        agentId,
        payload.version,
        "Atualização de configuração"
      );
    }

    return data as Agent;
  },

  async saveVersionSnapshot(
    agentId: string,
    version: number,
    summary?: string
  ) {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    const snapshot = {
      ...agent,
      created_at: undefined,
      updated_at: undefined,
      openai_assistant_id: agent.openai_assistant_id,
    };

    const { error } = await (supabase as any).from("agent_versions").insert({
      agent_id: agentId,
      version,
      snapshot,
      change_summary: summary || null,
    });

    if (error) {
      console.warn("[AgentManager] Falha ao salvar snapshot:", error.message);
    }
  },

  async logUsage(
    agentId: string,
    metric: Omit<AgentUsageMetric, "id" | "created_at" | "agent_id">
  ) {
    const { error } = await (supabase as any).from("agent_usage_metrics").upsert({
      agent_id: agentId,
      metric_date: metric.metric_date,
      prompt_tokens: metric.prompt_tokens || 0,
      completion_tokens: metric.completion_tokens || 0,
      total_requests: metric.total_requests || 0,
      total_cost: metric.total_cost || 0,
      metadata: metric.metadata ? JSON.parse(JSON.stringify(metric.metadata)) : null,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async syncWithOpenAI(agentId: string) {
    return invokeAgentSync(agentId, "openai");
  },

  async syncWithEvolution(agentId: string) {
    return invokeAgentSync(agentId, "evolution");
  },

  async deleteAgent(agentId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from("agents")
      .delete()
      .eq("id", agentId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async listVersions(agentId: string): Promise<AgentVersion[]> {
    const { data, error } = await (supabase as any)
      .from("agent_versions")
      .select("*")
      .eq("agent_id", agentId)
      .order("version", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return (data || []) as AgentVersion[];
  },
};

