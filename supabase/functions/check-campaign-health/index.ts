import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkInstanceHealth,
  calculateErrorRate,
  canAutoFailover,
  canReturnToPrimary,
  calculateCooldownMinutes,
  type HealthCheckResult,
} from "../_shared/failover-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🏥 [check-campaign-health] Iniciando verificação de saúde...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar campanhas RUNNING com failover habilitado
    const { data: campaigns, error: campaignsError } = await supabase
      .from("broadcast_campaigns")
      .select(`
        id,
        instance_id,
        backup_instance_id,
        failover_enabled,
        failover_mode,
        current_active_instance_id,
        primary_failure_count,
        failover_cooldown_until,
        failover_count,
        last_health_check_at,
        organization_id
      `)
      .eq("status", "running")
      .eq("failover_enabled", true);

    if (campaignsError) {
      throw campaignsError;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("✅ Nenhuma campanha RUNNING com failover habilitado");
      return new Response(
        JSON.stringify({ checked: 0, message: "Nenhuma campanha para verificar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Verificando ${campaigns.length} campanha(s)...`);

    let checked = 0;
    let failovers = 0;
    let returnsToPrimary = 0;

    for (const campaign of campaigns) {
      try {
        checked++;

        // Buscar instância PRIMARY
        const { data: primaryInstance, error: primaryError } = await supabase
          .from("evolution_config")
          .select("id, api_url, api_key, instance_name, is_connected")
          .eq("id", campaign.instance_id)
          .single();

        if (primaryError || !primaryInstance) {
          console.warn(`⚠️ Instância PRIMARY não encontrada para campanha ${campaign.id}`);
          continue;
        }

        // Health check da PRIMARY
        const primaryHealth: HealthCheckResult = await checkInstanceHealth(
          primaryInstance.api_url,
          primaryInstance.api_key,
          primaryInstance.instance_name
        );

        // Calcular taxa de erro da PRIMARY
        const primaryErrorRate = await calculateErrorRate(
          supabase,
          campaign.instance_id,
          campaign.organization_id,
          5 // últimos 5 minutos
        );

        // Atualizar contador de falhas
        let newFailureCount = campaign.primary_failure_count || 0;
        if (!primaryHealth.isHealthy) {
          newFailureCount++;
        } else {
          newFailureCount = 0; // Resetar se saudável
        }

        // Atualizar timestamp do último health check
        await supabase
          .from("broadcast_campaigns")
          .update({
            primary_failure_count: newFailureCount,
            last_health_check_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);

        // Verificar se precisa fazer failover para BACKUP
        if (canAutoFailover(campaign, primaryHealth, newFailureCount, primaryErrorRate)) {
          console.log(`🔄 Failover necessário para campanha ${campaign.id}`);

          // Buscar instância BACKUP
          const { data: backupInstance, error: backupError } = await supabase
            .from("evolution_config")
            .select("id, api_url, api_key, instance_name, is_connected")
            .eq("id", campaign.backup_instance_id)
            .single();

          if (backupError || !backupInstance) {
            console.error(`❌ Instância BACKUP não encontrada para campanha ${campaign.id}`);
            continue;
          }

          // Health check da BACKUP
          const backupHealth = await checkInstanceHealth(
            backupInstance.api_url,
            backupInstance.api_key,
            backupInstance.instance_name
          );

          if (!backupHealth.isHealthy) {
            console.error(`❌ BACKUP também está DOWN para campanha ${campaign.id}. Pausando campanha.`);
            
            // Pausar campanha se ambas instâncias estão down
            await supabase
              .from("broadcast_campaigns")
              .update({ status: "paused" })
              .eq("id", campaign.id);

            // Registrar log de erro crítico
            await supabase
              .from("broadcast_failover_logs")
              .insert({
                campaign_id: campaign.id,
                organization_id: campaign.organization_id,
                from_instance_id: campaign.instance_id,
                to_instance_id: campaign.backup_instance_id,
                failover_type: "auto",
                reason: "both_instances_down",
                failure_details: {
                  primary_health: primaryHealth,
                  backup_health: backupHealth,
                },
              });

            continue;
          }

          // Executar failover
          const cooldownMinutes = calculateCooldownMinutes(campaign.failover_count || 0);
          const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

          // Contar itens da fila no momento da troca
          const { count: pendingCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "pending");

          const { count: sendingCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "sending");

          const { count: sentCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "sent");

          const { count: failedCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "failed");

          // Atualizar campanha para usar BACKUP
          await supabase
            .from("broadcast_campaigns")
            .update({
              current_active_instance_id: campaign.backup_instance_id,
              last_failover_at: new Date().toISOString(),
              failover_cooldown_until: cooldownUntil.toISOString(),
              primary_failure_count: 0, // Resetar após failover
              failover_count: (campaign.failover_count || 0) + 1,
            })
            .eq("id", campaign.id);

          // Atualizar instance_id dos itens PENDING e FAILED para usar BACKUP
          await supabase
            .from("broadcast_queue")
            .update({ instance_id: campaign.backup_instance_id })
            .in("status", ["pending", "failed"])
            .eq("campaign_id", campaign.id);

          // Resetar mensagens SENDING travadas (após 30s)
          const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
          await supabase
            .from("broadcast_queue")
            .update({
              status: "pending",
              instance_id: campaign.backup_instance_id,
              attempted_instance_id: null,
            })
            .eq("campaign_id", campaign.id)
            .eq("status", "sending")
            .lt("sending_started_at", thirtySecondsAgo.toISOString());

          // Registrar log de failover
          await supabase
            .from("broadcast_failover_logs")
            .insert({
              campaign_id: campaign.id,
              organization_id: campaign.organization_id,
              from_instance_id: campaign.instance_id,
              to_instance_id: campaign.backup_instance_id,
              failover_type: "auto",
              reason: primaryHealth.reason || "health_check_failed",
              failure_details: {
                primary_health: primaryHealth,
                primary_failure_count: newFailureCount,
                primary_error_rate: primaryErrorRate,
              },
              queue_items_pending: pendingCount || 0,
              queue_items_sending: sendingCount || 0,
              queue_items_sent: sentCount || 0,
              queue_items_failed: failedCount || 0,
            });

          console.log(`✅ Failover executado: PRIMARY → BACKUP (campanha ${campaign.id})`);
          failovers++;
        }

        // Verificar se pode voltar para PRIMARY
        if (canReturnToPrimary(campaign, primaryHealth, 3, primaryErrorRate)) {
          console.log(`🔄 Voltando para PRIMARY na campanha ${campaign.id}`);

          // Contar itens da fila
          const { count: pendingCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "pending");

          const { count: sendingCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "sending");

          const { count: sentCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "sent");

          const { count: failedCount } = await supabase
            .from("broadcast_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "failed");

          // Atualizar campanha para usar PRIMARY
          await supabase
            .from("broadcast_campaigns")
            .update({
              current_active_instance_id: campaign.instance_id,
              last_failover_at: new Date().toISOString(),
              failover_cooldown_until: null,
              primary_failure_count: 0,
            })
            .eq("id", campaign.id);

          // Atualizar instance_id dos itens PENDING e FAILED para usar PRIMARY
          await supabase
            .from("broadcast_queue")
            .update({ instance_id: campaign.instance_id })
            .in("status", ["pending", "failed"])
            .eq("campaign_id", campaign.id);

          // Registrar log de retorno
          await supabase
            .from("broadcast_failover_logs")
            .insert({
              campaign_id: campaign.id,
              organization_id: campaign.organization_id,
              from_instance_id: campaign.backup_instance_id,
              to_instance_id: campaign.instance_id,
              failover_type: "auto",
              reason: "primary_recovered",
              failure_details: {
                primary_health: primaryHealth,
                primary_error_rate: primaryErrorRate,
              },
              queue_items_pending: pendingCount || 0,
              queue_items_sending: sendingCount || 0,
              queue_items_sent: sentCount || 0,
              queue_items_failed: failedCount || 0,
            });

          console.log(`✅ Retorno para PRIMARY executado (campanha ${campaign.id})`);
          returnsToPrimary++;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao verificar campanha ${campaign.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        checked,
        failovers,
        returnsToPrimary,
        message: `Verificadas ${checked} campanha(s), ${failovers} failover(s), ${returnsToPrimary} retorno(s) para PRIMARY`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro em check-campaign-health:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
