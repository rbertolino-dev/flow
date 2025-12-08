/**
 * Helpers compartilhados para webhooks de mensageria (Evolution e Chatwoot)
 * Centraliza lógica de criação/atualização de leads
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface LeadSource {
  source: 'whatsapp' | 'chatwoot' | 'facebook' | 'instagram';
  sourceInstanceId: string;
  sourceInstanceName: string;
  organizationId: string;
  userId: string;
}

export interface MessageData {
  phoneNumber: string;
  contactName: string;
  messageContent: string;
  direction: 'incoming' | 'outgoing';
  isFromMe: boolean;
}

/**
 * Processa mensagem e cria/atualiza lead no funil
 */
export async function processLeadFromMessage(
  supabase: SupabaseClient,
  leadSource: LeadSource,
  messageData: MessageData
): Promise<{ success: boolean; leadId?: string; action?: string }> {
  
  const { phoneNumber, contactName, messageContent, direction, isFromMe } = messageData;
  const { source, sourceInstanceId, sourceInstanceName, organizationId, userId } = leadSource;

  console.log(`🔍 Verificando lead existente para ${phoneNumber} na org ${organizationId}`);

  // Verificar se já existe lead com este telefone NESTA organização E desta mesma instância
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, deleted_at, excluded_from_funnel, source_instance_id, source_instance_name, stage_id')
    .eq('phone', phoneNumber)
    .eq('organization_id', organizationId)
    .eq('source_instance_id', sourceInstanceId)
    .maybeSingle();

  if (existingLead) {
    // Se está excluído do funil, não criar/restaurar - apenas registrar atividade silenciosamente
    if (existingLead.excluded_from_funnel) {
      console.log(`🚫 Lead excluído do funil (ID: ${existingLead.id}), não restaurando`);
      
      // Ainda registrar a atividade para histórico, mas não atualizar o lead
      await supabase.from('activities').insert({
        organization_id: organizationId,
        lead_id: existingLead.id,
        type: source,
        content: messageContent,
        user_name: contactName,
        direction,
      });
      
      return { 
        success: true, 
        leadId: existingLead.id,
        action: 'skipped_excluded' 
      };
    }
    
    // Se foi excluído (soft delete), recriar
    if (existingLead.deleted_at) {
      console.log(`🔄 Lead foi excluído, restaurando (ID: ${existingLead.id})`);
      
      // Buscar primeiro estágio do funil
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      // Preparar dados de atualização
      const updateData: any = {
        deleted_at: null,
        name: contactName,
        last_contact: new Date().toISOString(),
        stage_id: firstStage?.id,
        source_instance_id: sourceInstanceId,
        source_instance_name: sourceInstanceName,
      };
      
      // Se for mensagem recebida, marcar como não lida
      if (!isFromMe) {
        updateData.has_unread_messages = true;
        updateData.last_message_at = new Date().toISOString();
        updateData.unread_message_count = 1;
      }
      
      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', existingLead.id);

      // Adicionar atividade de retorno
      await supabase.from('activities').insert({
        organization_id: organizationId,
        lead_id: existingLead.id,
        type: source,
        content: isFromMe ? messageContent : `[Retorno] ${messageContent}`,
        user_name: isFromMe ? 'Você' : contactName,
        direction,
      });

      // Publicar no Realtime
      await publishLeadUpdate(supabase, organizationId, existingLead.id, 'restored');

      return { 
        success: true, 
        leadId: existingLead.id, 
        action: 'restored' 
      };
      
    } else {
      // Lead existe e não foi excluído, apenas adicionar atividade
      console.log(`♻️ Lead já existe (ID: ${existingLead.id}), adicionando atividade`);
      
      await supabase.from('activities').insert({
        organization_id: organizationId,
        lead_id: existingLead.id,
        type: source,
        content: messageContent,
        user_name: isFromMe ? 'Você' : contactName,
        direction,
      });

      // Atualizar lead com informações de mensagem
      const updateData: any = { 
        last_contact: new Date().toISOString(),
        source_instance_id: sourceInstanceId,
        source_instance_name: sourceInstanceName,
      };
      
      // Se for mensagem recebida, marcar como não lida
      if (!isFromMe) {
        updateData.has_unread_messages = true;
        updateData.last_message_at = new Date().toISOString();
        // Incrementar contador de não lidas
        await supabase.rpc('increment_unread_count', { lead_id_param: existingLead.id });
      }

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', existingLead.id);
      
      // Publicar no Realtime
      await publishLeadUpdate(supabase, organizationId, existingLead.id, 'updated');

      return { 
        success: true, 
        leadId: existingLead.id, 
        action: 'updated' 
      };
    }

  } else {
    // Criar novo lead apenas se a mensagem for recebida (não criar lead quando você envia primeira mensagem)
    if (!isFromMe) {
      console.log('🆕 Criando novo lead...');
      
      // Buscar primeiro estágio do funil da organização
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();

      console.log(`📊 Primeiro estágio do funil: ${firstStage?.id || 'não encontrado'}`);
      
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          name: contactName,
          phone: phoneNumber,
          source,
          source_instance_id: sourceInstanceId,
          source_instance_name: sourceInstanceName,
          status: 'novo',
          stage_id: firstStage?.id,
          last_contact: new Date().toISOString(),
          has_unread_messages: true,
          last_message_at: new Date().toISOString(),
          unread_message_count: 1,
        })
        .select()
        .single();

      if (leadError) {
        console.error('❌ Erro ao criar lead:', leadError);
        throw leadError;
      }

      console.log(`✅ Lead criado com ID: ${newLead.id} no estágio ${firstStage?.id || 'padrão'}`);

      // Adicionar primeira atividade
      await supabase.from('activities').insert({
        organization_id: organizationId,
        lead_id: newLead.id,
        type: source,
        content: messageContent,
        user_name: contactName,
        direction,
      });

      // Publicar no Realtime
      await publishLeadUpdate(supabase, organizationId, newLead.id, 'created');

      return { 
        success: true, 
        leadId: newLead.id, 
        action: 'created' 
      };
      
    } else {
      console.log(`ℹ️ Mensagem enviada para número não existente como lead, ignorando`);
      return { success: true, action: 'ignored' };
    }
  }
}

/**
 * Publica atualização de lead no Realtime
 */
export async function publishLeadUpdate(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
  action: 'created' | 'updated' | 'restored'
) {
  try {
    const channel = supabase.channel('crm-leads');
    
    await channel.send({
      type: 'broadcast',
      event: 'lead_updated',
      payload: {
        organizationId,
        leadId,
        action,
        timestamp: new Date().toISOString(),
      }
    });

    console.log(`📡 Lead ${action} publicado no Realtime`);
  } catch (error) {
    console.error('⚠️ Erro ao publicar no Realtime:', error);
    // Não bloqueia o fluxo
  }
}

/**
 * Publica nova mensagem no Realtime
 */
export async function publishMessageUpdate(
  supabase: SupabaseClient,
  organizationId: string,
  conversationId: string,
  message: any,
  source: 'whatsapp' | 'chatwoot'
) {
  try {
    const channelName = source === 'chatwoot' ? 'chatwoot-messages' : 'evolution-messages';
    const channel = supabase.channel(channelName);
    
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: {
        organizationId,
        conversationId,
        message,
        source,
      }
    });

    console.log(`📡 Mensagem ${source} publicada no Realtime`);
  } catch (error) {
    console.error('⚠️ Erro ao publicar mensagem no Realtime:', error);
    // Não bloqueia o fluxo
  }
}

/**
 * Registra log padronizado
 */
export async function logEvent(
  supabase: SupabaseClient,
  data: {
    userId: string | null;
    organizationId: string | null;
    instance: string;
    event: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    payload?: any;
  }
) {
  try {
    await supabase.from('evolution_logs').insert({
      user_id: data.userId,
      organization_id: data.organizationId,
      instance: data.instance,
      event: data.event,
      level: data.level,
      message: data.message,
      payload: data.payload || {},
    });
  } catch (error) {
    console.error('⚠️ Erro ao salvar log:', error);
    // Não bloqueia o fluxo
  }
}
