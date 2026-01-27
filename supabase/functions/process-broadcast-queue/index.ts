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
          message_template:message_templates(content, image_url, media_type),
          current_active_instance_id,
          instance_id
        ),
        instance:evolution_config(api_url, api_key, instance_name)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
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
      let instance: any = null;
      try {
        const campaign = item.campaign;
        
        if (!campaign) {
          throw new Error("Configuração da campanha inválida");
        }

        // ✅ VERIFICAÇÃO CRÍTICA 1: Verificar status atual ANTES de processar
        // Buscar status mais recente do item (pode ter mudado desde que foi carregado)
        const { data: currentItem, error: currentItemError } = await supabase
          .from("broadcast_queue")
          .select("id, status, processing_lock_until")
          .eq("id", item.id)
          .single();

        if (currentItemError || !currentItem) {
          console.log(`⚠️ Item ${item.id} não encontrado ou erro ao buscar - PULADO`);
          continue;
        }

        // Se status mudou, pular
        if (currentItem.status !== 'scheduled') {
          console.log(`⚠️ Item ${item.id} mudou de status (${currentItem.status}) - PULADO`);
          continue;
        }

        // Verificar lock de processamento (evitar processamento concorrente)
        if (currentItem.processing_lock_until) {
          const lockUntil = new Date(currentItem.processing_lock_until);
          if (lockUntil > new Date()) {
            console.log(`🔒 Item ${item.id} está lockado até ${lockUntil.toISOString()} - PULADO`);
            continue;
          }
        }

        // ✅ VERIFICAÇÃO CRÍTICA 2: Verificar se já existe outra mensagem para o mesmo telefone + campanha + instância
        // que está sendo processada ou já foi enviada (previne duplicação)
        const { data: duplicateCheck } = await supabase
          .from("broadcast_queue")
          .select("id, status, sent_at")
          .eq("phone", item.phone)
          .eq("campaign_id", campaign.id)
          .eq("instance_id", item.instance_id)
          .in("status", ["sending", "sent"])
          .neq("id", item.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (duplicateCheck) {
          // Se já foi enviada nas últimas 24 horas, cancelar esta
          if (duplicateCheck.status === "sent" && duplicateCheck.sent_at) {
            const sentAt = new Date(duplicateCheck.sent_at);
            const hoursSinceSent = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceSent < 24) {
              console.log(`⚠️ [DUPLICAÇÃO] Mensagem já foi ENVIADA para ${item.phone} (campanha ${campaign.id}, instância ${item.instance_id}) há ${Math.round(hoursSinceSent * 60)} minutos - CANCELANDO`);
              
              await supabase
                .from("broadcast_queue")
                .update({
                  status: "cancelled",
                  error_message: `Duplicata cancelada. Mensagem (ID: ${duplicateCheck.id}) já foi enviada para este telefone.`
                })
                .eq("id", item.id)
                .eq("status", "scheduled");
              
              blocked++;
              continue;
            }
          }
          
          // Se está sendo enviada agora, cancelar esta
          if (duplicateCheck.status === "sending") {
            console.log(`⚠️ [DUPLICAÇÃO] Outra mensagem está SENDO ENVIADA para ${item.phone} (campanha ${campaign.id}, instância ${item.instance_id}) - CANCELANDO`);
            
            await supabase
              .from("broadcast_queue")
              .update({
                status: "cancelled",
                error_message: `Duplicata cancelada. Mensagem (ID: ${duplicateCheck.id}) está sendo enviada agora.`
              })
              .eq("id", item.id)
              .eq("status", "scheduled");
            
            blocked++;
            continue;
          }
        }

        // Determinar qual instância usar (failover ou original)
        const activeInstanceId = campaign.current_active_instance_id || campaign.instance_id || item.instance_id;
        
        // Buscar instância ativa
        const { data: activeInstance, error: instanceError } = await supabase
          .from("evolution_config")
          .select("id, api_url, api_key, instance_name")
          .eq("id", activeInstanceId)
          .single();

        if (instanceError || !activeInstance) {
          throw new Error(`Instância ${activeInstanceId} não encontrada`);
        }

        instance = activeInstance;
        
        // ✅ VERIFICAÇÃO CRÍTICA 3: Adquirir lock de processamento de forma ATÔMICA
        // Só atualiza se ainda estiver "scheduled" e não lockado
        const lockUntil = new Date(Date.now() + 60 * 1000);
        const { error: lockError, data: lockResult } = await supabase
          .from("broadcast_queue")
          .update({ processing_lock_until: lockUntil.toISOString() })
          .eq("id", item.id)
          .eq("status", "scheduled") // ✅ CRÍTICO: Só atualizar se ainda estiver scheduled
          .is("processing_lock_until", null) // ✅ CRÍTICO: Apenas se não estiver lockado
          .select("id");

        if (lockError || !lockResult || lockResult.length === 0) {
          console.log(`⚠️ Item ${item.id} não pôde adquirir lock (status mudou ou já lockado) - PULADO`);
          continue;
        }

        // Verificar deduplicação por hash (se coluna existir)
        const messageContent = item.personalized_message || campaign.custom_message || "";
        let deduplicationHash: string | null = null;
        let existingSent: any = null;

        try {
          deduplicationHash = await generateDeduplicationHash(
            campaign.id,
            item.phone,
            messageContent
          );

          // Verificar se já foi enviada por hash
          const { data: dedupCheck, error: dedupError } = await supabase
            .from("broadcast_queue")
            .select("id, status")
            .eq("deduplication_hash", deduplicationHash)
            .eq("status", "sent")
            .neq("id", item.id)
            .maybeSingle();

          if (dedupError) {
            // Se coluna não existir, ignorar erro
            if (!dedupError.message?.includes('column') && !dedupError.message?.includes('does not exist')) {
              console.error(`Erro ao verificar deduplicação:`, dedupError);
            }
          } else if (dedupCheck) {
            existingSent = dedupCheck;
          }
        } catch (hashError: any) {
          // Se função não existir, continuar sem hash
          if (!hashError.message?.includes('generateDeduplicationHash')) {
            console.error(`Erro ao gerar hash:`, hashError);
          }
        }

        if (existingSent) {
          console.log(`⚠️ Mensagem duplicada detectada (hash: ${deduplicationHash?.substring(0, 8) || 'N/A'}...) - marcando como SENT sem enviar`);
          
          await supabase
            .from("broadcast_queue")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              processing_lock_until: null,
              ...(deduplicationHash && { deduplication_hash: deduplicationHash }),
            })
            .eq("id", item.id)
            .eq("status", "scheduled");

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

        // ✅ VERIFICAÇÃO CRÍTICA 4: Atualizar para "sending" de forma ATÔMICA
        // Só atualiza se ainda estiver "scheduled" - previne processamento duplicado
        const sendingStartedAt = new Date().toISOString();
        const updateData: any = {
          status: "sending",
        };

        // Adicionar campos opcionais apenas se existirem
        if (deduplicationHash) {
          try {
            updateData.deduplication_hash = deduplicationHash;
          } catch (e) {
            // Ignora se coluna não existir
          }
        }
        try {
          updateData.sending_started_at = sendingStartedAt;
        } catch (e) {
          // Ignora se coluna não existir
        }
        try {
          updateData.attempted_instance_id = activeInstanceId;
        } catch (e) {
          // Ignora se coluna não existir
        }
        try {
          updateData.send_attempts = (item.send_attempts || 0) + 1;
        } catch (e) {
          // Ignora se coluna não existir
        }
        try {
          updateData.last_attempt_at = sendingStartedAt;
        } catch (e) {
          // Ignora se coluna não existir
        }

        const { error: sendingUpdateError, data: sendingUpdateResult } = await supabase
          .from("broadcast_queue")
          .update(updateData)
          .eq("id", item.id)
          .eq("status", "scheduled") // ✅ CRÍTICO: Só atualizar se ainda estiver scheduled
          .select("id");

        if (sendingUpdateError || !sendingUpdateResult || sendingUpdateResult.length === 0) {
          console.log(`⚠️ Item ${item.id} não pôde ser atualizado para "sending" (status mudou) - PULADO`);
          continue; // Pular para o próximo item se não conseguiu atualizar
        }

        // Limpar api_url e construir endpoint correto usando a instância do item
        let baseUrl = instance.api_url.replace(/\/+$/, ''); // Remove trailing slashes
        if (baseUrl.endsWith('/manager')) {
          baseUrl = baseUrl.slice(0, -8); // Remove '/manager' se existir
        }
        
        // CRÍTICO: Verificar imagem primeiro no item (pode ter sido definida individualmente),
        // depois na campanha, depois no template da campanha
        // A mensagem personalizada (com tags já substituídas) será usada no caption
        const imageUrl = item.image_url || campaign.image_url || campaign.message_template?.image_url;
        const mediaType = item.media_type || campaign.media_type || campaign.message_template?.media_type || 'image';
        
        let evolutionUrl: string;
        let payload: any;
        
        if (imageUrl) {
          // Enviar mensagem com imagem usando sendMedia endpoint
          // O caption contém o texto personalizado (com tags já substituídas)
          evolutionUrl = `${baseUrl}/message/sendMedia/${instance.instance_name}`;
          payload = {
            number: item.phone,
            mediatype: mediaType,
            media: imageUrl,
            caption: personalizedMessage || '', // CRÍTICO: Usar mensagem personalizada no caption
          };
          console.log(`🖼️ [process-broadcast-queue] Enviando mensagem com mídia:`, {
            to: item.phone,
            instance: instance.instance_name,
            mediaType,
            imageUrl,
            captionLength: personalizedMessage?.length || 0,
            captionPreview: personalizedMessage?.substring(0, 50) || '',
          });
        } else {
          // Enviar mensagem de texto simples
          evolutionUrl = `${baseUrl}/message/sendText/${instance.instance_name}`;
          payload = {
            number: item.phone,
            text: personalizedMessage, // Mensagem personalizada (com tags já substituídas)
          };
          console.log(`📝 [process-broadcast-queue] Enviando mensagem de texto:`, {
            to: item.phone,
            instance: instance.instance_name,
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

        // ✅ VERIFICAÇÃO CRÍTICA 5: Marcar como enviado de forma ATÔMICA
        // Só atualiza se ainda estiver "scheduled" ou "sending" - previne atualização duplicada
        const { error: updateError, data: updateResult } = await supabase
          .from("broadcast_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            processing_lock_until: null, // Liberar lock
            ...(deduplicationHash && { deduplication_hash: deduplicationHash }),
          })
          .eq("id", item.id)
          .in("status", ["scheduled", "sending"]) // ✅ CRÍTICO: Apenas atualizar se ainda estiver em processamento
          .select("id");

        if (updateError) throw updateError;
        
        if (!updateResult || updateResult.length === 0) {
          console.log(`⚠️ Item ${item.id} não pôde ser atualizado para "sent" (status mudou) - já foi processado`);
          continue; // Pular se não conseguiu atualizar (já foi processado por outro worker)
        }

        // Registrar sucesso nas métricas
        metrics.messagesSent++;
        metrics.consecutiveFailures = 0; // Resetar contador de falhas

        // Atualizar contador da campanha - CONTA DIRETAMENTE DA FILA PARA GARANTIR PRECISÃO
        const { data: sentCount } = await supabase
          .from("broadcast_queue")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "sent");

        const { error: campaignUpdateError } = await supabase
          .from("broadcast_campaigns")
          .update({
            sent_count: sentCount || 0,
          })
          .eq("id", campaign.id);

        if (campaignUpdateError) console.error("Erro ao atualizar campanha:", campaignUpdateError);

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
        
        // ✅ VERIFICAÇÃO CRÍTICA 6: Marcar como falha de forma ATÔMICA
        // Só atualiza se ainda estiver "scheduled" ou "sending"
        await supabase
          .from("broadcast_queue")
          .update({
            status: "failed",
            error_message: error.message,
            processing_lock_until: null, // Liberar lock
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
    for (const item of queueItems) {
      const campaign = item.campaign;
      if (!campaign) continue;

      const { data: remainingItems } = await supabase
        .from("broadcast_queue")
        .select("id")
        .eq("campaign_id", campaign.id)
        .in("status", ["pending", "scheduled"])
        .limit(1);

      if (!remainingItems || remainingItems.length === 0) {
        // SINCRONIZAÇÃO FINAL: Garantir contadores corretos ao completar
        const { data: finalSentCount } = await supabase
          .from("broadcast_queue")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "sent");

        const { data: finalFailedCount } = await supabase
          .from("broadcast_queue")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "failed");

        await supabase
          .from("broadcast_campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            sent_count: finalSentCount || 0,
            failed_count: finalFailedCount || 0,
          })
          .eq("id", campaign.id);

        console.log(`🎉 Campanha ${campaign.id} concluída - ${finalSentCount} enviados, ${finalFailedCount} falhas`);
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
