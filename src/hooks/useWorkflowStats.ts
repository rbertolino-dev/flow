import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface WorkflowStats {
  total: number;
  active: number;
  paused: number;
  completed: number;
  messagesSentToday: number;
  messagesSentThisWeek: number;
  messagesPending: number;
  messagesFailed: number;
  nextExecutions: number;
}

export function useWorkflowStats() {
  const { activeOrgId } = useActiveOrganization();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["workflow-stats", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<WorkflowStats> => {
      if (!activeOrgId) {
        return {
          total: 0,
          active: 0,
          paused: 0,
          completed: 0,
          messagesSentToday: 0,
          messagesSentThisWeek: 0,
          messagesPending: 0,
          messagesFailed: 0,
          nextExecutions: 0,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Estatísticas de workflows
      const { data: workflows, error: workflowsError } = await supabase
        .from("whatsapp_workflows")
        .select("id, is_active, status")
        .eq("organization_id", activeOrgId);

      if (workflowsError) {
        // Se tabela não existe, retornar zeros ao invés de erro
        if (workflowsError.code === 'PGRST205' || workflowsError.message?.includes('Could not find the table')) {
          console.warn("Tabela whatsapp_workflows não encontrada. Retornando estatísticas zeradas.");
          return {
            total: 0,
            active: 0,
            paused: 0,
            completed: 0,
            messagesSentToday: 0,
            messagesSentThisWeek: 0,
            messagesPending: 0,
            messagesFailed: 0,
            nextExecutions: 0,
          };
        }
        throw workflowsError;
      }

      const total = workflows?.length || 0;
      const active = workflows?.filter((w) => w.is_active).length || 0;
      const paused = workflows?.filter((w) => !w.is_active && w.status !== "completed").length || 0;
      const completed = workflows?.filter((w) => w.status === "completed").length || 0;

      // Estatísticas de mensagens agendadas
      const { count: messagesTodayCount, error: messagesTodayError } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrgId)
        .eq("status", "sent")
        .gte("sent_at", today.toISOString());

      if (messagesTodayError) throw messagesTodayError;

      const { count: messagesWeekCount, error: messagesWeekError } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrgId)
        .eq("status", "sent")
        .gte("sent_at", weekAgo.toISOString());

      if (messagesWeekError) throw messagesWeekError;

      const { count: messagesPendingCount, error: messagesPendingError } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrgId)
        .eq("status", "pending");

      if (messagesPendingError) throw messagesPendingError;

      const { count: messagesFailedCount, error: messagesFailedError } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrgId)
        .eq("status", "failed");

      if (messagesFailedError) throw messagesFailedError;

      // Próximas execuções (mensagens agendadas para o futuro)
      const { count: nextExecutionsCount, error: nextExecutionsError } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrgId)
        .eq("status", "pending")
        .gte("scheduled_for", new Date().toISOString());

      if (nextExecutionsError) throw nextExecutionsError;

      return {
        total,
        active,
        paused,
        completed,
        messagesSentToday: messagesTodayCount || 0,
        messagesSentThisWeek: messagesWeekCount || 0,
        messagesPending: messagesPendingCount || 0,
        messagesFailed: messagesFailedCount || 0,
        nextExecutions: nextExecutionsCount || 0,
      };
    },
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos (otimização de cache)
    refetchInterval: 60000, // Atualizar a cada 60 segundos (reduzido de 30s para economizar)
  });

  return {
    stats: stats || {
      total: 0,
      active: 0,
      paused: 0,
      completed: 0,
      messagesSentToday: 0,
      messagesSentThisWeek: 0,
      messagesPending: 0,
      messagesFailed: 0,
      nextExecutions: 0,
    },
    isLoading,
  };
}

