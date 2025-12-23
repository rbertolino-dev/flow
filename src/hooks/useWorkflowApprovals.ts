import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { WorkflowApproval, ApprovalStatus } from "@/types/workflows";

export function useWorkflowApprovals(workflowId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const approvalsQuery = useQuery({
    queryKey: ["workflow-approvals", workflowId, activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];

      const query = supabase
        .from("whatsapp_workflow_approvals")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("approval_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (workflowId) {
        query.eq("workflow_id", workflowId);
      }

      const { data, error } = await query;

      if (error) {
        // Se tabela não existe, retornar array vazio ao invés de erro
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          console.warn("Tabela whatsapp_workflow_approvals não encontrada. Retornando array vazio.");
          return [];
        }
        console.error("Erro ao buscar aprovações", error);
        throw error;
      }

      return (data || []) as WorkflowApproval[];
    },
  });

  const pendingApprovalsQuery = useQuery({
    queryKey: ["workflow-approvals-pending", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("whatsapp_workflow_approvals")
        .select(
          `
          *,
          workflow:whatsapp_workflows(id, name),
          lead:leads(id, name, phone)
        `,
        )
        .eq("organization_id", activeOrgId)
        .eq("status", "pending")
        .order("approval_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        // Se tabela não existe, retornar array vazio ao invés de erro
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          console.warn("Tabela whatsapp_workflow_approvals não encontrada. Retornando array vazio.");
          return [];
        }
        console.error("Erro ao buscar aprovações pendentes", error);
        throw error;
      }

      return (data || []) as WorkflowApproval[];
    },
  });

  const updateApprovalStatus = useMutation({
    mutationFn: async ({
      approvalId,
      status,
      rejectionReason,
    }: {
      approvalId: string;
      status: ApprovalStatus;
      rejectionReason?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "approved") {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }

      if (status === "rejected" && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from("whatsapp_workflow_approvals")
        .update(updateData)
        .eq("id", approvalId);

      if (error) throw error;

      // Atualizar status do scheduled_message se existir
      const { data: approval } = await supabase
        .from("whatsapp_workflow_approvals")
        .select("scheduled_message_id")
        .eq("id", approvalId)
        .single();

      if (approval?.scheduled_message_id) {
        await supabase
          .from("scheduled_messages")
          .update({
            approval_status: status,
          })
          .eq("id", approval.scheduled_message_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-approvals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["scheduled-messages"],
      });
      toast({
        title: "Status atualizado",
        description: `Aprovação ${status === "approved" ? "aprovada" : status === "rejected" ? "rejeitada" : "atualizada"} com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar aprovação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    approvals: approvalsQuery.data || [],
    pendingApprovals: pendingApprovalsQuery.data || [],
    isLoading: approvalsQuery.isLoading || pendingApprovalsQuery.isLoading,
    updateApprovalStatus: updateApprovalStatus.mutateAsync,
    refetch: () => {
      approvalsQuery.refetch();
      pendingApprovalsQuery.refetch();
    },
  };
}

