import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Função auxiliar para gerar delay aleatório entre min e max
 */
function getRandomDelay(minSeconds: number, maxSeconds: number): number {
  const min = Math.min(minSeconds, maxSeconds);
  const max = Math.max(minSeconds, maxSeconds);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📅 [process-scheduled-campaigns] Iniciando verificação de campanhas agendadas...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar campanhas agendadas que devem iniciar agora
    const now = new Date().toISOString();
    const { data: scheduledCampaigns, error: fetchError } = await supabase
      .from("broadcast_campaigns")
      .select("id, name, min_delay_seconds, max_delay_seconds, sending_method, instance_id")
      .eq("status", "draft")
      .not("scheduled_start_at", "is", null)
      .lte("scheduled_start_at", now)
      .limit(10); // Processar no máximo 10 campanhas por vez

    if (fetchError) {
      console.error("❌ Erro ao buscar campanhas agendadas:", fetchError);
      throw fetchError;
    }

    console.log(`📋 Encontradas ${scheduledCampaigns?.length || 0} campanha(s) para iniciar`);

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Nenhuma campanha agendada para iniciar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    // Processar cada campanha agendada
    for (const campaign of scheduledCampaigns) {
      try {
        console.log(`🚀 Iniciando campanha agendada: ${campaign.name} (${campaign.id})`);

        // Buscar itens pendentes da fila
        const { data: queueItems, error: queueError } = await supabase
          .from("broadcast_queue")
          .select("*")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending")
          .order("instance_id", { ascending: true })
          .order("created_at", { ascending: true });

        if (queueError) {
          console.error(`❌ Erro ao buscar fila da campanha ${campaign.id}:`, queueError);
          throw queueError;
        }

        if (!queueItems || queueItems.length === 0) {
          console.log(`⚠️ Campanha ${campaign.id} não tem itens pendentes - marcando como running`);
          // Atualizar status mesmo sem itens (pode ter sido cancelada ou já processada)
          await supabase
            .from("broadcast_campaigns")
            .update({
              status: "running",
              started_at: new Date().toISOString(),
              scheduled_start_at: null, // Limpar agendamento após iniciar
            })
            .eq("id", campaign.id);
          processed++;
          continue;
        }

        console.log(`📬 Encontrados ${queueItems.length} itens pendentes para agendar`);

        const nowDate = new Date();
        const minDelay = campaign.min_delay_seconds || 30;
        const maxDelay = campaign.max_delay_seconds || 60;

        // Verificar se é modo "separate" (múltiplas instâncias com mesmo número de mensagens)
        const uniqueInstances = new Set(queueItems.map((item: any) => item.instance_id));
        const messagesPerInstance = new Map<string, number>();
        queueItems.forEach((item: any) => {
          messagesPerInstance.set(item.instance_id, (messagesPerInstance.get(item.instance_id) || 0) + 1);
        });
        const counts = Array.from(messagesPerInstance.values());
        const allSameCount = counts.length > 0 && counts.every(count => count === counts[0]);
        const isSeparate = allSameCount && uniqueInstances.size > 1;

        // Preparar updates em batch
        const batchUpdates: Array<{ id: string; scheduled_for: string }> = [];

        if (isSeparate) {
          // Modo SEPARATE: Cada instância começa ao mesmo tempo, com sua própria fila independente
          const instancesMap = new Map<string, any[]>();
          queueItems.forEach((item: any) => {
            if (!instancesMap.has(item.instance_id)) {
              instancesMap.set(item.instance_id, []);
            }
            instancesMap.get(item.instance_id)!.push(item);
          });

          instancesMap.forEach((itemsForInstance) => {
            let instanceScheduledTime = new Date(nowDate); // Todas começam ao mesmo tempo

            itemsForInstance.forEach((item: any) => {
              const randomDelaySeconds = getRandomDelay(minDelay, maxDelay);
              const randomDelayMs = randomDelaySeconds * 1000;
              const scheduledTime = new Date(instanceScheduledTime.getTime() + randomDelayMs);

              batchUpdates.push({
                id: item.id,
                scheduled_for: scheduledTime.toISOString(),
              });

              instanceScheduledTime = new Date(scheduledTime);
            });
          });
        } else {
          // Modo SINGLE ou ROTATE: Fila sequencial normal
          let currentScheduledTime = new Date(nowDate);

          for (const item of queueItems) {
            const randomDelaySeconds = getRandomDelay(minDelay, maxDelay);
            const randomDelayMs = randomDelaySeconds * 1000;
            const scheduledTime = new Date(currentScheduledTime.getTime() + randomDelayMs);

            batchUpdates.push({
              id: item.id,
              scheduled_for: scheduledTime.toISOString(),
            });

            currentScheduledTime = new Date(scheduledTime);
          }
        }

        // Executar updates em batch
        const BATCH_SIZE = 50;
        for (let i = 0; i < batchUpdates.length; i += BATCH_SIZE) {
          const batch = batchUpdates.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(update =>
            supabase
              .from("broadcast_queue")
              .update({
                status: "scheduled",
                scheduled_for: update.scheduled_for,
              })
              .eq("id", update.id)
          );
          await Promise.all(batchPromises);
        }

        // Atualizar status da campanha
        const { error: updateError } = await supabase
          .from("broadcast_campaigns")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
            scheduled_start_at: null, // Limpar agendamento após iniciar
          })
          .eq("id", campaign.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar campanha ${campaign.id}:`, updateError);
          throw updateError;
        }

        console.log(`✅ Campanha ${campaign.name} iniciada com sucesso - ${queueItems.length} mensagens agendadas`);
        processed++;
      } catch (error: any) {
        console.error(`❌ Erro ao processar campanha ${campaign.id}:`, error);
        failed++;
        // Continuar com próxima campanha mesmo se esta falhar
      }
    }

    console.log(`✨ Processamento concluído: ${processed} campanhas iniciadas, ${failed} falhas`);

    return new Response(
      JSON.stringify({ processed, failed, message: `${processed} campanha(s) iniciada(s) com sucesso` }),
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
