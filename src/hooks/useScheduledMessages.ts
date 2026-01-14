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
  // Campos de repetição
  repeat_enabled?: boolean | null;
  repeat_period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  repeat_count?: number | null;
  repeat_until?: string | null;
  original_scheduled_date?: string | null;
  // Campos de combo
  parent_message_id?: string | null;
  is_combo_message?: boolean | null;
  combo_delay_days?: number | null;
  // Campos de cancelamento
  cancel_reason?: string | null;
  cancelled_at?: string | null;
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
      // Campos de repetição
      repeatEnabled?: boolean;
      repeatPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly';
      repeatCount?: number;
      // Campos de combo
      isCombo?: boolean;
      comboMessage?: string;
      comboDelayDays?: number;
      comboMediaUrl?: string;
      comboMediaType?: 'image' | 'video' | 'document';
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Obter organization_id
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Organização não encontrada');

      const originalDate = params.scheduledFor;
      const originalDateOnly = new Date(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate());

      // Criar primeira mensagem
      const firstMessageData: any = {
        organization_id: organizationId,
        user_id: user.id,
        lead_id: params.leadId,
        instance_id: params.instanceId,
        phone: params.phone,
        message: params.message,
        scheduled_for: params.scheduledFor.toISOString(),
        media_url: params.mediaUrl || null,
        media_type: params.mediaType || null,
        repeat_enabled: params.repeatEnabled || false,
        repeat_period: params.repeatPeriod || null,
        repeat_count: params.repeatCount || null,
        original_scheduled_date: originalDateOnly.toISOString().split('T')[0],
      };

      const { data: firstMessage, error: firstError } = await supabase
        .from('scheduled_messages')
        .insert(firstMessageData)
        .select()
        .single();

      if (firstError) throw firstError;

      let parentMessageId = firstMessage.id;

      // Se repetição está habilitada, criar mensagens repetidas
      if (params.repeatEnabled && params.repeatPeriod && params.repeatCount) {
        const repeatMessages: any[] = [];
        const repeatCount = Math.min(params.repeatCount, 100); // Limitar a 100 repetições

        for (let i = 1; i <= repeatCount; i++) {
          let nextDate = new Date(originalDate);
          
          switch (params.repeatPeriod) {
            case 'daily':
              nextDate.setDate(nextDate.getDate() + i);
              break;
            case 'weekly':
              nextDate.setDate(nextDate.getDate() + (i * 7));
              break;
            case 'monthly':
              // Repetir sempre no mesmo dia do mês
              nextDate.setMonth(nextDate.getMonth() + i);
              // Garantir que o dia não ultrapasse o último dia do mês
              const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
              if (originalDate.getDate() > lastDayOfMonth) {
                nextDate.setDate(lastDayOfMonth);
              } else {
                nextDate.setDate(originalDate.getDate());
              }
              break;
            case 'yearly':
              nextDate.setFullYear(nextDate.getFullYear() + i);
              break;
          }

          repeatMessages.push({
            organization_id: organizationId,
            user_id: user.id,
            lead_id: params.leadId,
            instance_id: params.instanceId,
            phone: params.phone,
            message: params.message,
            scheduled_for: nextDate.toISOString(),
            media_url: params.mediaUrl || null,
            media_type: params.mediaType || null,
            repeat_enabled: false, // Mensagens repetidas não repetem novamente
            original_scheduled_date: originalDateOnly.toISOString().split('T')[0],
            parent_message_id: parentMessageId, // Todas apontam para a primeira
          });
        }

        if (repeatMessages.length > 0) {
          const { error: repeatError } = await supabase
            .from('scheduled_messages')
            .insert(repeatMessages);

          if (repeatError) {
            console.error('Erro ao criar mensagens repetidas:', repeatError);
            // Não falhar completamente, apenas logar o erro
          }
        }
      }

      // Se combo está habilitado, criar segunda mensagem
      if (params.isCombo && params.comboMessage && params.comboDelayDays) {
        const comboDate = new Date(originalDate);
        comboDate.setDate(comboDate.getDate() + params.comboDelayDays);

        const comboMessageData: any = {
          organization_id: organizationId,
          user_id: user.id,
          lead_id: params.leadId,
          instance_id: params.instanceId,
          phone: params.phone,
          message: params.comboMessage,
          scheduled_for: comboDate.toISOString(),
          media_url: params.comboMediaUrl || null,
          media_type: params.comboMediaType || null,
          is_combo_message: true,
          parent_message_id: parentMessageId,
          combo_delay_days: params.comboDelayDays,
        };

        const { error: comboError } = await supabase
          .from('scheduled_messages')
          .insert(comboMessageData);

        if (comboError) {
          console.error('Erro ao criar mensagem combo:', comboError);
          // Não falhar completamente, apenas logar o erro
        }
      }

      return firstMessage;
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
    mutationFn: async (params: { messageId: string; reason?: string }) => {
      const updateData: any = {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      };

      if (params.reason) {
        updateData.cancel_reason = params.reason;
      }

      // Cancelar mensagem principal
      const { error } = await supabase
        .from('scheduled_messages')
        .update(updateData)
        .eq('id', params.messageId);

      if (error) throw error;

      // Se a mensagem tem mensagens filhas (repetições ou combo), cancelar todas também
      const { data: children } = await supabase
        .from('scheduled_messages')
        .select('id')
        .or(`parent_message_id.eq.${params.messageId},id.eq.${params.messageId}`)
        .eq('status', 'pending');

      if (children && children.length > 0) {
        const childIds = children
          .filter(c => c.id !== params.messageId)
          .map(c => c.id);

        if (childIds.length > 0) {
          await supabase
            .from('scheduled_messages')
            .update(updateData)
            .in('id', childIds);
        }
      }
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
    cancelScheduledMessage: (messageId: string, reason?: string) => 
      cancelScheduledMessage.mutateAsync({ messageId, reason }),
    deleteScheduledMessage: deleteScheduledMessage.mutateAsync,
  };
}