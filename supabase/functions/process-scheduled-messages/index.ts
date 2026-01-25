import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getTestModeConfig, applyTestMode, shouldSendMessage } from "../_shared/test-mode.ts";
import { 
  fetchWithTimeout, 
  sendWithRetry, 
  validateMessageLength, 
  rateLimiter, 
  circuitBreaker 
} from "../_shared/message-security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calcula delay de digitação realista baseado no tamanho da mensagem
 * Valores DOBRADOS para máxima segurança:
 * - Mínimo: 4000ms (4 segundos) - tempo de pensar antes de começar
 * - Máximo: 30000ms (30 segundos) - mensagens muito longas
 * - Velocidade: 3.5 caracteres/segundo (média humana)
 */
function calculateTypingDelay(message: string, messageType: 'text' | 'media' | 'document' = 'text'): number {
  if (!message || message.length === 0) {
    // Mensagens sem texto: tempo mínimo baseado no tipo (DOBRADO)
    if (messageType === 'document') return 5000; // 5s para documentos sem caption
    if (messageType === 'media') return 6000; // 6s para mídia sem caption
    return 4000; // 4s para texto sem mensagem
  }
  
  // Velocidade média de digitação humana: ~200-250 caracteres/minuto
  // Isso dá aproximadamente 3.3-4.2 caracteres por segundo
  const charsPerSecond = 3.5;
  
  // Tempo base (pensar + começar a digitar) - DOBRADO
  let baseDelay: number;
  if (messageType === 'document') {
    baseDelay = 5000; // 5s para documentos (mais complexo)
  } else if (messageType === 'media') {
    baseDelay = 5000; // 5s para mídia
  } else {
    baseDelay = 4000; // 4s para texto
  }
  
  // Tempo de digitação baseado no tamanho da mensagem
  const typingTime = (message.length / charsPerSecond) * 1000; // converter para ms
  
  // Variação aleatória ±25% para parecer mais humano
  const variation = 0.25;
  const randomMultiplier = 1 + (Math.random() * variation * 2 - variation);
  
  const calculatedDelay = baseDelay + (typingTime * randomMultiplier);
  
  // Limites DOBRADOS: mínimo baseado no tipo, máximo 30s (texto/mídia) ou 40s (documentos)
  const maxDelay = messageType === 'document' ? 40000 : 30000; // 40s para documentos, 30s para texto/mídia
  
  return Math.max(baseDelay, Math.min(maxDelay, Math.round(calculatedDelay)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🕐 [process-scheduled-messages] Iniciando processamento...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ✅ DEBUG: Log detalhado antes de buscar
    console.log('🔍 [process-scheduled-messages] Buscando mensagens agendadas...');
    console.log('🔍 [process-scheduled-messages] Filtros:', {
      status: 'pending',
      scheduled_for: `<= ${new Date().toISOString()}`,
      limit: 50
    });

    // Buscar mensagens pendentes que já passaram do horário agendado
    const { data: messages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50); // Processar no máximo 50 mensagens por vez

    if (fetchError) {
      console.error('❌ [process-scheduled-messages] Erro ao buscar mensagens:', {
        error: fetchError,
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
      });
      throw fetchError;
    }

    console.log(`📬 [process-scheduled-messages] Encontradas ${messages?.length || 0} mensagens para processar`);
    
    // ✅ DEBUG: Log detalhes das mensagens encontradas
    if (messages && messages.length > 0) {
      console.log('📋 [process-scheduled-messages] Detalhes das mensagens:', 
        messages.map(m => ({
          id: m.id,
          organization_id: m.organization_id,
          instance_id: m.instance_id,
          phone: m.phone,
          scheduled_for: m.scheduled_for,
          status: m.status,
        }))
      );
    } else {
      console.log('ℹ️ [process-scheduled-messages] Nenhuma mensagem pendente encontrada. Verificando se há mensagens na tabela...');
      
      // ✅ DEBUG: Verificar se há mensagens na tabela (mesmo que não atendam aos critérios)
      const { data: allMessages, error: allError } = await supabase
        .from('scheduled_messages')
        .select('id, status, scheduled_for, organization_id')
        .limit(5);
      
      if (!allError && allMessages) {
        console.log(`ℹ️ [process-scheduled-messages] Total de mensagens na tabela: ${allMessages.length}`);
        console.log('ℹ️ [process-scheduled-messages] Exemplos:', allMessages);
      }
    }

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

    // ✅ NOVO: Sistema de métricas (igual ao broadcast)
    interface InstanceMetrics {
      instanceId: string;
      messagesSent: number;
      messagesFailed: number;
      http200: number;
      http401: number;
      http404: number;
      http429: number;
      http500: number;
      consecutiveFailures: number;
      maxConsecutiveFailures: number;
      responseTimes: number[];
      lastError?: string;
      lastErrorCode?: string;
    }
    
    const metricsMap = new Map<string, InstanceMetrics>();
    
    // Função auxiliar para obter ou criar métricas de uma instância
    const getOrCreateMetrics = (instanceName: string): InstanceMetrics => {
      if (!metricsMap.has(instanceName)) {
        metricsMap.set(instanceName, {
          instanceId: instanceName,
          messagesSent: 0,
          messagesFailed: 0,
          http200: 0,
          http401: 0,
          http404: 0,
          http429: 0,
          http500: 0,
          consecutiveFailures: 0,
          maxConsecutiveFailures: 0,
          responseTimes: [],
        });
      }
      return metricsMap.get(instanceName)!;
    };

    // Processar cada mensagem
    for (const message of messages) {
      try {
        console.log(`📤 Processando mensagem ${message.id} para ${message.phone}`);
        
        // LOG: Identificar organização da mensagem
        console.log(`🏢 [process-scheduled-messages] Organização da mensagem: ${message.organization_id || 'N/A'}`);
        console.log(`🔗 [process-scheduled-messages] Instance ID: ${message.instance_id}`);

        // ✅ MELHORADO: Buscar configuração da instância com fallback (igual ao broadcast)
        let config: any = null;
        let instanceError: any = null;
        
        // Tentar buscar instância original
        const { data: originalConfig, error: originalError } = await supabase
          .from('evolution_config')
          .select('api_url, api_key, instance_name, is_connected, organization_id')
          .eq('id', message.instance_id)
          .maybeSingle();

        if (originalError || !originalConfig) {
          instanceError = originalError || new Error('Instância não encontrada');
        } else {
          config = originalConfig;
        }

        // ✅ NOVO: Se instância não está conectada, tentar buscar outra instância da mesma organização
        if (config && !config.is_connected && message.organization_id) {
          console.warn(`⚠️ [process-scheduled-messages] Instância ${config.instance_name} não está conectada, tentando fallback...`);
          
          const { data: fallbackConfig } = await supabase
            .from('evolution_config')
            .select('api_url, api_key, instance_name, is_connected, organization_id')
            .eq('organization_id', message.organization_id)
            .eq('is_connected', true)
            .neq('id', message.instance_id)
            .limit(1)
            .maybeSingle();

          if (fallbackConfig) {
            console.log(`✅ [process-scheduled-messages] Usando instância fallback: ${fallbackConfig.instance_name}`);
            config = fallbackConfig;
          } else {
            throw new Error('Instância não está conectada e nenhuma instância alternativa disponível');
          }
        }

        if (!config) {
          throw instanceError || new Error('Instância não encontrada');
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

        // ✅ CORREÇÃO: Normalização de telefone igual ao send-whatsapp-message (que funciona)
        console.log('📞 [process-scheduled-messages] Telefone original:', message.phone);
        
        // Remover caracteres não numéricos
        let formattedPhone = message.phone.replace(/\D/g, '');
        
        // Se já tem @, remover o sufixo antes de normalizar
        if (message.phone.includes('@')) {
          formattedPhone = message.phone.split('@')[0].replace(/\D/g, '');
          console.log('🔧 [process-scheduled-messages] Removido sufixo @ do telefone:', formattedPhone);
        }
        
        console.log('🔧 [process-scheduled-messages] Telefone após limpeza:', formattedPhone);
        
        // Aplicar modo de teste se ativo (definir antes de usar)
        const testConfig = getTestModeConfig();
        
        // ✅ CORREÇÃO: Garantir que números brasileiros tenham código do país (55)
        // Lógica igual ao send-whatsapp-message e send-budget-whatsapp
        const phoneBeforeCountryCode = formattedPhone;
        
        // ✅ FORÇAR: Se número tem 11 dígitos e não começa com 55, é brasileiro
        if (!formattedPhone.startsWith('55')) {
          if (formattedPhone.length === 11) {
            // Número brasileiro com DDD (11 dígitos = DDD + 9 dígitos)
            const ddd = parseInt(formattedPhone.substring(0, 2));
            console.log('🔍 [process-scheduled-messages] Verificando DDD:', { ddd, phoneLength: formattedPhone.length });
            
            if (ddd >= 11 && ddd <= 99) {
              formattedPhone = '55' + formattedPhone;
              console.log('➕ [process-scheduled-messages] Adicionado código do país 55 ao número brasileiro:', {
                antes: phoneBeforeCountryCode,
                depois: formattedPhone
              });
            } else {
              console.log('⚠️ [process-scheduled-messages] DDD inválido ou não brasileiro:', ddd);
            }
          } else if (formattedPhone.length >= 10 && formattedPhone.length <= 12) {
            // Pode ser número brasileiro sem DDD ou com formato diferente
            const ddd = parseInt(formattedPhone.substring(0, 2));
            if (ddd >= 11 && ddd <= 99) {
              formattedPhone = '55' + formattedPhone;
              console.log('➕ [process-scheduled-messages] Adicionado código do país 55 (formato alternativo):', {
                antes: phoneBeforeCountryCode,
                depois: formattedPhone
              });
            }
          }
        } else {
          console.log('ℹ️ [process-scheduled-messages] Número já tem código do país:', {
            startsWith55: formattedPhone.startsWith('55'),
            length: formattedPhone.length
          });
        }
        
        // ✅ GARANTIR: Se ainda não tem código do país e tem 11 dígitos, adicionar forçadamente
        if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
          formattedPhone = '55' + formattedPhone;
          console.log('🔧 [process-scheduled-messages] FORÇADO: Adicionado código do país 55 (fallback):', {
            antes: phoneBeforeCountryCode,
            depois: formattedPhone
          });
        }
        
        // Aplicar modo de teste se ativo
        const finalPhone = applyTestMode(formattedPhone, testConfig);
        const remoteJid = finalPhone.includes('@') ? finalPhone : `${finalPhone}@s.whatsapp.net`;
        
        console.log('📱 [process-scheduled-messages] Telefone formatado final:', { 
          original: message.phone, 
          afterCleanup: phoneBeforeCountryCode,
          formatted: formattedPhone,
          finalPhone,
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

        // ✅ MELHORADO: Montar URL e payload com delay (igual ao broadcast)
        // Limpar api_url e construir endpoint correto
        let baseUrl = config.api_url.replace(/\/+$/, ''); // Remove trailing slashes
        if (baseUrl.endsWith('/manager')) {
          baseUrl = baseUrl.slice(0, -8); // Remove '/manager' se existir
        }
        
        let evolutionUrl: string;
        let payload: any;

        // ✅ MELHORADO: Processamento de mídia (verificar múltiplos níveis como broadcast)
        const mediaUrl = message.media_url; // Para scheduled_messages, mídia vem direto da mensagem
        const mediaType = message.media_type || 'image';

        // ✅ CORREÇÃO: Codificar nome da instância na URL para suportar caracteres especiais
        const encodedInstanceName = encodeURIComponent(config.instance_name);
        
        if (mediaUrl) {
          evolutionUrl = `${baseUrl}/message/sendMedia/${encodedInstanceName}`;
          payload = {
            number: remoteJid,
            mediatype: mediaType,
            media: mediaUrl,
            caption: message.message || '',
            delay: calculateTypingDelay(message.message || '', mediaType === 'document' ? 'document' : 'media'),
          };
          console.log('🖼️ [process-scheduled-messages] Enviando mensagem com mídia:', {
            to: remoteJid,
            instance: config.instance_name,
            encoded_instance: encodedInstanceName,
            mediaType,
            mediaUrl,
            captionLength: message.message?.length || 0,
          });
        } else {
          evolutionUrl = `${baseUrl}/message/sendText/${encodedInstanceName}`;
          payload = {
            number: remoteJid,
            text: message.message,
            delay: calculateTypingDelay(message.message, 'text'),
          };
          console.log('📝 [process-scheduled-messages] Enviando mensagem de texto:', {
            to: remoteJid,
            instance: config.instance_name,
            encoded_instance: encodedInstanceName,
            messageLength: message.message?.length || 0,
          });
        }

        // ✅ NOVO: Validar tamanho da mensagem antes de enviar
        const messageType = mediaUrl ? (mediaType === 'document' ? 'document' : 'media') : 'text';
        const validation = validateMessageLength(message.message || '', messageType);
        
        if (!validation.valid) {
          console.error(`❌ [process-scheduled-messages] Mensagem muito longa: ${validation.error}`);
          const metrics = getOrCreateMetrics(config.instance_name);
          metrics.messagesFailed++;
          metrics.consecutiveFailures++;
          metrics.lastError = validation.error || 'Mensagem muito longa';
          metrics.lastErrorCode = 'MESSAGE_TOO_LONG';
          
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: validation.error,
            })
            .eq('id', message.id);

          failureCount++;
          continue;
        }

        // ✅ NOVO: Verificar circuit breaker antes de enviar
        if (circuitBreaker.isOpen(config.instance_name)) {
          console.error(`🔴 [process-scheduled-messages] Circuit breaker aberto para instância ${config.instance_name}. Mensagem não será enviada.`);
          
          // Tentar buscar instância de backup da mesma organização
          if (message.organization_id) {
            const { data: backupInstance } = await supabase
              .from('evolution_config')
              .select('id, api_url, api_key, instance_name, is_connected')
              .eq('organization_id', message.organization_id)
              .eq('is_connected', true)
              .neq('id', message.instance_id)
              .limit(1)
              .maybeSingle();

            if (backupInstance) {
              console.log(`✅ [process-scheduled-messages] Usando instância de backup: ${backupInstance.instance_name}`);
              config = backupInstance;
              
              // ✅ CRÍTICO: Reconstruir URL e payload com nova instância
              baseUrl = config.api_url.replace(/\/+$/, '');
              if (baseUrl.endsWith('/manager')) {
                baseUrl = baseUrl.slice(0, -8);
              }
              const encodedInstanceName = encodeURIComponent(config.instance_name);
              
              if (mediaUrl) {
                evolutionUrl = `${baseUrl}/message/sendMedia/${encodedInstanceName}`;
                payload = {
                  number: remoteJid,
                  mediatype: mediaType,
                  media: mediaUrl,
                  caption: message.message || '',
                  delay: calculateTypingDelay(message.message || '', mediaType === 'document' ? 'document' : 'media'),
                };
              } else {
                evolutionUrl = `${baseUrl}/message/sendText/${encodedInstanceName}`;
                payload = {
                  number: remoteJid,
                  text: message.message,
                  delay: calculateTypingDelay(message.message, 'text'),
                };
              }
            } else {
              // Não tem backup, marcar como falha e parar de disparar
              const metrics = getOrCreateMetrics(config.instance_name);
              metrics.messagesFailed++;
              metrics.consecutiveFailures++;
              metrics.lastError = `Instância ${config.instance_name} está quebrada (circuit breaker aberto) e não há instância de backup disponível`;
              metrics.lastErrorCode = 'CIRCUIT_BREAKER_OPEN_NO_BACKUP';
              
              await supabase
                .from('scheduled_messages')
                .update({
                  status: 'failed',
                  error_message: `Instância ${config.instance_name} está quebrada e não há instância de backup disponível. Disparos pausados para esta instância.`,
                })
                .eq('id', message.id);

              failureCount++;
              continue;
            }
          } else {
            // Sem organização, não tem como buscar backup
            const metrics = getOrCreateMetrics(config.instance_name);
            metrics.messagesFailed++;
            metrics.consecutiveFailures++;
            metrics.lastError = `Instância ${config.instance_name} está quebrada (circuit breaker aberto)`;
            metrics.lastErrorCode = 'CIRCUIT_BREAKER_OPEN';
            
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: `Instância ${config.instance_name} está quebrada. Disparos pausados.`,
              })
              .eq('id', message.id);

            failureCount++;
            continue;
          }
        }

        // ✅ NOVO: Rate limiting antes de enviar
        await rateLimiter.checkLimit(config.instance_name);

        // ✅ MELHORADO: Enviar mensagem via Evolution API com timeout e retry
        const metrics = getOrCreateMetrics(config.instance_name);
        const startTime = Date.now();

        let evolutionResponse: Response;
        try {
          // Usar sendWithRetry que já inclui timeout de 90s e retry para 429
          evolutionResponse = await sendWithRetry(
            evolutionUrl,
            payload,
            {
              'Content-Type': 'application/json',
              'apikey': config.api_key || '',
            }
          );
        } catch (error: any) {
          // Se for timeout, registrar e continuar
          if (error.message?.includes('Timeout')) {
            console.error(`⏱️ [process-scheduled-messages] Timeout após 90s para instância ${config.instance_name}`);
            metrics.lastError = error.message.slice(0, 200);
            metrics.lastErrorCode = 'TIMEOUT';
            metrics.messagesFailed++;
            metrics.consecutiveFailures++;
            circuitBreaker.recordFailure(config.instance_name);
            
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: `Timeout após 90 segundos. A mensagem será reprocessada automaticamente.`,
              })
              .eq('id', message.id);

            failureCount++;
            continue;
          }
          throw error;
        }

        const responseTime = Date.now() - startTime;
        metrics.responseTimes.push(responseTime);

        // ✅ NOVO: Capturar código HTTP para métricas
        const httpStatus = evolutionResponse.status;
        if (httpStatus === 200) metrics.http200++;
        else if (httpStatus === 401) metrics.http401++;
        else if (httpStatus === 404) metrics.http404++;
        else if (httpStatus === 429) metrics.http429++; // ✅ NOVO: Rate limit!
        else if (httpStatus >= 500) metrics.http500++;

        const responseText = await evolutionResponse.text();
        let evolutionData: any = null;

        try {
          evolutionData = JSON.parse(responseText);
        } catch {
          // Se não for JSON, tratar como texto
          evolutionData = { raw: responseText };
        }

        // ✅ MELHORADO: Verificar se houve erro na resposta com tratamento de HTTP 429
        if (!evolutionResponse.ok) {
          const errorMessage = typeof evolutionData === 'object' && evolutionData.response?.message
            ? JSON.stringify(evolutionData.response.message)
            : responseText;
          
          // ✅ NOVO: Tratamento especial para HTTP 429 (Rate Limit)
          // Agora já tratado pelo sendWithRetry, mas ainda registrar métricas
          if (httpStatus === 429) {
            metrics.lastError = errorMessage.slice(0, 200);
            metrics.lastErrorCode = 'HTTP_429';
            metrics.messagesFailed++;
            metrics.consecutiveFailures++;
            circuitBreaker.recordFailure(config.instance_name);
            
            console.error(`⏱️ [process-scheduled-messages] Rate limit atingido (429) para instância ${config.instance_name} após retries`);
            
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: `Rate limit atingido (HTTP 429) após 3 tentativas. A mensagem será reprocessada automaticamente.`,
              })
              .eq('id', message.id);

            failureCount++;
            continue; // Pular para próxima mensagem
          }
          
          // ✅ MELHORADO: Tratamento de erro exists: false igual ao send-whatsapp-message
          const responseMessage = evolutionData?.response?.message;
          let isNumberNotExists = false;
          let numberInfo: any = null;
          
          // Verificar se é array de mensagens
          if (Array.isArray(responseMessage) && responseMessage.length > 0) {
            const firstMessage = responseMessage[0];
            if (firstMessage.exists === false) {
              isNumberNotExists = true;
              numberInfo = firstMessage;
            }
          } else if (responseMessage && typeof responseMessage === 'object' && responseMessage.exists === false) {
            // Caso a mensagem seja um objeto único ao invés de array
            isNumberNotExists = true;
            numberInfo = responseMessage;
          }
          
          if (isNumberNotExists && numberInfo) {
            console.warn(`⚠️ [process-scheduled-messages] Evolution API retornou exists: false para ${remoteJid}`);
            console.warn(`⚠️ [process-scheduled-messages] Detalhes:`, {
              number: numberInfo.number || message.phone,
              jid: numberInfo.jid || remoteJid,
              original_phone: message.phone,
              formatted_phone: formattedPhone,
              remote_jid: remoteJid,
              organization: message.organization_id || 'N/A',
              instance: config.instance_name,
              api_url: config.api_url
            });
            
            // ✅ NOVO: Tentar fallback com sendMedia (às vezes é falso positivo)
            // Algumas instâncias da Evolution API retornam exists: false incorretamente para sendText
            // mas funcionam com sendMedia
            console.warn(`⚠️ [process-scheduled-messages] Tentando fallback com sendMedia (às vezes é falso positivo)...`);
            
            try {
              const fallbackUrl = `${baseUrl}/message/sendMedia/${encodeURIComponent(config.instance_name)}`;
              const fallbackPayload = {
                number: remoteJid,
                mediatype: 'text',
                media: '',
                caption: message.message || '',
                delay: calculateTypingDelay(message.message || '', 'text'),
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
                console.log('✅ [process-scheduled-messages] Fallback sendMedia funcionou! (era falso positivo)');
                // Continuar com o fluxo normal de sucesso
                evolutionData = fallbackData;
                // Não fazer continue aqui, deixar continuar o fluxo normal abaixo
              } else {
                // Fallback também falhou, verificar se ainda é exists: false
                const fallbackResponseMsg = fallbackData?.response?.message;
                let fallbackExistsFalse = false;
                
                if (Array.isArray(fallbackResponseMsg) && fallbackResponseMsg.length > 0) {
                  fallbackExistsFalse = fallbackResponseMsg.some((m: any) => m.exists === false);
                } else if (fallbackResponseMsg && typeof fallbackResponseMsg === 'object' && fallbackResponseMsg.exists === false) {
                  fallbackExistsFalse = true;
                }
                
                if (fallbackExistsFalse) {
                  // Realmente não existe, marcar como falha
                  const invalidNumber = Array.isArray(fallbackResponseMsg) 
                    ? fallbackResponseMsg.find((m: any) => m.exists === false)
                    : fallbackResponseMsg;
                  
                  console.error(`❌ [process-scheduled-messages] Número realmente não existe no WhatsApp após fallback: ${invalidNumber?.jid || remoteJid}`);
                  
                  // ✅ NOVO: Registrar falha nas métricas
                  metrics.messagesFailed++;
                  metrics.consecutiveFailures++;
                  metrics.lastError = `Número não existe: ${invalidNumber?.jid || remoteJid}`;
                  metrics.lastErrorCode = 'NUMBER_NOT_EXISTS';
                  
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
              
              // ✅ NOVO: Registrar falha nas métricas
              metrics.messagesFailed++;
              metrics.consecutiveFailures++;
              metrics.lastError = fallbackError.message.slice(0, 200);
              metrics.lastErrorCode = `HTTP_${httpStatus}`;
              
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
            // ✅ NOVO: Registrar erro nas métricas antes de lançar
            metrics.lastError = errorMessage.slice(0, 200);
            metrics.lastErrorCode = `HTTP_${httpStatus}`;
            
            // Outro tipo de erro (não é exists: false), lançar normalmente
            throw new Error(`Evolution API erro ${evolutionResponse.status}: ${errorMessage}`);
          }
        }

        // ✅ NOVO: Registrar sucesso nas métricas
        metrics.messagesSent++;
        metrics.consecutiveFailures = 0; // Resetar contador de falhas
        
        // ✅ NOVO: Registrar sucesso no circuit breaker
        circuitBreaker.recordSuccess(config.instance_name);

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
        
        // ✅ NOVO: Registrar falha nas métricas e circuit breaker
        if (config) {
          const metrics = getOrCreateMetrics(config.instance_name);
          circuitBreaker.recordFailure(config.instance_name);
          metrics.messagesFailed++;
          metrics.consecutiveFailures++;
          if (metrics.consecutiveFailures > metrics.maxConsecutiveFailures) {
            metrics.maxConsecutiveFailures = metrics.consecutiveFailures;
          }
          if (error.message) {
            metrics.lastError = error.message.slice(0, 200);
            // Tentar extrair código de erro
            if (error.message.includes('429')) {
              metrics.http429++;
              metrics.lastErrorCode = 'HTTP_429';
            } else if (error.message.includes('401')) {
              metrics.http401++;
              metrics.lastErrorCode = 'HTTP_401';
            } else if (error.message.includes('404')) {
              metrics.http404++;
              metrics.lastErrorCode = 'HTTP_404';
            } else if (error.message.includes('500')) {
              metrics.http500++;
              metrics.lastErrorCode = 'HTTP_500';
            }
          }
        }
        
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

    // ✅ NOVO: Salvar métricas em batch (igual ao broadcast)
    if (metricsMap.size > 0) {
      console.log(`📊 [process-scheduled-messages] Salvando métricas de ${metricsMap.size} instância(s) em batch...`);
      
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0); // Truncar para hora exata
      const hourBucket = currentHour.toISOString();
      
      // Buscar IDs das instâncias pelo nome
      const instanceNames = Array.from(metricsMap.keys());
      const { data: instances } = await supabase
        .from('evolution_config')
        .select('id, instance_name')
        .in('instance_name', instanceNames);
      
      if (instances && instances.length > 0) {
        const upserts = instances.map(inst => {
          const metrics = metricsMap.get(inst.instance_name);
          if (!metrics) return null;
          
          const avgResponseTime = metrics.responseTimes.length > 0
            ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
            : null;
          
          return {
            instance_id: inst.id,
            hour_bucket: hourBucket,
            messages_sent: metrics.messagesSent,
            messages_failed: metrics.messagesFailed,
            http_200_count: metrics.http200,
            http_401_count: metrics.http401,
            http_404_count: metrics.http404,
            http_429_count: metrics.http429,
            http_500_count: metrics.http500,
            consecutive_failures_max: metrics.maxConsecutiveFailures,
            avg_response_time_ms: avgResponseTime,
            last_error_message: metrics.lastError || null,
            last_error_code: metrics.lastErrorCode || null,
          };
        }).filter(Boolean);
        
        if (upserts.length > 0) {
          // Usar upsert para atualizar ou criar registro
          const { error: metricsError } = await supabase
            .from('instance_health_metrics_hourly')
            .upsert(upserts, {
              onConflict: 'instance_id,hour_bucket',
              ignoreDuplicates: false,
            });
          
          if (metricsError) {
            console.error('⚠️ [process-scheduled-messages] Erro ao salvar métricas (não crítico):', metricsError);
          } else {
            console.log(`✅ [process-scheduled-messages] Métricas salvas: ${upserts.length} registro(s) atualizado(s)`);
          }
        }
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