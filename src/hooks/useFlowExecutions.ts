import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { FlowExecution } from "@/types/automationFlow";

interface FlowExecutionWithRelations extends FlowExecution {
  leads?: { id: string; name: string; phone: string };
  automation_flows?: { id: string; name: string };
}

export function useFlowExecutions(flowId?: string) {
  const [executions, setExecutions] = useState<FlowExecutionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchExecutions();

    const channel = supabase
      .channel('flow-executions-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flow_executions',
          filter: flowId ? `flow_id=eq.${flowId}` : undefined,
        },
        () => {
          fetchExecutions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flowId]);

  const fetchExecutions = async () => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setExecutions([]);
        setLoading(false);
        return;
      }

      let query = (supabase as any)
        .from('flow_executions')
        .select(`
          *,
          leads(id, name, phone),
          automation_flows(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('started_at', { ascending: false });

      if (flowId) {
        query = query.eq('flow_id', flowId);
      }

      const { data: executionsData, error: executionsError } = await query;

      if (executionsError) throw executionsError;

      const formattedExecutions: FlowExecutionWithRelations[] = (executionsData || []).map((exec: any) => ({
        id: exec.id,
        flowId: exec.flow_id,
        leadId: exec.lead_id,
        organizationId: exec.organization_id,
        currentNodeId: exec.current_node_id || undefined,
        status: exec.status,
        executionData: exec.execution_data || {},
        startedAt: new Date(exec.started_at),
        completedAt: exec.completed_at ? new Date(exec.completed_at) : undefined,
        nextExecutionAt: exec.next_execution_at ? new Date(exec.next_execution_at) : undefined,
        createdBy: exec.created_by || undefined,
        leads: exec.leads,
        automation_flows: exec.automation_flows,
      }));

      setExecutions(formattedExecutions);
    } catch (error: any) {
      console.error("Erro ao carregar execuções:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar execuções de fluxo.",
        variant: "destructive",
      });
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const pauseExecution = async (executionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('flow_executions')
        .update({ status: 'paused' })
        .eq('id', executionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Execução pausada.",
      });

      await fetchExecutions();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const resumeExecution = async (executionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('flow_executions')
        .update({ status: 'running' })
        .eq('id', executionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Execução retomada.",
      });

      await fetchExecutions();
      
      // Reprocessar execução será feito automaticamente pelo scheduler
      // ou pode ser acionado manualmente se necessário

      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const cancelExecution = async (executionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('flow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Execução cancelada.",
      });

      await fetchExecutions();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    executions,
    loading,
    fetchExecutions,
    pauseExecution,
    resumeExecution,
    cancelExecution,
  };
}

