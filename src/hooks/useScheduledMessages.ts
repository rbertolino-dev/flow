import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";


export interface ScheduledMessage {
  id: string;
  user_id: string;
  lead_id: string;
  instance_id: string;
  phone: string;
  message: string;
  media_url?: string | null;
  media_type?: string | null;
  scheduled_for: string;
  sent_at?: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export function useScheduledMessages(leadId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduledMessages = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages', leadId],
    queryFn: async () => {
      // Filtrar pela organização ativa
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return [];

      let query = supabase
        .from('scheduled_messages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('scheduled_for', { ascending: true });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ScheduledMessage[];
    },
    enabled: !!leadId,
  });

  const scheduleMessage = useMutation({
    mutationFn: async (params: {
      leadId: string;
      instanceId: string;
      phone: string;
      message: string;
      scheduledFor: Date;
      mediaUrl?: string;
      mediaType?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          lead_id: params.leadId,
          instance_id: params.instanceId,
          phone: params.phone,
          message: params.message,
          scheduled_for: params.scheduledFor.toISOString(),
          media_url: params.mediaUrl || null,
          media_type: params.mediaType || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "Mensagem agendada",
        description: "A mensagem será enviada no horário programado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao agendar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelScheduledMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled' })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "Mensagem cancelada",
        description: "O agendamento foi cancelado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteScheduledMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "Mensagem excluída",
        description: "O agendamento foi removido",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    scheduledMessages,
    isLoading,
    scheduleMessage: scheduleMessage.mutateAsync,
    cancelScheduledMessage: cancelScheduledMessage.mutateAsync,
    deleteScheduledMessage: deleteScheduledMessage.mutateAsync,
  };
}