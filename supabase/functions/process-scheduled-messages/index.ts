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
        
        // LOG: Identificar organização da mensagem
        console.log(`🏢 [process-scheduled-messages] Organização da mensagem: ${message.organization_id || 'N/A'}`);
        console.log(`🔗 [process-scheduled-messages] Instance ID: ${message.instance_id}`);

        // Buscar configuração da instância
        const { data: config, error: configError } = await supabase
          .from('evolution_config')
          .select('api_url, api_key, instance_name, is_connected, organization_id')
          .eq('id', message.instance_id)
          .maybeSingle();

        if (configError || !config) {
          throw new Error('Instância não encontrada');
        }

        // LOG: Detalhes da instância
        console.log(`⚙️ [process-scheduled-messages] Configuração da instância:`, {
          instance_name: config.instance_name,
          api_url: config.api_url,
          organization_id: config.organization_id,
          is_connected: config.is_connected,
          message_org_id: message.organization_id
        });

        // Verificar se a organização da mensagem corresponde à organização da instância
        if (message.organization_id && config.organization_id && message.organization_id !== config.organization_id) {
          console.warn(`⚠️ [process-scheduled-messages] ATENÇÃO: Mensagem da org ${message.organization_id} está usando instância da org ${config.organization_id}`);
        }

        if (!config.is_connected) {
          throw new Error('Instância não está conectada');
        }

        // Formatar telefone (mesmo formato usado em send-whatsapp-message)
        let formattedPhone = message.phone.replace(/\D/g, '');
        
        // Garantir que números brasileiros tenham código do país (55)
        if (!formattedPhone.startsWith('55') && formattedPhone.length >= 10) {
          // Verificar se parece um número brasileiro (DDD válido: 11-99)
          const ddd = parseInt(formattedPhone.substring(0, 2));
          if (ddd >= 11 && ddd <= 99) {
            formattedPhone = '55' + formattedPhone;
            console.log('➕ [process-scheduled-messages] Adicionado código do país 55');
          }
        }
        
        // Aplicar modo de teste se ativo
        const testConfig = getTestModeConfig();
        const finalPhone = applyTestMode(formattedPhone, testConfig);
        const remoteJid = finalPhone.includes('@') ? finalPhone : `${finalPhone}@s.whatsapp.net`;
        
        console.log('📱 [process-scheduled-messages] Telefone formatado:', { 
          original: message.phone, 
          formatted: formattedPhone, 
          remoteJid 
        });

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

        const responseText = await evolutionResponse.text();
        let evolutionData: any = null;

        try {
          evolutionData = JSON.parse(responseText);
        } catch {
          // Se não for JSON, tratar como texto
          evolutionData = { raw: responseText };
        }

        // Verificar se houve erro na resposta
        if (!evolutionResponse.ok) {
          const errorMessage = typeof evolutionData === 'object' && evolutionData.response?.message
            ? JSON.stringify(evolutionData.response.message)
            : responseText;
          
          // Verificar se o erro é sobre número não existente (exists: false)
          const isExistsFalseError = typeof evolutionData === 'object' && 
                                   Array.isArray(evolutionData.response?.message) &&
                                   evolutionData.response.message.some((m: any) => m.exists === false);
          
          if (isExistsFalseError) {
            console.warn(`⚠️ [process-scheduled-messages] Evolution API retornou exists: false para ${remoteJid}`);
            console.warn(`⚠️ [process-scheduled-messages] Organização: ${message.organization_id || 'N/A'}`);
            console.warn(`⚠️ [process-scheduled-messages] Instância: ${config.instance_name} (${config.api_url})`);
            console.warn(`⚠️ [process-scheduled-messages] Telefone original: ${message.phone}, formatado: ${formattedPhone}, remoteJid: ${remoteJid}`);
            console.warn(`⚠️ [process-scheduled-messages] Tentando fallback com sendMedia (às vezes é falso positivo)...`);
            
            // Tentar fallback: usar sendMedia mesmo para mensagens de texto
            // Algumas instâncias da Evolution API retornam exists: false incorretamente
            try {
              const fallbackUrl = `${baseUrl}/message/sendMedia/${config.instance_name}`;
              const fallbackPayload = {
                number: remoteJid,
                mediatype: 'text',
                media: '',
                caption: message.message,
              };
              
              console.log('🔄 [process-scheduled-messages] Tentando fallback sendMedia...');
              const fallbackResponse = await fetch(fallbackUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': config.api_key || '',
                },
                body: JSON.stringify(fallbackPayload),
              });
              
              const fallbackText = await fallbackResponse.text();
              let fallbackData: any = null;
              
              try {
                fallbackData = JSON.parse(fallbackText);
              } catch {
                fallbackData = { raw: fallbackText };
              }
              
              if (fallbackResponse.ok) {
                console.log('✅ [process-scheduled-messages] Fallback sendMedia funcionou!');
                // Continuar com o fluxo normal de sucesso
                evolutionData = fallbackData;
              } else {
                // Fallback também falhou, verificar se ainda é exists: false
                const fallbackExistsFalse = typeof fallbackData === 'object' && 
                                          Array.isArray(fallbackData.response?.message) &&
                                          fallbackData.response.message.some((m: any) => m.exists === false);
                
                if (fallbackExistsFalse) {
                  // Realmente não existe, marcar como falha
                  const invalidNumber = fallbackData.response.message.find((m: any) => m.exists === false);
                  console.error(`❌ [process-scheduled-messages] Número realmente não existe no WhatsApp após fallback: ${invalidNumber?.jid || remoteJid}`);
                  
                  await supabase
                    .from('scheduled_messages')
                    .update({
                      status: 'failed',
                      error_message: `Número não existe no WhatsApp: ${invalidNumber?.jid || remoteJid}. O número não está registrado no WhatsApp.`,
                    })
                    .eq('id', message.id);

                  failureCount++;
                  continue;
                } else {
                  // Outro erro no fallback, lançar
                  throw new Error(`Evolution API erro no fallback ${fallbackResponse.status}: ${fallbackText}`);
                }
              }
            } catch (fallbackError: any) {
              console.error(`❌ [process-scheduled-messages] Erro no fallback:`, fallbackError.message);
              // Se fallback falhar, marcar como erro
              await supabase
                .from('scheduled_messages')
                .update({
                  status: 'failed',
                  error_message: `Erro ao enviar mensagem: ${fallbackError.message}`,
                })
                .eq('id', message.id);

              failureCount++;
              continue;
            }
          } else {
            // Outro tipo de erro (não é exists: false), lançar normalmente
            throw new Error(`Evolution API erro ${evolutionResponse.status}: ${errorMessage}`);
          }
        }

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