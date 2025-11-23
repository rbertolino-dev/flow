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
      const organizationId = payload.conversation?.custom_attributes?.organization_id;
      const phoneNumber = payload.conversation?.meta?.sender?.phone_number || 
                          payload.conversation?.meta?.sender?.identifier;

      console.log('💬 Nova mensagem Chatwoot:', {
        conversationId,
        organizationId,
        messageType: payload.message_type,
        phone: phoneNumber,
        isIncoming,
      });

      // Se tiver número de telefone e org, processar como lead
      if (phoneNumber && organizationId) {
        // Buscar config do Chatwoot para pegar user_id
        const { data: config } = await supabase
          .from('chatwoot_configs')
          .select('organization_id')
          .eq('organization_id', organizationId)
          .eq('enabled', true)
          .maybeSingle();

        if (config) {
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
        }
      }

      // Publicar no Realtime para atualização instantânea da UI
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

    // Evento de conversa atualizada
    if (payload.event === 'conversation_updated') {
      const conversationId = payload.id;
      const organizationId = payload.custom_attributes?.organization_id;

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

