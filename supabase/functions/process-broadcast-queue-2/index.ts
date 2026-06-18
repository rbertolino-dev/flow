import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classifyBroadcastError } from "../_shared/broadcast-error-classify.ts";
import { isInstanceReadyToSend } from "../_shared/evolution-fetch-instances.ts";

function isConnectionClosedMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("connection closed") || lower.includes("precondition required");
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Disparo em massa 2 — baseline: disparador-2-baseline-2026-03-21 | rollback/disparador-2/README.disparador2 */

/**
 * Substitui todas as tags dinâmicas em uma mensagem de template
 * Suporta: {nome}, {empresa}, {nome_empresa}, {email}, {cpf}, {cnpj}, e campos customizados
 */
function replaceBroadcastTemplateTags(
  template: string,
  contactData: Record<string, string | undefined>
): string {
  let result = template;

  // Mapeamento de tags padrão
  // CRÍTICO: Usar ?? ao invés de || para garantir que null/undefined virem string vazia
  const replacements: Record<string, string> = {
    nome: contactData.nome ?? "",
    // CRÍTICO: Usar ?? para empresa (mesma lógica de nome)
    // Se empresa for null/undefined, tentar nome_empresa, senão string vazia
    empresa: (contactData.empresa ?? contactData.nome_empresa) ?? "",
    nome_empresa: (contactData.nome_empresa ?? contactData.empresa) ?? "",
    email: contactData.email ?? "",
    cpf: contactData.cpf ?? "",
    cnpj: contactData.cnpj ?? "",
  };

  // Adicionar campos customizados
  // CRÍTICO: Usar ?? ao invés de || para garantir que null/undefined virem string vazia
  Object.entries(contactData).forEach(([key, value]) => {
    if (!['nome', 'empresa', 'nome_empresa', 'email', 'cpf', 'cnpj'].includes(key)) {
      replacements[key] = value ?? "";
    }
  });

  // Substituir todas as tags {tag} ou {{tag}}
  result = result.replace(/\{\{?(\w+)\}?\}/gi, (match, key) => {
    const normalizedKey = key.toLowerCase();
    const replacement = replacements[normalizedKey];
    
    // CRÍTICO: Se replacement for undefined, retornar string vazia ao invés de match
    // Isso garante que tags sem dados sejam removidas (não ficam no texto)
    return replacement !== undefined ? replacement : "";
  });

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📡 [process-broadcast-queue-2] Iniciando processamento...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar mensagens agendadas que estão prontas para envio
    // IMPORTANTE: ORDER BY garante ordem consistente e previne processamento duplicado
    const now = new Date().toISOString();
    const { data: queueItems, error: fetchError } = await supabase
      .from("broadcast_queue_2")
      .select(`
        *,
        campaign:broadcast_campaigns_2(
          id,
          status,
          custom_message,
          sending_method,
          instance_id,
          instance_ids,
          message_template:message_templates(content)
        ),
        instance:evolution_config!instance_id(id, api_url, api_key, instance_name, is_connected),
        send_attempts,
        attempted_instance_id
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(200); // Permite primeira onda maior no rotate (ex.: 50+ instâncias)

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
          .from("broadcast_queue_2")
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
    const TRANSIENT_READY_RETRY_LIMIT = 3;
    const markInstanceDisconnected = async (instanceId: string) => {
      const { data: row } = await supabase
        .from("evolution_config")
        .select("is_connected, updated_at")
        .eq("id", instanceId)
        .maybeSingle();
      if (row?.is_connected === false) return;
      const lastMs = row?.updated_at ? new Date(String(row.updated_at)).getTime() : 0;
      if (Date.now() - lastMs < 90000) {
        console.log(
          `[broadcast-queue-2] skip mark disconnected (throttle) id=${instanceId} ageMs=${Date.now() - lastMs}`,
        );
        return;
      }
      await supabase
        .from("evolution_config")
        .update({ is_connected: false, updated_at: new Date().toISOString() })
        .eq("id", instanceId);
    };

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
      try {
        const campaign = item.campaign;
        const instance = item.instance;
        
        if (!campaign) {
          throw new Error("Configuração da campanha inválida");
        }
        
        if (!instance) {
          throw new Error("Instância não configurada para este contato");
        }

        // VERIFICAÇÃO DE SEGURANÇA CRÍTICA: Dupla verificação do status da campanha
        if (campaign.status === 'cancelled' || campaign.status === 'paused') {
          console.log(`🛑 BLOQUEIO DE SEGURANÇA: Campanha ${campaign.id} está ${campaign.status} - mensagem NÃO será enviada`);
          
          await supabase
            .from("broadcast_queue_2")
            .update({
              status: "cancelled",
              error_message: `Bloqueado: campanha ${campaign.status}`,
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
        
        // Aplicar personalização completa de todas as tags
        // Suporta: {nome}, {empresa}, {nome_empresa}, {email}, {cpf}, {cnpj}, e campos customizados
        // IMPORTANTE: item.name pode ser null/undefined, usar ?? para garantir string vazia
        console.log(`🔍 Personalizando mensagem para ${item.phone}:`, {
          name: item.name,
          empresa: item.empresa,
          nome_empresa: item.nome_empresa,
          email: item.email,
          cpf: item.cpf,
          cnpj: item.cnpj,
          custom_fields: item.custom_fields
        });
        
        personalizedMessage = replaceBroadcastTemplateTags(personalizedMessage, {
          nome: item.name ?? "", // Usar ?? para tratar null/undefined
          empresa: item.empresa ?? item.nome_empresa ?? "",
          nome_empresa: item.nome_empresa ?? item.empresa ?? "",
          email: item.email ?? "",
          cpf: item.cpf ?? "",
          cnpj: item.cnpj ?? "",
          // Adicionar campos customizados do JSONB
          ...(item.custom_fields || {}),
        });
        
        console.log(`✅ Mensagem personalizada:`, personalizedMessage.substring(0, 100));

        // Formatar telefone para Evolution API
        // IMPORTANTE: Para LATAM, preservar código do país original (não adicionar 55)
        let formattedPhone = item.phone.replace(/\D/g, ''); // Remove caracteres não numéricos
        
        // Códigos de países LATAM (não adicionar 55 se já tiver código LATAM)
        const latamCountryCodes = ['54', '57', '52', '51', '56', '58', '593', '595', '598', '591', '507', '506', '502', '503', '504', '505'];
        const hasLatamCode = latamCountryCodes.some(code => formattedPhone.startsWith(code));
        
        // Garantir que números brasileiros tenham código do país (55)
        // MAS NÃO adicionar 55 se já tiver código LATAM
        if (!formattedPhone.startsWith('55') && !hasLatamCode && formattedPhone.length >= 10) {
          // Verificar se parece um número brasileiro (DDD válido: 11-99)
          const ddd = parseInt(formattedPhone.substring(0, 2));
          if (ddd >= 11 && ddd <= 99) {
            formattedPhone = '55' + formattedPhone;
            console.log(`➕ Adicionado código do país 55 ao número ${item.phone}`);
          }
        } else if (hasLatamCode) {
          console.log(`🌎 Número LATAM detectado (${formattedPhone.substring(0, 3)}), preservando código do país original`);
        }
        
        // Formatar para WhatsApp (adicionar @s.whatsapp.net se não tiver)
        const whatsappNumber = formattedPhone.includes('@') 
          ? formattedPhone 
          : `${formattedPhone}@s.whatsapp.net`;

        // Limpar api_url e construir endpoint correto usando a instância do item
        let baseUrl = instance.api_url.replace(/\/+$/, ''); // Remove trailing slashes
        if (baseUrl.endsWith('/manager')) {
          baseUrl = baseUrl.slice(0, -8); // Remove '/manager' se existir
        }
        
        const evolutionUrl = `${baseUrl}/message/sendText/${instance.instance_name}`;
        console.log(`📤 Enviando para ${whatsappNumber} via ${instance.instance_name} (${evolutionUrl})`);

        const readyCheck = await isInstanceReadyToSend(
          instance.api_url,
          instance.api_key,
          instance.instance_name,
        );

        if (!readyCheck.ready) {
          console.warn(
            `⚠️ ${instance.instance_name} não pronta para envio (${readyCheck.source}: ${readyCheck.detail ?? "offline"})`,
          );
          if (readyCheck.persistDisconnected) {
            await markInstanceDisconnected(instance.id);
            throw new Error(
              `Instância "${instance.instance_name}" desconectada na Evolution (connectionState direto). Conecte o chip antes do disparo — failover para outro chip desabilitado.`,
            );
          }

          const transientAttempt = (item.send_attempts ?? 0) + 1;
          if (transientAttempt <= TRANSIENT_READY_RETRY_LIMIT) {
            const retryDelaySeconds = Math.min(900, 120 * transientAttempt);
            const retryAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString();
            await supabase
              .from("broadcast_queue_2")
              .update({
                send_attempts: transientAttempt,
                last_attempt_at: new Date().toISOString(),
                scheduled_for: retryAt,
                error_message: `Estado transitório/inconclusivo na Evolution (${readyCheck.source}: ${readyCheck.detail ?? "transient"}). Nova tentativa agendada.`,
              })
              .eq("id", item.id)
              .eq("status", "scheduled");
            console.warn(
              `⏳ ${instance.instance_name} em estado transitório/inconclusivo; item ${item.id} reagendado para ${retryAt}`,
            );
            continue;
          }

          throw new Error(
            `Instância "${instance.instance_name}" sem confirmação de connectionState=open após ${TRANSIENT_READY_RETRY_LIMIT} tentativas. Envio bloqueado para evitar falso positivo.`,
          );
        }

        // Obter métricas da instância
        const metrics = getOrCreateMetrics(instance.instance_name);
        const startTime = Date.now();

        await supabase
          .from("broadcast_queue_2")
          .update({
            send_attempts: (item.send_attempts ?? 0) + 1,
            last_attempt_at: new Date().toISOString(),
            sending_started_at: new Date().toISOString(),
          })
          .eq("id", item.id)
          .eq("status", "scheduled");

        // Enviar mensagem via Evolution API usando credenciais da instância específica
        const evolutionResponse = await fetch(evolutionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            number: whatsappNumber,
            text: personalizedMessage,
          }),
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

          if (isConnectionClosedMessage(errorText)) {
            await markInstanceDisconnected(instance.id);
          }

          throw new Error(`Evolution API error: ${errorText}`);
        }

        // Marcar como enviado - ATOMICIDADE: Só atualiza se ainda estiver 'scheduled'
        // Isso previne que múltiplos workers processem a mesma mensagem
        const { error: updateError, count: updateCount } = await supabase
          .from("broadcast_queue_2")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id)
          .eq("status", "scheduled"); // ✅ ATOMICIDADE: Só atualiza se ainda estiver 'scheduled'

        if (updateError) throw updateError;

        if (updateCount === 0) {
          console.log(`⚠️ Mensagem ${item.id} para ${item.phone} já foi processada por outro worker. Pulando.`);
          continue; // Pular para o próximo item se já foi processado
        }

        // Registrar sucesso nas métricas
        metrics.messagesSent++;
        metrics.consecutiveFailures = 0; // Resetar contador de falhas

        // Atualizar contador da campanha - CONTA DIRETAMENTE DA FILA PARA GARANTIR PRECISÃO
        const { data: sentCount } = await supabase
          .from("broadcast_queue_2")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "sent");

        const { error: campaignUpdateError } = await supabase
          .from("broadcast_campaigns_2")
          .update({
            sent_count: sentCount || 0,
          })
          .eq("id", campaign.id);

        if (campaignUpdateError) console.error("Erro ao atualizar campanha:", campaignUpdateError);

        processed++;
        console.log(`✅ Mensagem enviada para ${item.phone}`);
      } catch (error: any) {
        const errMsg = error?.message ?? String(error);
        console.error(`❌ Erro ao processar ${item.phone}:`, errMsg);

        if (item.instance && isConnectionClosedMessage(errMsg)) {
          await markInstanceDisconnected(item.instance.id);
        }
        
        // Registrar falha nas métricas
        if (item.instance) {
          const metrics = getOrCreateMetrics(item.instance.instance_name);
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

        const classified = classifyBroadcastError(errMsg);

        // Marcar como falha - ATOMICIDADE: Só atualiza se ainda estiver 'scheduled'
        const { count: updateCount } = await supabase
          .from("broadcast_queue_2")
          .update({
            status: "failed",
            error_message: error.message,
            failure_code: classified.code,
            failure_detail: classified.detail || null,
            failed_at: new Date().toISOString(),
          })
          .eq("id", item.id)
          .eq("status", "scheduled"); // ✅ ATOMICIDADE: Só atualiza se ainda estiver 'scheduled'

        if (updateCount === 0) {
          console.log(`⚠️ Mensagem ${item.id} para ${item.phone} já foi processada por outro worker ou não estava 'scheduled'. Pulando atualização de falha.`);
          continue; // Pular para o próximo item se já foi processado
        }

        // Atualizar contador de falhas - CONTA DIRETAMENTE DA FILA PARA GARANTIR PRECISÃO
        const campaign = item.campaign;
        if (campaign) {
          const { data: failedCount } = await supabase
            .from("broadcast_queue_2")
            .select("id", { count: 'exact', head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "failed");

          await supabase
            .from("broadcast_campaigns_2")
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
        .from("broadcast_queue_2")
        .select("id")
        .eq("campaign_id", campaign.id)
        .in("status", ["pending", "scheduled"])
        .limit(1);

      if (!remainingItems || remainingItems.length === 0) {
        // SINCRONIZAÇÃO FINAL: Garantir contadores corretos ao completar
        const { data: finalSentCount } = await supabase
          .from("broadcast_queue_2")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "sent");

        const { data: finalFailedCount } = await supabase
          .from("broadcast_queue_2")
          .select("id", { count: 'exact', head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "failed");

        await supabase
          .from("broadcast_campaigns_2")
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
