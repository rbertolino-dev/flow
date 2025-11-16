import { useCallback, useEffect, useMemo, useState } from "react";
import { Agent, AgentFormValues } from "@/types/agents";
import { AgentManager } from "@/services/agents/AgentManager";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";

export function useAgents() {
  const { toast } = useToast();
  const { organizationId, loading: organizationLoading } = useOrganization();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const result = await AgentManager.listAgents(organizationId);
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
      if (!organizationId) return;
      const agent = await AgentManager.createAgent({
        ...values,
        organization_id: organizationId,
      });
      setAgents((prev) => [agent, ...prev]);
      toast({
        title: "Agente criado",
        description: "Sincronize com a OpenAI para ativar o agente.",
      });
      return agent;
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

