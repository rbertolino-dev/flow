import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface WorkflowExecution {
  id: string;
  workflow_id: string | null;
  workflow_name?: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  phone: string;
  message: string;
  error_message: string | null;
  lead_id: string | null;
  lead_name?: string;
  created_at: string;
}

export function useWorkflowExecutionHistory(workflowId?: string, limit: number = 50) {
  const { activeOrgId } = useActiveOrganization();

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ["workflow-execution-history", activeOrgId, workflowId, limit],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<WorkflowExecution[]> => {
      if (!activeOrgId) return [];

      let query = supabase
        .from("scheduled_messages")
        .select(`
          id,
          workflow_id,
          scheduled_for,
          sent_at,
          status,
          phone,
          message,
          error_message,
          lead_id,
          created_at,
          workflows:workflow_id (
            name
          ),
          leads:lead_id (
            name
          )
        `)
        .eq("organization_id", activeOrgId)
        .order("scheduled_for", { ascending: false })
        .limit(limit);

      if (workflowId) {
        query = query.eq("workflow_id", workflowId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        workflow_id: item.workflow_id,
        workflow_name: item.workflows?.name || null,
        scheduled_for: item.scheduled_for,
        sent_at: item.sent_at,
        status: item.status,
        phone: item.phone,
        message: item.message,
        error_message: item.error_message,
        lead_id: item.lead_id,
        lead_name: item.leads?.name || null,
        created_at: item.created_at,
      }));
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });

  return {
    executions,
    isLoading,
  };
}

