import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getTestModeConfig, applyTestMode, shouldSendMessage } from "../_shared/test-mode.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🕐 [process-scheduled-messages] Iniciando processamento...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mensagens pendentes que já passaram do horário agendado
    const { data: messages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50); // Processar no máximo 50 mensagens por vez

    if (fetchError) {
      console.error('❌ Erro ao buscar mensagens:', fetchError);
      throw fetchError;
    }

    console.log(`📬 [process-scheduled-messages] Encontradas ${messages?.length || 0} mensagens para processar`);

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma mensagem para processar',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    // Processar cada mensagem
    for (const message of messages) {
      try {
        console.log(`📤 Processando mensagem ${message.id} para ${message.phone}`);

        // Buscar configuração da instância
        const { data: config, error: configError } = await supabase
          .from('evolution_config')
          .select('api_url, api_key, instance_name, is_connected')
          .eq('id', message.instance_id)
          .maybeSingle();

        if (configError || !config) {
          throw new Error('Instância não encontrada');
        }

        if (!config.is_connected) {
          throw new Error('Instância não está conectada');
        }

        // Formatar telefone
        const formattedPhone = message.phone.replace(/\D/g, '');
        
        // Aplicar modo de teste se ativo
        const testConfig = getTestModeConfig();
        const finalPhone = applyTestMode(formattedPhone, testConfig);
        const remoteJid = finalPhone.includes('@') ? finalPhone : `${finalPhone}@s.whatsapp.net`;

        // Verificar se deve realmente enviar
        if (!shouldSendMessage(testConfig)) {
          console.log(`🧪 [process-scheduled-messages] TEST MODE - LOG ONLY: Mensagem ${message.id} não será enviada`);
          
          // Marcar como enviada (simulado) mas com flag de teste
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: '[TEST MODE - LOG ONLY] Mensagem simulada, não enviada realmente',
            })
            .eq('id', message.id);

          // Registrar atividade no lead (marcada como teste)
          if (message.lead_id) {
            await supabase.from('activities').insert({
              lead_id: message.lead_id,
              type: 'whatsapp',
              content: `[TEST MODE] ${message.message}`,
              user_name: 'Sistema (Agendado - TEST MODE)',
              direction: 'outgoing',
            });
          }

          console.log(`✅ Mensagem ${message.id} simulada (TEST MODE)`);
          successCount++;
          continue;
        }

        // Montar URL e payload
        const baseUrl = config.api_url.replace(/\/manager\/?$/, '');
        let evolutionUrl: string;
        let payload: any;

        if (message.media_url) {
          evolutionUrl = `${baseUrl}/message/sendMedia/${config.instance_name}`;
          payload = {
            number: remoteJid,
            mediatype: message.media_type || 'image',
            media: message.media_url,
            caption: message.message || '',
          };
          console.log('🖼️ [process-scheduled-messages] Enviando mensagem com mídia:', {
            to: remoteJid,
            test_mode: testConfig.enabled,
            original_phone: message.phone
          });
        } else {
          evolutionUrl = `${baseUrl}/message/sendText/${config.instance_name}`;
          payload = {
            number: remoteJid,
            text: message.message,
          };
          console.log('📝 [process-scheduled-messages] Enviando mensagem de texto:', {
            to: remoteJid,
            test_mode: testConfig.enabled,
            original_phone: message.phone
          });
        }

        // Enviar mensagem via Evolution API
        const evolutionResponse = await fetch(evolutionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.api_key || '',
          },
          body: JSON.stringify(payload),
        });

        if (!evolutionResponse.ok) {
          const errorText = await evolutionResponse.text();
          throw new Error(`Evolution API erro ${evolutionResponse.status}: ${errorText}`);
        }

        const evolutionData = await evolutionResponse.json();

        // Marcar como enviada
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', message.id);

        // Registrar atividade no lead
        await supabase.from('activities').insert({
          lead_id: message.lead_id,
          type: 'whatsapp',
          content: message.message,
          user_name: 'Sistema (Agendado)',
          direction: 'outgoing',
        });

        // Atualizar last_contact do lead
        await supabase
          .from('leads')
          .update({ last_contact: new Date().toISOString() })
          .eq('id', message.lead_id);

        console.log(`✅ Mensagem ${message.id} enviada com sucesso`);
        successCount++;

      } catch (error: any) {
        console.error(`❌ Erro ao processar mensagem ${message.id}:`, error.message);
        
        // Marcar como falha
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', message.id);

        failureCount++;
      }
    }

    console.log(`🎉 Processamento concluído: ${successCount} enviadas, ${failureCount} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: messages.length,
        sent: successCount,
        failed: failureCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro crítico:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar mensagens agendadas',
        details: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});