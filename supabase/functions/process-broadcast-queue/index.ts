import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateDeduplicationHash } from "../_shared/failover-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📡 [process-broadcast-queue] Iniciando processamento...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar mensagens agendadas que estão prontas para envio
    // ✅ CORREÇÃO CRÍTICA: Excluir mensagens com status "sending" para evitar processamento duplicado
    const now = new Date().toISOString();
    const { data: queueItems, error: fetchError } = await supabase
      .from("broadcast_queue")
      .select(`
        *,
        campaign:broadcast_campaigns(
          id,
          status,
          custom_message,
          image_url,
          media_type,
          message_template:message_templates(content, media_url, media_type),
          instance_id
        ),
        instance:evolution_config(api_url, api_key, instance_name)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .neq("status", "sending") // ✅ CRÍTICO: Excluir mensagens que já estão sendo processadas
      .limit(10); // Processar 10 por vez

    if (fetchError) throw fetchError;

    console.log(`📬 Encontrados ${queueItems?.length || 0} itens para processar`);

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Nenhum item para processar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEGURANÇA EXTRA: Filtrar itens de campanhas canceladas
    const validItems = queueItems.filter(item => {
      if (!item.campaign) {
        console.log(`⚠️ Item ${item.id} sem campanha associada - IGNORADO`);
        return false;
      }
      if (item.campaign.status === 'cancelled') {
        console.log(`🚫 Item ${item.id} de campanha CANCELADA - BLOQUEADO`);
        // Marcar como cancelado imediatamente
        supabase
          .from("broadcast_queue")
          .update({ 
            status: "cancelled",
            error_message: "Campanha foi cancelada"
          })
          .eq("id", item.id);
        return false;
      }
      return true;
    });

    console.log(`✅ ${validItems.length} itens válidos para envio (${queueItems.length - validItems.length} bloqueados por segurança)`);

    if (validItems.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, blocked: queueItems.length, message: "Todos os itens foram bloqueados (campanhas canceladas)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;
    let blocked = queueItems.length - validItems.length;

    // ============================================================================
    // COLETA DE MÉTRICAS DE SAÚDE (OTIMIZADA - ZERO CUSTO ADICIONAL)
    // ============================================================================
    // Acumula métricas em memória durante o processamento
    // Salva em batch ao final (1 write por instância por hora)
    // ============================================================================
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
    const getOrCreateMetrics = (instanceId: string): InstanceMetrics => {
      if (!metricsMap.has(instanceId)) {
        metricsMap.set(instanceId, {
          instanceId,
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
      return metricsMap.get(instanceId)!;
    };

    for (const item of validItems) {
      let instance: any = null; // ✅ Declarar antes do try para estar disponível no catch
      try {
        const campaign = item.campaign;
        
        if (!campaign) {
          throw new Error("Configuração da campanha inválida");
        }

        // ✅ VERIFICAÇÃO CRÍTICA: Verificar se mensagem já foi enviada ANTES de processar
        // Isso previne envios duplicados mesmo se a query inicial não filtrar corretamente
        if (item.status === 'sent') {
          console.log(`⚠️ Item ${item.id} já foi enviado (status: sent) - PULADO`);
          continue;
        }

        // Determinar qual instância usar (failover ou original)
        const activeInstanceId = campaign.instance_id || item.instance_id;
        
        // Buscar instância ativa
        const { data: activeInstance, error: instanceError } = await supabase
          .from("evolution_config")
          .select("id, api_url, api_key, instance_name")
          .eq("id", activeInstanceId)
          .single();

        if (instanceError || !activeInstance) {
          throw new Error(`Instância ${activeInstanceId} não encontrada`);
        }

        instance = activeInstance; // ✅ Atribuir valor
        
        // ✅ CORREÇÃO CRÍTICA: Verificar status novamente antes de processar
        // Isso previne que múltiplas execuções processem a mesma mensagem
        const { data: currentItem } = await supabase
          .from("broadcast_queue")
          .select("status, sending_started_at, processing_lock_until")
          .eq("id", item.id)
          .single();
        
        if (!currentItem) {
          console.log(`⚠️ Item ${item.id} não encontrado - PULADO`);
          continue;
        }
        
        // ✅ CRÍTICO: Verificar se status ainda é "scheduled"
        if (currentItem.status !== 'scheduled') {
          console.log(`⚠️ Item ${item.id} mudou de status (${currentItem.status}) - PULADO`);
          continue;
        }
        
        // ✅ CRÍTICO: Verificar se está lockado (se coluna existir)
        if (currentItem.processing_lock_until) {
          const lockUntil = new Date(currentItem.processing_lock_until);
          if (lockUntil > new Date()) {
            console.log(`⚠️ Item ${item.id} está lockado até ${currentItem.processing_lock_until} - PULADO`);
            continue;
          }
        }
        
        // ✅ CRÍTICO: Verificar se está em "sending" há muito tempo (travado)
        if (currentItem.sending_started_at) {
          const sendingStarted = new Date(currentItem.sending_started_at);
          const timeSinceStart = Date.now() - sendingStarted.getTime();
          // Se está em "sending" há mais de 5 minutos, pode estar travado
          if (timeSinceStart > 5 * 60 * 1000) {
            console.log(`⚠️ Item ${item.id} está em "sending" há ${Math.round(timeSinceStart / 1000)}s - pode estar travado, mas continuando...`);
            // Não pular - pode ser legítimo se envio está demorando
          }
        }

        // Verificar deduplicação
        const messageContent = item.personalized_message || campaign.custom_message || "";
        const deduplicationHash = await generateDeduplicationHash(
          campaign.id,
          item.phone,
          messageContent
        );

        // ✅ CORREÇÃO CRÍTICA: Verificar se já foi enviada (com fallback se coluna não existir)
        // Primeiro, verificar por deduplication_hash se coluna existir
        let existingSent = null;
        try {
          const { data: dedupCheck, error: dedupError } = await supabase
            .from("broadcast_queue")
            .select("id, status")
            .eq("deduplication_hash", deduplicationHash)
            .eq("status", "sent")
            .neq("id", item.id)
            .maybeSingle();

          if (dedupError && !dedupError.message.includes('column') && !dedupError.message.includes('does not exist')) {
            console.error(`Erro ao verificar deduplicação:`, dedupError);
          } else if (dedupCheck) {
            existingSent = dedupCheck;
          }
        } catch (error: any) {
          // Se coluna não existir, ignorar erro e usar fallback
          if (!error.message?.includes('column') && !error.message?.includes('does not exist')) {
            console.error(`Erro ao verificar deduplicação:`, error);
          }
        }
        
        // ✅ FALLBACK: Se deduplication_hash não funcionar, verificar por telefone + campanha + sent_at recente
        if (!existingSent) {
          const { data: phoneCheck } = await supabase
            .from("broadcast_queue")
            .select("id, status, sent_at")
            .eq("phone", item.phone)
            .eq("campaign_id", campaign.id)
            .eq("status", "sent")
            .neq("id", item.id)
            .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24 horas
            .maybeSingle();
          
          if (phoneCheck) {
            existingSent = phoneCheck;
            console.log(`⚠️ Mensagem duplicada detectada por telefone+campanha (sem hash) - ID: ${phoneCheck.id}`);
          }
        }

        if (existingSent) {
          console.log(`⚠️ Mensagem duplicada detectada (hash: ${deduplicationHash.substring(0, 8)}...) - marcando como SENT sem enviar`);
          
          await supabase
            .from("broadcast_queue")
            .update({
              status: "sent",
              deduplication_hash: deduplicationHash,
              sent_at: new Date().toISOString(),
            })
            .eq("id", item.id)
            .eq("status", "scheduled"); // ✅ CRÍTICO: Só atualizar se ainda estiver scheduled

          processed++;
          continue;
        }

        // VERIFICAÇÃO DE SEGURANÇA CRÍTICA: Buscar status mais recente da campanha ANTES de processar
        // Isso garante que mesmo se a campanha foi cancelada durante o processamento, não enviará
        const { data: currentCampaign, error: statusError } = await supabase
          .from("broadcast_campaigns")
          .select("status")
          .eq("id", campaign.id)
          .single();
        
        // Se campanha foi cancelada ou pausada, pular este item
        if (!statusError && currentCampaign && (currentCampaign.status === 'cancelled' || currentCampaign.status === 'paused')) {
          console.log(`🚫 [process-broadcast-queue] Item ${item.id} de campanha ${currentCampaign.status.toUpperCase()} - BLOQUEADO`);
          // Marcar como cancelado imediatamente
          await supabase
            .from("broadcast_queue")
            .update({ 
              status: "cancelled",
              error_message: `Campanha foi ${currentCampaign.status}`
            })
            .eq("id", item.id);
          blocked++;
          continue; // Pular para próximo item
        }
        
        if (statusError) {
          console.error(`Erro ao verificar status da campanha ${campaign.id}:`, statusError);
          throw statusError;
        }
        
        // Usar status mais recente (pode ter mudado desde que o item foi carregado)
        const currentStatus = currentCampaign?.status || campaign.status;
        
        if (currentStatus === 'cancelled' || currentStatus === 'paused') {
          console.log(`🛑 BLOQUEIO DE SEGURANÇA: Campanha ${campaign.id} está ${currentStatus} - mensagem NÃO será enviada`);
          
          await supabase
            .from("broadcast_queue")
            .update({
              status: "cancelled",
              error_message: `Bloqueado: campanha ${currentStatus}`,
            })
            .eq("id", item.id);
          
          blocked++;
          continue; // Pular este item
        }

        // Usar mensagem personalizada se disponível, senão usar mensagem da campanha/template
        let personalizedMessage = item.personalized_message;
        
        if (!personalizedMessage) {
          const message = campaign.custom_message || campaign.message_template?.content || "";
          if (!message) {
            throw new Error("Mensagem não configurada");
          }
          personalizedMessage = message;
        }
        
        // Substituir todas as tags dinâmicas disponíveis
        // Suporta: {nome}, {empresa}, {nome_empresa}, {email}, {cpf}, {cnpj}, e campos customizados
        const replacements: Record<string, string> = {
          nome: item.name || "",
          empresa: item.empresa || "",
          nome_empresa: item.nome_empresa || item.empresa || "",
          email: item.email || "",
          cpf: item.cpf || "",
          cnpj: item.cnpj || "",
        };
        
        // Adicionar campos customizados do JSONB
        if (item.custom_fields && typeof item.custom_fields === 'object') {
          Object.entries(item.custom_fields).forEach(([key, value]) => {
            replacements[key] = String(value || "");
          });
        }
        
        // Aplicar todas as substituições
        const originalMessage = personalizedMessage;
        personalizedMessage = personalizedMessage.replace(/\{(\w+)\}/gi, (match, key) => {
          const normalizedKey = key.toLowerCase();
          return replacements[normalizedKey] !== undefined ? replacements[normalizedKey] : match;
        });
        
        // LOG para debug quando houver tags substituídas
        if (originalMessage !== personalizedMessage) {
          console.log(`🏷️ [process-broadcast-queue] Tags substituídas:`, {
            phone: item.phone,
            original: originalMessage.substring(0, 100),
            personalized: personalizedMessage.substring(0, 100),
            replacements: Object.keys(replacements).filter(k => replacements[k]),
          });
        }

        // ✅ CORREÇÃO CRÍTICA: Atualizar para "sending" de forma ATÔMICA
        // Só atualiza se ainda estiver "scheduled" - previne processamento duplicado
        const sendingStartedAt = new Date().toISOString();
        const lockUntil = new Date(Date.now() + 5 * 60 * 1000); // Lock por 5 minutos
        
        // ✅ CRÍTICO: Atualização atômica - só atualiza se ainda estiver "scheduled"
        // Isso previne que múltiplos processos processem a mesma mensagem
        const { error: sendingUpdateError, data: sendingUpdateResult } = await supabase
          .from("broadcast_queue")
          .update({
            status: "sending",
            deduplication_hash: deduplicationHash,
            // Campos opcionais (serão ignorados se colunas não existirem)
            sending_started_at: sendingStartedAt,
            attempted_instance_id: activeInstanceId,
            send_attempts: (item.send_attempts || 0) + 1,
            last_attempt_at: sendingStartedAt,
            processing_lock_until: lockUntil.toISOString(),
          })
          .eq("id", item.id)
          .eq("status", "scheduled") // ✅ CRÍTICO: Só atualizar se ainda estiver "scheduled"
          .select("id");
        
        // ✅ CRÍTICO: Se não conseguiu atualizar, significa que outro processo já está processando
        if (sendingUpdateError || !sendingUpdateResult || sendingUpdateResult.length === 0) {
          console.log(`⚠️ Item ${item.id} não pôde ser atualizado para "sending" (já foi processado por outro processo ou status mudou) - PULADO`);
          continue;
        }
        
        console.log(`🔒 Item ${item.id} lockado e marcado como "sending" - processando envio...`);

        // Limpar api_url e construir endpoint correto usando a instância do item
        let baseUrl = instance.api_url.replace(/\/+$/, ''); // Remove trailing slashes
        if (baseUrl.endsWith('/manager')) {
          baseUrl = baseUrl.slice(0, -8); // Remove '/manager' se existir
        }
        
        // ✅ CORREÇÃO CRÍTICA: Normalização de telefone igual ao send-whatsapp-message (que funciona)
        console.log('📞 [process-broadcast-queue] Telefone original:', item.phone);
        
        // Remover caracteres não numéricos
        let formattedPhone = item.phone.replace(/\D/g, '');
        
        // Se já tem @, remover o sufixo antes de normalizar
        if (item.phone.includes('@')) {
          formattedPhone = item.phone.split('@')[0].replace(/\D/g, '');
          console.log('🔧 [process-broadcast-queue] Removido sufixo @ do telefone:', formattedPhone);
        }
        
        console.log('🔧 [process-broadcast-queue] Telefone após limpeza:', formattedPhone);
        
        // ✅ CORREÇÃO CRÍTICA: Garantir que números brasileiros tenham código do país (55)
        // Lógica igual ao send-whatsapp-message e process-scheduled-messages
        const phoneBeforeCountryCode = formattedPhone;
        
        // ✅ FORÇAR: Se número tem 11 dígitos e não começa com 55, é brasileiro
        if (!formattedPhone.startsWith('55')) {
          if (formattedPhone.length === 11) {
            // Número brasileiro com DDD (11 dígitos = DDD + 9 dígitos)
            const ddd = parseInt(formattedPhone.substring(0, 2));
            console.log('🔍 [process-broadcast-queue] Verificando DDD:', { ddd, phoneLength: formattedPhone.length });
            
            if (ddd >= 11 && ddd <= 99) {
              formattedPhone = '55' + formattedPhone;
              console.log('➕ [process-broadcast-queue] Adicionado código do país 55 ao número brasileiro:', {
                antes: phoneBeforeCountryCode,
                depois: formattedPhone
              });
            } else {
              console.log('⚠️ [process-broadcast-queue] DDD inválido ou não brasileiro:', ddd);
            }
          } else if (formattedPhone.length >= 10 && formattedPhone.length <= 12) {
            // Pode ser número brasileiro sem DDD ou com formato diferente
            const ddd = parseInt(formattedPhone.substring(0, 2));
            if (ddd >= 11 && ddd <= 99) {
              formattedPhone = '55' + formattedPhone;
              console.log('➕ [process-broadcast-queue] Adicionado código do país 55 (formato alternativo):', {
                antes: phoneBeforeCountryCode,
                depois: formattedPhone
              });
            }
          }
        } else {
          console.log('ℹ️ [process-broadcast-queue] Número já tem código do país:', {
            startsWith55: formattedPhone.startsWith('55'),
            length: formattedPhone.length
          });
        }
        
        // ✅ GARANTIR: Se ainda não tem código do país e tem 11 dígitos, adicionar forçadamente
        if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
          formattedPhone = '55' + formattedPhone;
          console.log('🔧 [process-broadcast-queue] FORÇADO: Adicionado código do país 55 (fallback):', {
            antes: phoneBeforeCountryCode,
            depois: formattedPhone
          });
        }
        
        // Formatar como JID (remoteJid)
        const remoteJid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;
        
        console.log('📱 [process-broadcast-queue] Telefone formatado final:', { 
          original: item.phone, 
          afterCleanup: phoneBeforeCountryCode,
          formatted: formattedPhone,
          remoteJid 
        });
        
        // CRÍTICO: Verificar imagem primeiro no item (pode ter sido definida individualmente),
        // depois na campanha, depois no template da campanha
        // A mensagem personalizada (com tags já substituídas) será usada no caption
        const imageUrl = item.image_url || campaign.image_url || campaign.message_template?.media_url;
        const mediaType = item.media_type || campaign.media_type || campaign.message_template?.media_type || 'image';
        
        // ✅ CORREÇÃO: Codificar nome da instância na URL para suportar caracteres especiais
        const encodedInstanceName = encodeURIComponent(instance.instance_name);
        
        let evolutionUrl: string;
        let payload: any;
        
        if (imageUrl) {
          // Enviar mensagem com imagem usando sendMedia endpoint
          // O caption contém o texto personalizado (com tags já substituídas)
          evolutionUrl = `${baseUrl}/message/sendMedia/${encodedInstanceName}`;
          payload = {
            number: remoteJid, // ✅ CORREÇÃO: Usar telefone normalizado
            mediatype: mediaType,
            media: imageUrl,
            caption: personalizedMessage || '', // CRÍTICO: Usar mensagem personalizada no caption
          };
          console.log(`🖼️ [process-broadcast-queue] Enviando mensagem com mídia:`, {
            to: remoteJid,
            original_phone: item.phone,
            instance: instance.instance_name,
            encoded_instance: encodedInstanceName,
            mediaType,
            imageUrl,
            captionLength: personalizedMessage?.length || 0,
            captionPreview: personalizedMessage?.substring(0, 50) || '',
          });
        } else {
          // Enviar mensagem de texto simples
          evolutionUrl = `${baseUrl}/message/sendText/${encodedInstanceName}`;
          payload = {
            number: remoteJid, // ✅ CORREÇÃO: Usar telefone normalizado
            text: personalizedMessage, // Mensagem personalizada (com tags já substituídas)
          };
          console.log(`📝 [process-broadcast-queue] Enviando mensagem de texto:`, {
            to: remoteJid,
            original_phone: item.phone,
            instance: instance.instance_name,
            encoded_instance: encodedInstanceName,
            messageLength: personalizedMessage?.length || 0,
            messagePreview: personalizedMessage?.substring(0, 50) || '',
          });
        }

        // Obter métricas da instância
        const metrics = getOrCreateMetrics(instance.instance_name);
        const startTime = Date.now();

        // Enviar mensagem via Evolution API usando credenciais da instância específica
        const evolutionResponse = await fetch(evolutionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify(payload),
        });

        const responseTime = Date.now() - startTime;
        metrics.responseTimes.push(responseTime);

        // Capturar código HTTP para métricas
        const httpStatus = evolutionResponse.status;
        if (httpStatus === 200) metrics.http200++;
        else if (httpStatus === 401) metrics.http401++;
        else if (httpStatus === 404) metrics.http404++;
        else if (httpStatus === 429) metrics.http429++; // Rate limit!
        else if (httpStatus >= 500) metrics.http500++;

        if (!evolutionResponse.ok) {
          const errorText = await evolutionResponse.text();
          metrics.lastError = errorText.slice(0, 200); // Limitar tamanho
          metrics.lastErrorCode = `HTTP_${httpStatus}`;
          throw new Error(`Evolution API error: ${errorText}`);
        }

        // ✅ CORREÇÃO CRÍTICA: Marcar como enviado de forma atômica
        // Usar .in("status", ["scheduled", "sending"]) para garantir que só atualiza se ainda estiver em processamento
        // Isso previne envios duplicados mesmo se múltiplas execuções tentarem processar
        const { error: updateError, data: updateResult } = await supabase
          .from("broadcast_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            deduplication_hash: deduplicationHash, // ✅ Salvar hash para deduplicação futura
            processing_lock_until: null, // ✅ Liberar lock após envio bem-sucedido
          })
          .eq("id", item.id)
          .in("status", ["scheduled", "sending"]) // ✅ CRÍTICO: Apenas atualizar se ainda estiver em processamento
          .select("id");

        // ✅ CRÍTICO: Se não atualizou (já estava com outro status), verificar se já foi enviado
        if (updateError || !updateResult || updateResult.length === 0) {
          console.log(`⚠️ Item ${item.id} não pôde ser atualizado para "sent" (status já mudou) - verificando...`);
          
          // ✅ VERIFICAÇÃO ADICIONAL: Verificar se mensagem já foi enviada por outro processo
          const { data: finalCheck } = await supabase
            .from("broadcast_queue")
            .select("status, sent_at")
            .eq("id", item.id)
            .single();
          
          if (finalCheck?.status === 'sent' && finalCheck?.sent_at) {
            console.log(`✅ Item ${item.id} já foi marcado como enviado por outro processo - OK`);
            processed++;
            continue;
          } else {
            console.log(`❌ Item ${item.id} não foi enviado mas também não pôde ser atualizado - possível race condition`);
            // Continuar para não contar como processado (mensagem já foi enviada, mas status não atualizou)
            continue;
          }
        }

        // Registrar sucesso nas métricas
        metrics.messagesSent++;
        metrics.consecutiveFailures = 0; // Resetar contador de falhas

        // ✅ CORREÇÃO CRÍTICA: Atualizar contador da campanha de forma mais eficiente
        // Usar incremento ao invés de contar toda a fila (mais rápido e preciso)
        // Mas como não temos RPC, vamos contar apenas uma vez por execução em batch
        // O contador será atualizado no final do processamento de todas as mensagens desta campanha

        processed++;
        console.log(`✅ Mensagem enviada para ${item.phone}`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar ${item.phone}:`, error.message);
        
        // Registrar falha nas métricas
        if (instance) {
          const metrics = getOrCreateMetrics(instance.instance_name);
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
        
        // ✅ CORREÇÃO CRÍTICA: Marcar como falha de forma atômica
        // Só atualiza se ainda estiver em "sending" ou "scheduled" - previne que mensagem fique travada
        await supabase
          .from("broadcast_queue")
          .update({
            status: "failed",
            error_message: error.message,
            processing_lock_until: null, // ✅ Liberar lock em caso de erro
          })
          .eq("id", item.id)
          .in("status", ["scheduled", "sending"]); // ✅ CRÍTICO: Só atualizar se ainda estiver em processamento

        // Atualizar contador de falhas - CONTA DIRETAMENTE DA FILA PARA GARANTIR PRECISÃO
        const campaign = item.campaign;
        if (campaign) {
          const { data: failedCount } = await supabase
            .from("broadcast_queue")
            .select("id", { count: 'exact', head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "failed");

          await supabase
            .from("broadcast_campaigns")
            .update({
              failed_count: failedCount || 0,
            })
            .eq("id", campaign.id);
        }

        failed++;
      }
    }

    // ✅ CORREÇÃO CRÍTICA: Atualizar contadores de campanhas processadas em batch
    // Agrupar por campaign_id para atualizar cada campanha apenas uma vez
    const campaignsToUpdate = new Map<string, { campaign: any }>();
    for (const item of validItems) {
      if (item.campaign) {
        campaignsToUpdate.set(item.campaign.id, { campaign: item.campaign });
      }
    }

    // Atualizar contadores de cada campanha processada
    for (const [campaignId, { campaign }] of campaignsToUpdate) {
      const { data: sentCount } = await supabase
        .from("broadcast_queue")
        .select("id", { count: 'exact', head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "sent");

      const { data: failedCount } = await supabase
        .from("broadcast_queue")
        .select("id", { count: 'exact', head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      const { error: campaignUpdateError } = await supabase
        .from("broadcast_campaigns")
        .update({
          sent_count: sentCount || 0,
          failed_count: failedCount || 0,
        })
        .eq("id", campaignId);

      if (campaignUpdateError) {
        console.error(`Erro ao atualizar contadores da campanha ${campaignId}:`, campaignUpdateError);
      } else {
        console.log(`✅ Contadores atualizados: Campanha ${campaignId} - ${sentCount || 0} enviados, ${failedCount || 0} falhas`);
      }
    }

    // ============================================================================
    // SALVAR MÉTRICAS EM BATCH (1 WRITE POR INSTÂNCIA POR HORA)
    // ============================================================================
    if (metricsMap.size > 0) {
      console.log(`📊 Salvando métricas de ${metricsMap.size} instância(s) em batch...`);
      
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0); // Truncar para hora exata
      const hourBucket = currentHour.toISOString();
      
      // Buscar IDs das instâncias pelo nome
      const instanceNames = Array.from(metricsMap.keys());
      const { data: instances } = await supabase
        .from("evolution_config")
        .select("id, instance_name")
        .in("instance_name", instanceNames);
      
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
            .from("instance_health_metrics_hourly")
            .upsert(upserts, {
              onConflict: "instance_id,hour_bucket",
              ignoreDuplicates: false,
            });
          
          if (metricsError) {
            console.error("⚠️ Erro ao salvar métricas (não crítico):", metricsError);
          } else {
            console.log(`✅ Métricas salvas: ${upserts.length} registro(s) atualizado(s)`);
          }
        }
      }
    }

    // Verificar se campanhas foram concluídas
    for (const [campaignId, { campaign }] of campaignsToUpdate) {

      const { data: remainingItems } = await supabase
        .from("broadcast_queue")
        .select("id")
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "scheduled"])
        .limit(1);

      if (!remainingItems || remainingItems.length === 0) {
        // SINCRONIZAÇÃO FINAL: Garantir contadores corretos ao completar
        const { data: finalSentCount } = await supabase
          .from("broadcast_queue")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaignId)
          .eq("status", "sent");

        const { data: finalFailedCount } = await supabase
          .from("broadcast_queue")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaignId)
          .eq("status", "failed");

        await supabase
          .from("broadcast_campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            sent_count: finalSentCount || 0,
            failed_count: finalFailedCount || 0,
          })
          .eq("id", campaignId);

        console.log(`🎉 Campanha ${campaignId} concluída - ${finalSentCount} enviados, ${finalFailedCount} falhas`);
      }
    }

    console.log(`✨ Processamento concluído: ${processed} enviados, ${failed} falhas, ${blocked} bloqueados`);

    return new Response(
      JSON.stringify({ processed, failed, blocked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});