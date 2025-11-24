import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  processLeadFromMessage, 
  publishMessageUpdate,
  logEvent 
} from '../_shared/messaging-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    
    console.log('📨 Webhook Chatwoot recebido:', payload.event);

    // Verificar se é um evento de mensagem
    if (payload.event === 'message_created') {
      const message = payload;
      const conversationId = payload.conversation?.id || payload.conversation_id;
      const isIncoming = payload.message_type === 'incoming' || payload.message_type === 0;
      
      // Extrair organization_id do payload ou de metadados
      // TENTATIVA 1: custom_attributes (configurado manualmente no Chatwoot)
      let organizationId = payload.conversation?.custom_attributes?.organization_id;
      
      // TENTATIVA 2: Se não tiver, tentar identificar pelo Account ID do Chatwoot
      // O Account ID vem no payload e pode ser usado para buscar a organização
      const chatwootAccountId = payload.account?.id || payload.conversation?.account_id;
      
      const phoneNumber = payload.conversation?.meta?.sender?.phone_number || 
                          payload.conversation?.meta?.sender?.identifier;

      console.log('💬 Nova mensagem Chatwoot:', {
        conversationId,
        organizationId,
        chatwootAccountId,
        messageType: payload.message_type,
        phone: phoneNumber,
        isIncoming,
      });

      // Se não tiver organization_id nos custom_attributes, tentar buscar pelo Account ID
      if (!organizationId && chatwootAccountId) {
        console.log(`🔍 Tentando identificar organização pelo Account ID: ${chatwootAccountId}`);
        const { data: configByAccount } = await supabase
          .from('chatwoot_configs')
          .select('organization_id')
          .eq('chatwoot_account_id', chatwootAccountId)
          .eq('enabled', true)
          .maybeSingle();
        
        if (configByAccount) {
          organizationId = configByAccount.organization_id;
          console.log(`✅ Organização identificada pelo Account ID: ${organizationId}`);
        }
      }

      // Se tiver número de telefone e org, processar como lead (se configurado)
      if (phoneNumber && organizationId) {
        // Buscar config do Chatwoot para verificar se deve criar leads
        const { data: config } = await supabase
          .from('chatwoot_configs')
          .select('organization_id, create_leads')
          .eq('organization_id', organizationId)
          .eq('enabled', true)
          .maybeSingle();

        if (config) {
          // Verificar se criação de leads está habilitada
          const shouldCreateLeads = config.create_leads !== false; // Default true se null
          
          if (shouldCreateLeads) {
            // Buscar primeiro usuário da org
            const { data: orgMember } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', organizationId)
              .limit(1)
              .maybeSingle();

            if (orgMember) {
              // Processar lead usando helper compartilhado
              const result = await processLeadFromMessage(
                supabase,
                {
                  source: 'chatwoot',
                  sourceInstanceId: `chatwoot_${organizationId}`,
                  sourceInstanceName: 'Chatwoot',
                  organizationId,
                  userId: orgMember.user_id,
                },
                {
                  phoneNumber: phoneNumber.replace(/\D/g, ''),
                  contactName: payload.sender?.name || payload.conversation?.meta?.sender?.name || 'Cliente',
                  messageContent: payload.content || '[Mensagem sem conteúdo]',
                  direction: isIncoming ? 'incoming' : 'outgoing',
                  isFromMe: !isIncoming,
                }
              );

              console.log(`✅ Lead processado: ${result.action} (ID: ${result.leadId})`);

              // Registrar log
              await logEvent(supabase, {
                userId: orgMember.user_id,
                organizationId,
                instance: 'chatwoot',
                event: 'message_created',
                level: 'info',
                message: `Mensagem ${isIncoming ? 'recebida' : 'enviada'} via Chatwoot - Lead ${result.action}`,
                payload: { phoneNumber, conversationId, leadId: result.leadId },
              });
            }
          } else {
            console.log(`ℹ️ Criação de leads desabilitada para organização ${organizationId}. Mensagem processada mas lead não criado.`);
            
            // Registrar log mesmo sem criar lead
            const { data: orgMember } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', organizationId)
              .limit(1)
              .maybeSingle();
            
            if (orgMember) {
              await logEvent(supabase, {
                userId: orgMember.user_id,
                organizationId,
                instance: 'chatwoot',
                event: 'message_created',
                level: 'info',
                message: `Mensagem ${isIncoming ? 'recebida' : 'enviada'} via Chatwoot - Lead não criado (create_leads=false)`,
                payload: { phoneNumber, conversationId },
              });
            }
          }
        }
      } else {
        // Log de erro quando não conseguir identificar organização
        if (!organizationId) {
          console.error('❌ Não foi possível identificar a organização:', {
            hasCustomAttributes: !!payload.conversation?.custom_attributes,
            chatwootAccountId,
            phoneNumber,
            conversationId,
            hint: 'Configure custom_attributes.organization_id no Chatwoot ou use Account ID único por organização'
          });
        } else if (!phoneNumber) {
          console.warn('⚠️ Mensagem sem número de telefone, ignorando:', {
            conversationId,
            organizationId
          });
        }
      }

      // Publicar no Realtime para atualização instantânea da UI (mesmo sem processar lead)
      if (organizationId) {
        await publishMessageUpdate(
          supabase,
          organizationId,
          conversationId?.toString(),
          {
            id: payload.id,
            content: payload.content,
            message_type: payload.message_type,
            created_at: payload.created_at,
            sender: payload.sender,
          },
          'chatwoot'
        );

        console.log('✅ Mensagem Chatwoot publicada no Realtime');
      }
    }

    // Evento de conversa atualizada
    if (payload.event === 'conversation_updated') {
      const conversationId = payload.id;
      
      // TENTATIVA 1: custom_attributes
      let organizationId = payload.custom_attributes?.organization_id;
      
      // TENTATIVA 2: Account ID como fallback
      const chatwootAccountId = payload.account?.id || payload.account_id;
      if (!organizationId && chatwootAccountId) {
        const { data: configByAccount } = await supabase
          .from('chatwoot_configs')
          .select('organization_id')
          .eq('chatwoot_account_id', chatwootAccountId)
          .eq('enabled', true)
          .maybeSingle();
        
        if (configByAccount) {
          organizationId = configByAccount.organization_id;
        }
      }

      const channel = supabase.channel('chatwoot-conversations');
      
      await channel.send({
        type: 'broadcast',
        event: 'conversation_updated',
        payload: {
          conversationId: conversationId?.toString(),
          organizationId,
          status: payload.status,
        }
      });

      console.log('✅ Conversa atualizada no Realtime');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no webhook Chatwoot:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

