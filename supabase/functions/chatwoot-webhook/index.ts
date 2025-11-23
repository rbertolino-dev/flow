import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    
    console.log('📨 Webhook recebido:', payload.event);

    // Verificar se é um evento de mensagem
    if (payload.event === 'message_created') {
      const message = payload.message_type === 'incoming' ? payload : payload;
      const conversationId = payload.conversation?.id || payload.conversation_id;
      
      // Extrair organization_id do payload ou de metadados
      // O Chatwoot pode enviar custom_attributes na conversa
      const organizationId = payload.conversation?.custom_attributes?.organization_id;

      console.log('💬 Nova mensagem:', {
        conversationId,
        organizationId,
        messageType: payload.message_type,
      });

      // Publicar no Realtime para todos os clientes conectados
      const channel = supabase.channel('chatwoot-messages');
      
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          conversationId: conversationId?.toString(),
          organizationId,
          message: {
            id: payload.id,
            content: payload.content,
            message_type: payload.message_type,
            created_at: payload.created_at,
            sender: payload.sender,
          }
        }
      });

      console.log('✅ Mensagem publicada no Realtime');
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
    console.error('❌ Erro no webhook:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
