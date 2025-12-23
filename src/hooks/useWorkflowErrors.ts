import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface WorkflowError {
  id: string;
  workflow_id: string | null;
  workflow_name?: string;
  scheduled_for: string;
  status: string;
  error_message: string;
  phone: string;
  message: string;
  lead_id: string | null;
  lead_name?: string;
  created_at: string;
}

export function useWorkflowErrors(limit: number = 50) {
  const { activeOrgId } = useActiveOrganization();

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["workflow-errors", activeOrgId, limit],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<WorkflowError[]> => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("scheduled_messages")
        .select(`
          id,
          workflow_id,
          scheduled_for,
          status,
          error_message,
          phone,
          message,
          lead_id,
          created_at,
          workflow:whatsapp_workflows!left(
            name
          ),
          lead:leads!left(
            name
          )
        `)
        .eq("organization_id", activeOrgId)
        .eq("status", "failed")
        .not("error_message", "is", null)
        .order("scheduled_for", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        workflow_id: item.workflow_id,
        workflow_name: item.workflow?.name || null,
        scheduled_for: item.scheduled_for,
        status: item.status,
        error_message: item.error_message || "Erro desconhecido",
        phone: item.phone,
        message: item.message,
        lead_id: item.lead_id,
        lead_name: item.lead?.name || null,
        created_at: item.created_at,
      }));
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });

  return {
    errors,
    isLoading,
  };
}



