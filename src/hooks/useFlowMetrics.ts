import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AutomationFlow } from "@/types/automationFlow";

interface FlowMetrics {
  totalFlows: number;
  activeFlows: number;
  pausedFlows: number;
  draftFlows: number;
  totalExecutions: number;
  runningExecutions: number;
  waitingExecutions: number;
  completedExecutions: number;
  errorExecutions: number;
  averageExecutionTime: number; // em horas
  completionRate: number; // porcentagem
  topFlows: Array<{
    flowId: string;
    flowName: string;
    executionCount: number;
    completionRate: number;
  }>;
}

export function useFlowMetrics() {
  const [metrics, setMetrics] = useState<FlowMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();

    const channel = supabase
      .channel('flow-metrics-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automation_flows',
        },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flow_executions',
        },
        () => fetchMetrics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMetrics = async () => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setMetrics(null);
        setLoading(false);
        return;
      }

      // Buscar fluxos
      const { data: flows, error: flowsError } = await (supabase as any)
        .from('automation_flows')
        .select('id, name, status')
        .eq('organization_id', organizationId);

      if (flowsError) throw flowsError;

      // Buscar execuções
      const { data: executions, error: executionsError } = await (supabase as any)
        .from('flow_executions')
        .select('id, flow_id, status, started_at, completed_at')
        .eq('organization_id', organizationId);

      if (executionsError) throw executionsError;

      // Calcular métricas
      const totalFlows = flows?.length || 0;
      const activeFlows = flows?.filter((f: any) => f.status === 'active').length || 0;
      const pausedFlows = flows?.filter((f: any) => f.status === 'paused').length || 0;
      const draftFlows = flows?.filter((f: any) => f.status === 'draft').length || 0;

      const totalExecutions = executions?.length || 0;
      const runningExecutions = executions?.filter((e: any) => e.status === 'running').length || 0;
      const waitingExecutions = executions?.filter((e: any) => e.status === 'waiting').length || 0;
      const completedExecutions = executions?.filter((e: any) => e.status === 'completed').length || 0;
      const errorExecutions = executions?.filter((e: any) => e.status === 'error').length || 0;

      // Calcular tempo médio de execução
      const completedWithTime = executions?.filter(
        (e: any) => e.status === 'completed' && e.started_at && e.completed_at
      ) || [];

      let averageExecutionTime = 0;
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum: number, e: any) => {
          const start = new Date(e.started_at);
          const end = new Date(e.completed_at);
          return sum + (end.getTime() - start.getTime());
        }, 0);
        averageExecutionTime = totalTime / completedWithTime.length / (1000 * 60 * 60); // em horas
      }

      // Taxa de conclusão
      const completionRate = totalExecutions > 0
        ? (completedExecutions / totalExecutions) * 100
        : 0;

      // Top fluxos por número de execuções
      const flowExecutionCounts = new Map<string, { count: number; completed: number; name: string }>();
      executions?.forEach((exec: any) => {
        const flow = flows?.find((f: any) => f.id === exec.flow_id);
        if (flow) {
          const current = flowExecutionCounts.get(exec.flow_id) || { count: 0, completed: 0, name: flow.name };
          current.count++;
          if (exec.status === 'completed') {
            current.completed++;
          }
          flowExecutionCounts.set(exec.flow_id, current);
        }
      });

      const topFlows = Array.from(flowExecutionCounts.entries())
        .map(([flowId, data]) => ({
          flowId,
          flowName: data.name,
          executionCount: data.count,
          completionRate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
        }))
        .sort((a, b) => b.executionCount - a.executionCount)
        .slice(0, 5);

      setMetrics({
        totalFlows,
        activeFlows,
        pausedFlows,
        draftFlows,
        totalExecutions,
        runningExecutions,
        waitingExecutions,
        completedExecutions,
        errorExecutions,
        averageExecutionTime,
        completionRate,
        topFlows,
      });
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, refetch: fetchMetrics };
}

