import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
          message_template:message_templates(content),
          instance:evolution_config(api_url, api_key, instance_name)
        )
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

    for (const item of validItems) {
      try {
        const campaign = item.campaign;
        if (!campaign || !campaign.instance) {
          throw new Error("Configuração da campanha inválida");
        }

        // VERIFICAÇÃO DE SEGURANÇA CRÍTICA: Dupla verificação do status da campanha
        if (campaign.status === 'cancelled' || campaign.status === 'paused') {
          console.log(`🛑 BLOQUEIO DE SEGURANÇA: Campanha ${campaign.id} está ${campaign.status} - mensagem NÃO será enviada`);
          
          await supabase
            .from("broadcast_queue")
            .update({
              status: "cancelled",
              error_message: `Bloqueado: campanha ${campaign.status}`,
            })
            .eq("id", item.id);
          
          blocked++;
          continue; // Pular este item
        }

        const message = campaign.custom_message || campaign.message_template?.content || "";
        if (!message) {
          throw new Error("Mensagem não configurada");
        }

        // Preparar mensagem personalizada
        const personalizedMessage = message.replace(/\{nome\}/gi, item.name || "");

        // Limpar api_url e construir endpoint correto
        let baseUrl = campaign.instance.api_url.replace(/\/+$/, ''); // Remove trailing slashes
        if (baseUrl.endsWith('/manager')) {
          baseUrl = baseUrl.slice(0, -8); // Remove '/manager' se existir
        }
        
        const evolutionUrl = `${baseUrl}/message/sendText/${campaign.instance.instance_name}`;
        console.log(`📤 Enviando para ${item.phone} via ${evolutionUrl}`);

        // Enviar mensagem via Evolution API
        const evolutionResponse = await fetch(evolutionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: campaign.instance.api_key,
          },
          body: JSON.stringify({
            number: item.phone,
            text: personalizedMessage,
          }),
        });

        if (!evolutionResponse.ok) {
          const errorText = await evolutionResponse.text();
          throw new Error(`Evolution API error: ${errorText}`);
        }

        // Marcar como enviado
        const { error: updateError } = await supabase
          .from("broadcast_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (updateError) throw updateError;

        // Atualizar contador da campanha
        const { error: campaignUpdateError } = await supabase
          .from("broadcast_campaigns")
          .update({
            sent_count: (campaign.sent_count || 0) + 1,
          })
          .eq("id", campaign.id);

        if (campaignUpdateError) console.error("Erro ao atualizar campanha:", campaignUpdateError);

        processed++;
        console.log(`✅ Mensagem enviada para ${item.phone}`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar ${item.phone}:`, error.message);
        
        // Marcar como falha
        await supabase
          .from("broadcast_queue")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", item.id);

        // Atualizar contador de falhas
        const campaign = item.campaign;
        if (campaign) {
          await supabase
            .from("broadcast_campaigns")
            .update({
              failed_count: (campaign.failed_count || 0) + 1,
            })
            .eq("id", campaign.id);
        }

        failed++;
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
        await supabase
          .from("broadcast_campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);

        console.log(`🎉 Campanha ${campaign.id} concluída`);
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