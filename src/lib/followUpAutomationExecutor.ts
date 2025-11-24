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

