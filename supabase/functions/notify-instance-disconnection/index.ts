import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DisconnectionNotification {
  instanceId: string;
  organizationId: string;
  instanceName: string;
  qrCode?: string;
  whatsappNotificationPhone?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: DisconnectionNotification = await req.json();
    const { instanceId, organizationId, instanceName, qrCode, whatsappNotificationPhone } = body;

    if (!instanceId || !organizationId || !instanceName) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: instanceId, organizationId, instanceName' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🔔 Processando notificação de desconexão para instância ${instanceName}`);

    // Criar notificação no banco
    const { data: notification, error: notificationError } = await supabase
      .from('instance_disconnection_notifications')
      .insert({
        organization_id: organizationId,
        instance_id: instanceId,
        instance_name: instanceName,
        qr_code: qrCode || null,
        qr_code_fetched_at: qrCode ? new Date().toISOString() : null,
        notification_sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Erro ao criar notificação:', notificationError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar notificação', details: notificationError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Enviar notificação WhatsApp se configurado
    if (whatsappNotificationPhone) {
      try {
        // Buscar outra instância conectada da mesma organização para enviar a notificação
        const { data: connectedInstances } = await supabase
          .from('evolution_config')
          .select('id, api_url, api_key, instance_name')
          .eq('organization_id', organizationId)
          .eq('is_connected', true)
          .neq('id', instanceId)
          .limit(1);

        if (connectedInstances && connectedInstances.length > 0) {
          const notificationInstance = connectedInstances[0];
          
          // Criar link de reconexão (usar variável de ambiente ou construir a partir do request)
          const baseUrl = Deno.env.get('APP_URL') || 'https://seu-dominio.com';
          const reconnectUrl = `${baseUrl}/reconnect/${notification.id}`;
          
          const message = `⚠️ *ALERTA DE DESCONEXÃO*\n\n` +
            `A instância *${instanceName}* foi desconectada.\n\n` +
            `🔗 Acesse o link abaixo para reconectar escaneando o QR Code:\n` +
            `${reconnectUrl}\n\n` +
            `Ou acesse o sistema e vá em Configurações → Instâncias WhatsApp.`;

          // Enviar mensagem via edge function
          const { data: messageData, error: messageError } = await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              instanceId: notificationInstance.id,
              phone: whatsappNotificationPhone,
              message: message,
            },
          });

          if (messageError || !messageData?.success) {
            console.error('❌ Erro ao enviar notificação WhatsApp:', messageError || messageData);
          } else {
            console.log('✅ Notificação WhatsApp enviada com sucesso');

            // Atualizar notificação com info do WhatsApp
            await supabase
              .from('instance_disconnection_notifications')
              .update({
                whatsapp_notification_sent_at: new Date().toISOString(),
                whatsapp_notification_to: whatsappNotificationPhone,
              })
              .eq('id', notification.id);
          }
        } else {
          console.warn('⚠️ Nenhuma instância conectada disponível para enviar notificação WhatsApp');
        }
      } catch (whatsappError) {
        console.error('❌ Erro ao processar notificação WhatsApp:', whatsappError);
        // Não falhar a função inteira se o WhatsApp falhar
      }
    }

    console.log('✅ Notificação de desconexão processada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationId: notification.id,
        whatsappSent: !!whatsappNotificationPhone
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 Erro crítico:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao processar notificação',
        details: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

