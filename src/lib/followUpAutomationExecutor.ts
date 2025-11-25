import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AutomationActionType } from "@/types/followUp";

interface ExecuteAutomationParams {
  leadId: string;
  stepId: string;
  actionType: AutomationActionType;
  actionConfig: Record<string, any>;
}

export async function executeFollowUpAutomation({
  leadId,
  stepId,
  actionType,
  actionConfig,
}: ExecuteAutomationParams): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("Usuário não autenticado");
      return false;
    }

    const organizationId = await getUserOrganizationId();
    if (!organizationId) {
      console.error("Organização não encontrada");
      return false;
    }

    // Buscar dados do lead
    const { data: lead, error: leadError } = await (supabase as any)
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error("Erro ao buscar lead:", leadError);
      return false;
    }

    switch (actionType) {
      case 'send_whatsapp':
        if (!actionConfig.message || !actionConfig.instance_id) {
          console.error("Configuração inválida para send_whatsapp");
          return false;
        }

        // Chamar função edge para enviar mensagem
        const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            instance_id: actionConfig.instance_id,
            phone: lead.phone,
            message: actionConfig.message,
            lead_id: leadId,
          },
        });

        if (whatsappError) {
          console.error("Erro ao enviar WhatsApp:", whatsappError);
          return false;
        }
        break;

      case 'add_tag':
        if (!actionConfig.tag_id) {
          console.error("Configuração inválida para add_tag");
          return false;
        }

        // Verificar se tag já existe
        const { data: existingTag } = await (supabase as any)
          .from('lead_tags')
          .select('id')
          .eq('lead_id', leadId)
          .eq('tag_id', actionConfig.tag_id)
          .maybeSingle();

        if (!existingTag) {
          const { error: tagError } = await (supabase as any)
            .from('lead_tags')
            .insert({
              lead_id: leadId,
              tag_id: actionConfig.tag_id,
            });

          if (tagError) {
            console.error("Erro ao adicionar tag:", tagError);
            return false;
          }
        }
        break;

      case 'move_stage':
        if (!actionConfig.stage_id) {
          console.error("Configuração inválida para move_stage");
          return false;
        }

        const { error: stageError } = await (supabase as any)
          .from('leads')
          .update({
            stage_id: actionConfig.stage_id,
            last_contact: new Date().toISOString(),
          })
          .eq('id', leadId);

        if (stageError) {
          console.error("Erro ao mover lead:", stageError);
          return false;
        }

        // Criar atividade
        await (supabase as any)
          .from('activities')
          .insert({
            lead_id: leadId,
            organization_id: organizationId,
            type: 'status_change',
            content: 'Lead movido automaticamente pelo follow-up',
            user_name: 'Sistema',
          });
        break;

      case 'add_note':
        if (!actionConfig.content) {
          console.error("Configuração inválida para add_note");
          return false;
        }

        const { error: noteError } = await (supabase as any)
          .from('activities')
          .insert({
            lead_id: leadId,
            organization_id: organizationId,
            type: 'note',
            content: actionConfig.content,
            user_name: user.email || 'Sistema',
          });

        if (noteError) {
          console.error("Erro ao adicionar nota:", noteError);
          return false;
        }
        break;

      case 'add_to_call_queue':
        // Verificar se já está na fila
        const { data: existingQueue } = await (supabase as any)
          .from('call_queue')
          .select('id')
          .eq('lead_id', leadId)
          .eq('status', 'pending')
          .maybeSingle();

        if (!existingQueue) {
          const scheduledFor = new Date();
          scheduledFor.setHours(scheduledFor.getHours() + 1); // Agendar para 1 hora depois

          const { error: queueError } = await (supabase as any)
            .from('call_queue')
            .insert({
              lead_id: leadId,
              scheduled_for: scheduledFor.toISOString(),
              priority: actionConfig.priority || 'medium',
              notes: actionConfig.notes || null,
              status: 'pending',
            });

          if (queueError) {
            console.error("Erro ao adicionar à fila:", queueError);
            return false;
          }
        }
        break;

      case 'send_whatsapp_template':
        if (!actionConfig.template_id || !actionConfig.instance_id) {
          console.error("Configuração inválida para send_whatsapp_template");
          return false;
        }

        // Buscar template de mensagem
        const { data: messageTemplate, error: templateError } = await (supabase as any)
          .from('message_templates')
          .select('*')
          .eq('id', actionConfig.template_id)
          .single();

        if (templateError || !messageTemplate) {
          console.error("Erro ao buscar template:", templateError);
          return false;
        }

        // Aplicar variáveis do lead no template
        let messageContent = messageTemplate.content;
        messageContent = messageContent.replace(/{nome}/g, lead.name || '');
        messageContent = messageContent.replace(/{telefone}/g, lead.phone || '');
        messageContent = messageContent.replace(/{email}/g, lead.email || '');
        messageContent = messageContent.replace(/{empresa}/g, lead.company || '');

        // Chamar função edge para enviar mensagem
        const { error: templateWhatsappError } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            instance_id: actionConfig.instance_id,
            phone: lead.phone,
            message: messageContent,
            lead_id: leadId,
          },
        });

        if (templateWhatsappError) {
          console.error("Erro ao enviar WhatsApp com template:", templateWhatsappError);
          return false;
        }
        break;

      case 'remove_tag':
        if (!actionConfig.tag_id) {
          console.error("Configuração inválida para remove_tag");
          return false;
        }

        const { error: removeTagError } = await (supabase as any)
          .from('lead_tags')
          .delete()
          .eq('lead_id', leadId)
          .eq('tag_id', actionConfig.tag_id);

        if (removeTagError) {
          console.error("Erro ao remover tag:", removeTagError);
          return false;
        }
        break;

      case 'update_field':
        if (!actionConfig.field || actionConfig.value === undefined) {
          console.error("Configuração inválida para update_field");
          return false;
        }

        const updateData: Record<string, any> = {};
        updateData[actionConfig.field] = actionConfig.value;

        const { error: updateError } = await (supabase as any)
          .from('leads')
          .update(updateData)
          .eq('id', leadId);

        if (updateError) {
          console.error("Erro ao atualizar campo:", updateError);
          return false;
        }
        break;

      case 'update_value':
        if (actionConfig.value === undefined || actionConfig.value === null) {
          console.error("Configuração inválida para update_value");
          return false;
        }

        const numericValue = parseFloat(actionConfig.value);
        if (isNaN(numericValue)) {
          console.error("Valor inválido para update_value");
          return false;
        }

        const { error: valueError } = await (supabase as any)
          .from('leads')
          .update({ value: numericValue })
          .eq('id', leadId);

        if (valueError) {
          console.error("Erro ao atualizar valor:", valueError);
          return false;
        }
        break;

      case 'apply_template':
        if (!actionConfig.template_id) {
          console.error("Configuração inválida para apply_template");
          return false;
        }

        // Aplicar outro template de follow-up ao lead
        const { error: applyTemplateError } = await (supabase as any)
          .from('lead_follow_ups')
          .insert({
            lead_id: leadId,
            template_id: actionConfig.template_id,
            created_by: user.id,
          });

        if (applyTemplateError) {
          console.error("Erro ao aplicar template:", applyTemplateError);
          return false;
        }
        break;

      case 'wait_delay':
        // Esta automação não executa ação imediata, apenas marca que deve aguardar
        // A lógica de delay será tratada no hook useLeadFollowUps
        // Por enquanto, apenas registramos que há um delay configurado
        console.log(`Delay configurado: ${actionConfig.delay_value} ${actionConfig.delay_unit}`);
        // Nota: A implementação completa de delay requer um sistema de agendamento
        // Por enquanto, retornamos true para não bloquear outras automações
        break;

      case 'create_reminder':
        if (!actionConfig.title) {
          console.error("Configuração inválida para create_reminder");
          return false;
        }

        // Criar atividade como lembrete
        const reminderDate = actionConfig.reminder_date 
          ? new Date(actionConfig.reminder_date).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Padrão: 24h depois

        const { error: reminderError } = await (supabase as any)
          .from('activities')
          .insert({
            lead_id: leadId,
            organization_id: organizationId,
            type: 'note',
            content: `🔔 LEMBRETE: ${actionConfig.title}${actionConfig.description ? `\n${actionConfig.description}` : ''}`,
            user_name: user.email || 'Sistema',
            created_at: reminderDate, // Usar created_at para agendar
          });

        if (reminderError) {
          console.error("Erro ao criar lembrete:", reminderError);
          return false;
        }
        break;

      case 'remove_from_call_queue':
        // Remover da fila de ligações (deletar registros pendentes)
        const { error: removeQueueError } = await (supabase as any)
          .from('call_queue')
          .delete()
          .eq('lead_id', leadId)
          .eq('status', 'pending');

        if (removeQueueError) {
          console.error("Erro ao remover da fila:", removeQueueError);
          return false;
        }
        break;

      default:
        console.error("Tipo de automação não suportado:", actionType);
        return false;
    }

    return true;
  } catch (error: any) {
    console.error("Erro ao executar automação:", error);
    return false;
  }
}

