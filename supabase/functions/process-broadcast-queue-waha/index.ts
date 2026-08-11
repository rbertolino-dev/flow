import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  classifyWahaError,
  fallbackWahaChatId,
  WahaClient,
} from "../_shared/waha-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_ATTEMPTS = 3;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const now = new Date();
  const nowIso = now.toISOString();
  const lockUntil = new Date(now.getTime() + 55000).toISOString();

  try {
    const { data: dueItems, error: fetchError } = await admin
      .from("broadcast_queue_waha")
      .select(`
        id,
        campaign_id,
        organization_id,
        session_id,
        phone,
        chat_id,
        personalized_message,
        send_attempts,
        campaign:broadcast_campaigns_waha!campaign_id(id,status),
        session:waha_config!session_id(id,session_name,is_connected,status)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", nowIso)
      .or(`processing_lock_until.is.null,processing_lock_until.lt.${nowIso}`)
      .order("scheduled_for", { ascending: true })
      .limit(100);
    if (fetchError) throw fetchError;
    if (!dueItems?.length) return json({ processed: 0, failed: 0, retried: 0 });

    // Um envio por sessão em cada execução do cron evita rajadas no mesmo chip.
    const sessionSeen = new Set<string>();
    const batch = dueItems.filter((item) => {
      if (sessionSeen.has(item.session_id)) return false;
      sessionSeen.add(item.session_id);
      return true;
    });

    const client = new WahaClient();
    let sent = 0;
    let failed = 0;
    let retried = 0;
    const campaignIds = new Set<string>();

    await Promise.all(batch.map(async (item) => {
      campaignIds.add(item.campaign_id);
      const campaign = Array.isArray(item.campaign) ? item.campaign[0] : item.campaign;
      const session = Array.isArray(item.session) ? item.session[0] : item.session;

      if (!campaign || campaign.status !== "running") {
        if (campaign?.status === "cancelled") {
          await admin
            .from("broadcast_queue_waha")
            .update({ status: "cancelled", error_message: "Campanha cancelada" })
            .eq("id", item.id)
            .eq("status", "scheduled");
        }
        return;
      }

      const { data: claimed, error: claimError } = await admin
        .from("broadcast_queue_waha")
        .update({
          processing_lock_until: lockUntil,
          last_attempt_at: nowIso,
          send_attempts: item.send_attempts + 1,
        })
        .eq("id", item.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();
      if (claimError || !claimed) return;

      try {
        if (!session?.session_name || !session.is_connected) {
          throw new Error("Sessão WAHA marcada como desconectada");
        }
        const live = await client.getSession(session.session_name);
        if (live.status !== "WORKING") {
          await admin
            .from("waha_config")
            .update({
              status: live.status,
              is_connected: false,
              last_synced_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", item.session_id);
          throw new Error(`Sessão WAHA indisponível: ${live.status}`);
        }

        const chatId = item.chat_id || fallbackWahaChatId(item.phone);
        if (!chatId) throw new Error("Telefone inválido");
        const response = await client.sendText({
          session: session.session_name,
          chatId,
          text: item.personalized_message,
        });
        const messageId = response.id ?? response.key?.id ?? null;

        const { error: sentError } = await admin
          .from("broadcast_queue_waha")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            response_message_id: messageId,
            error_message: null,
            failure_code: null,
            processing_lock_until: null,
          })
          .eq("id", item.id);
        if (sentError) throw sentError;
        sent++;
      } catch (error) {
        const classified = classifyWahaError(error);
        const attempts = item.send_attempts + 1;
        if (classified.retryable && attempts < MAX_ATTEMPTS) {
          const retryAt = new Date(Date.now() + attempts * 60000).toISOString();
          await admin
            .from("broadcast_queue_waha")
            .update({
              scheduled_for: retryAt,
              error_message: classified.message,
              failure_code: classified.code,
              processing_lock_until: null,
            })
            .eq("id", item.id);
          retried++;
        } else {
          await admin
            .from("broadcast_queue_waha")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_message: classified.message,
              failure_code: classified.code,
              processing_lock_until: null,
            })
            .eq("id", item.id);
          failed++;
        }
      }
    }));

    for (const campaignId of campaignIds) {
      const { data: queue, error: countError } = await admin
        .from("broadcast_queue_waha")
        .select("status")
        .eq("campaign_id", campaignId);
      if (countError) {
        console.error("[process-broadcast-queue-waha] contadores", countError);
        continue;
      }
      const statuses = (queue ?? []).map((row) => row.status);
      const pending = statuses.filter((status) =>
        status === "pending" || status === "scheduled"
      ).length;
      const update: Record<string, unknown> = {
        sent_count: statuses.filter((status) => status === "sent").length,
        failed_count: statuses.filter((status) => status === "failed").length,
        cancelled_count: statuses.filter((status) => status === "cancelled").length,
      };
      if (pending === 0) {
        update.status = "completed";
        update.completed_at = new Date().toISOString();
      }
      await admin.from("broadcast_campaigns_waha").update(update).eq("id", campaignId);
    }

    return json({
      processed: batch.length,
      sent,
      failed,
      retried,
      deferred: dueItems.length - batch.length,
    });
  } catch (error) {
    console.error("[process-broadcast-queue-waha]", error);
    return json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }, 500);
  }
});
