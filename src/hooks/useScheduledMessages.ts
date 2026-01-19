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
      repeatDuration?: number; // Duração em dias/semanas/meses/anos dependendo do período
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

      // Calcular data final para repeat_until
      let repeatUntil: string | null = null;
      if (params.repeatEnabled && params.repeatPeriod && params.repeatDuration) {
        const endDate = new Date(originalDate);
        switch (params.repeatPeriod) {
          case 'daily':
            endDate.setDate(endDate.getDate() + (params.repeatDuration || 0));
            break;
          case 'weekly':
            endDate.setDate(endDate.getDate() + ((params.repeatDuration || 0) * 7));
            break;
          case 'monthly':
            endDate.setMonth(endDate.getMonth() + (params.repeatDuration || 0));
            break;
          case 'yearly':
            endDate.setFullYear(endDate.getFullYear() + (params.repeatDuration || 0));
            break;
        }
        repeatUntil = endDate.toISOString();
      }

      // ✅ DEBUG: Validar data/hora antes de inserir
      if (params.scheduledFor <= new Date()) {
        throw new Error('A data e hora de agendamento deve ser no futuro');
      }

      // ✅ DEBUG: Validar telefone (deve ter apenas números)
      const cleanPhone = params.phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        throw new Error('Telefone inválido. Deve conter pelo menos 10 dígitos');
      }

      // ✅ DEBUG: Log dados antes de inserir
      console.log('📅 Agendando mensagem:', {
        organizationId,
        userId: user.id,
        leadId: params.leadId,
        instanceId: params.instanceId,
        phone: cleanPhone,
        scheduledFor: params.scheduledFor.toISOString(),
        messageLength: params.message.length,
      });

      // ✅ SEGUIR MESMA LÓGICA DO MÓDULO DE DISPARO (que funciona)
      // Inserir primeiro com campos básicos (igual ao que funciona)
      const firstMessageData: any = {
          organization_id: organizationId,
          user_id: user.id,
          lead_id: params.leadId,
          instance_id: params.instanceId,
          phone: cleanPhone, // ✅ Usar telefone limpo
          message: params.message,
          scheduled_for: params.scheduledFor.toISOString(),
          status: 'pending', // ✅ Explícito (igual ao que funciona)
          media_url: params.mediaUrl || null,
          media_type: params.mediaType || null,
      };

      // ✅ Adicionar campos de repetição apenas se habilitado
      if (params.repeatEnabled) {
        firstMessageData.repeat_enabled = true;
        firstMessageData.repeat_period = params.repeatPeriod || null;
        firstMessageData.repeat_until = repeatUntil;
        firstMessageData.original_scheduled_date = originalDateOnly.toISOString().split('T')[0];
      }

      const { data: firstMessage, error: firstError } = await supabase
        .from('scheduled_messages')
        .insert(firstMessageData)
        .select()
        .single();

      if (firstError) {
        // ✅ DEBUG: Log erro detalhado
        console.error('❌ Erro ao agendar mensagem:', {
          error: firstError,
          code: firstError.code,
          message: firstError.message,
          details: firstError.details,
          hint: firstError.hint,
          data: firstMessageData,
        });
        throw firstError;
      }

      let parentMessageId = firstMessage.id;

      // Se repetição está habilitada, criar mensagens repetidas baseado na duração
      if (params.repeatEnabled && params.repeatPeriod && params.repeatDuration) {
        const repeatMessages: any[] = [];
        const duration = params.repeatDuration;
        let currentDate = new Date(originalDate);
        const endDate = new Date(originalDate);
        
        // Calcular data final baseado no período e duração
        switch (params.repeatPeriod) {
          case 'daily':
            endDate.setDate(endDate.getDate() + duration);
            break;
          case 'weekly':
            endDate.setDate(endDate.getDate() + (duration * 7));
            break;
          case 'monthly':
            endDate.setMonth(endDate.getMonth() + duration);
            break;
          case 'yearly':
            endDate.setFullYear(endDate.getFullYear() + duration);
            break;
        }

        // Calcular quantas repetições serão criadas (limitar a 1000 para segurança)
        let iteration = 0;
        const maxIterations = 1000;
        
        while (currentDate < endDate && iteration < maxIterations) {
          iteration++;
          
          // Avançar para próxima data baseado no período
          switch (params.repeatPeriod) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'monthly':
              // Repetir sempre no mesmo dia do mês
              currentDate.setMonth(currentDate.getMonth() + 1);
              // Garantir que o dia não ultrapasse o último dia do mês
              const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
              if (originalDate.getDate() > lastDayOfMonth) {
                currentDate.setDate(lastDayOfMonth);
              } else {
                currentDate.setDate(originalDate.getDate());
              }
              break;
            case 'yearly':
              currentDate.setFullYear(currentDate.getFullYear() + 1);
              break;
          }

          // Se ainda não passou da data final, criar mensagem
          if (currentDate < endDate) {
            repeatMessages.push({
              organization_id: organizationId,
              user_id: user.id,
              lead_id: params.leadId,
              instance_id: params.instanceId,
              phone: params.phone,
              message: params.message,
              scheduled_for: new Date(currentDate).toISOString(),
              media_url: params.mediaUrl || null,
              media_type: params.mediaType || null,
              repeat_enabled: false, // Mensagens repetidas não repetem novamente
              original_scheduled_date: originalDateOnly.toISOString().split('T')[0],
              parent_message_id: parentMessageId, // Todas apontam para a primeira
            });
          }
        }

        // ✅ Atualizar repeat_count na primeira mensagem com o número real de repetições
        if (repeatMessages.length > 0) {
          const { error: updateCountError } = await supabase
            .from('scheduled_messages')
            .update({ repeat_count: repeatMessages.length })
            .eq('id', parentMessageId);
          
          if (updateCountError) {
            console.warn('⚠️ Erro ao atualizar repeat_count:', updateCountError);
            // Não falhar completamente, apenas logar
          }
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
      // ✅ DEBUG: Log erro completo
      console.error('❌ Erro ao agendar mensagem (onError):', error);
      
      // ✅ Melhorar mensagem de erro baseada no tipo
      let errorMessage = error.message || 'Erro desconhecido ao agendar mensagem';
      
      // Erros comuns e suas mensagens amigáveis
      if (error.code === '23503') {
        errorMessage = 'Erro de referência: Verifique se o lead, instância ou organização são válidos';
      } else if (error.code === '23505') {
        errorMessage = 'Mensagem duplicada: Esta mensagem já foi agendada';
      } else if (error.code === '42501') {
        errorMessage = 'Permissão negada: Você não tem permissão para agendar mensagens nesta organização';
      } else if (error.message?.includes('organization')) {
        errorMessage = 'Erro de organização: Verifique se você pertence à organização do lead';
      } else if (error.message?.includes('RLS') || error.message?.includes('policy')) {
        errorMessage = 'Erro de permissão: Verifique se você tem permissão para agendar mensagens';
      } else if (error.message?.includes('futuro') || error.message?.includes('future')) {
        errorMessage = 'Data inválida: A data de agendamento deve ser no futuro';
      } else if (error.message?.includes('telefone') || error.message?.includes('phone')) {
        errorMessage = 'Telefone inválido: Verifique o número do telefone';
      }
      
      toast({
        title: "Erro ao agendar mensagem",
        description: errorMessage,
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