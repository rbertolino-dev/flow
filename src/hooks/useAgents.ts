import { useCallback, useEffect, useMemo, useState } from "react";
import { Agent, AgentFormValues } from "@/types/agents";
import { AgentManager } from "@/services/agents/AgentManager";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
export function useAgents() {
  const { toast } = useToast();
  const { organizationId, loading: organizationLoading } = useOrganization();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!organizationId) {
      console.log("[useAgents] organizationId ainda não disponível");
      setLoading(false);
      return;
    }
    setLoading(true);
    console.log("[useAgents] Buscando agentes para org:", organizationId);
    try {
      const result = await AgentManager.listAgents(organizationId);
      console.log("[useAgents] Agentes encontrados:", result);
      setAgents(result);
    } catch (error) {
      console.error("[useAgents] Erro ao buscar agentes:", error);
      toast({
        title: "Erro ao carregar agentes",
        description:
          error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    if (organizationId) {
      fetchAgents();
    }
  }, [organizationId, fetchAgents]);

  const createAgent = useCallback(
    async (values: AgentFormValues) => {
      console.log("[useAgents] createAgent iniciado", values);
      let orgId = organizationId;
      if (!orgId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_organization', { _user_id: user.id });
            if (!rpcError && rpcData) {
              orgId = rpcData as string;
              console.log("[useAgents] OrganizationId via RPC:", orgId);
            }
          }
        } catch (e) {
          console.error("[useAgents] Erro ao buscar org via RPC:", e);
        }
      }

      if (!orgId) {
        toast({
          title: "Organização não encontrada",
          description: "Associe-se a uma organização antes de criar agentes.",
          variant: "destructive",
        });
        throw new Error("Sem organizationId");
      }

      try {
        const agent = await AgentManager.createAgent({
          ...values,
          organization_id: orgId,
        });
        console.log("[useAgents] Agente criado com sucesso:", agent);
        
        // Refetch agents to ensure we have the latest data
        await fetchAgents();
        
        toast({
          title: "Agente criado com sucesso",
          description: "Agente criado. Sincronize com OpenAI para ativá-lo.",
        });
        return agent;
      } catch (error) {
        console.error("[useAgents] Erro ao criar agente:", error);
        toast({
          title: "Erro ao criar agente",
          description: error instanceof Error ? error.message : "Falha inesperada.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [organizationId, toast]
  );

  const updateAgent = useCallback(async (agentId: string, values: AgentFormValues) => {
    const agent = await AgentManager.updateAgent(agentId, {
      ...values,
      version: (agents.find((a) => a.id === agentId)?.version || 1) + 1,
    });
    setAgents((prev) =>
      prev.map((item) => (item.id === agentId ? agent : item))
    );
    toast({
      title: "Agente atualizado",
      description: "As alterações foram salvas e versionadas.",
    });
    return agent;
  }, [agents, toast]);

  const syncAgent = useCallback(
    async (agentId: string, target: "openai" | "evolution") => {
      if (target === "openai") {
        await AgentManager.syncWithOpenAI(agentId);
      } else {
        await AgentManager.syncWithEvolution(agentId);
      }
      toast({
        title: `Sincronização com ${target === "openai" ? "OpenAI" : "Evolution"} concluída`,
        description: "O agente está pronto para uso.",
      });
      await fetchAgents();
    },
    [fetchAgents, toast]
  );

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((agent) => agent.status === "active").length;
    const drafts = agents.filter((agent) => agent.status === "draft").length;
    return { total, active, drafts };
  }, [agents]);

  return {
    agents,
    stats,
    loading: loading || organizationLoading,
    selectedAgent,
    setSelectedAgent,
    createAgent,
    updateAgent,
    syncAgent,
    refetch: fetchAgents,
  };
}

