import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { InvalidWhatsappPhoneError, normalizeEvolutionSendPhone } from "../_shared/evolution-send-phone.ts";
import {
  keepSingleChatwootConversationAfterSend,
  trySendViaExistingChatwootConversation,
} from "../_shared/chatwoot-keep-conversation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function serviceOrderPdfFileName(
  clientName: string | null | undefined,
  code: string | null | undefined
): string {
  const clean = (value: string | null | undefined, fallback: string) =>
    (value || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || fallback;
  return `Ordem de Serviço - ${clean(clientName, "Cliente").slice(0, 80)} - ${clean(code, "sem-codigo").slice(0, 40)}.pdf`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let requestBody: Record<string, unknown>;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido ou vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const service_order_id = String(requestBody.service_order_id || "");
    const instance_id = String(requestBody.instance_id || "");
    const pdfUrlOverride =
      typeof requestBody.pdf_url === "string" && requestBody.pdf_url.trim()
        ? String(requestBody.pdf_url).trim()
        : "";

    if (!service_order_id || !instance_id) {
      return new Response(
        JSON.stringify({ error: "service_order_id e instance_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [orderResult, configResult] = await Promise.all([
      supabase
        .from("service_orders")
        .select(
          `
          id, code, organization_id, lead_id, client_name, client_phone, pdf_url, total, service_name,
          lead:leads(id, name, phone)
        `
        )
        .eq("id", service_order_id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("evolution_config")
        .select("api_url, api_key, instance_name, is_connected, organization_id")
        .eq("id", instance_id)
        .maybeSingle(),
    ]);

    const order = orderResult.data;
    if (orderResult.error || !order) {
      return new Response(
        JSON.stringify({
          error: "Ordem de serviço não encontrada",
          details: orderResult.error?.message,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evolutionConfig = configResult.data;
    if (configResult.error || !evolutionConfig || !evolutionConfig.is_connected) {
      return new Response(
        JSON.stringify({ error: "Instância WhatsApp não encontrada ou desconectada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (evolutionConfig.organization_id !== order.organization_id) {
      return new Response(
        JSON.stringify({ error: "Instância não pertence à mesma organização da ordem" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lead = Array.isArray(order.lead) ? order.lead[0] : order.lead;
    const leadPhone = (order.client_phone || lead?.phone || "").trim();
    const leadName = (order.client_name || lead?.name || "Cliente").trim();

    if (!leadPhone) {
      return new Response(
        JSON.stringify({ error: "Cliente sem telefone cadastrado nesta ordem de serviço" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let pdfUrl = pdfUrlOverride || order.pdf_url || "";
    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "PDF da ordem de serviço não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pdfUrlOverride && pdfUrlOverride !== order.pdf_url) {
      await supabase
        .from("service_orders")
        .update({ pdf_url: pdfUrlOverride })
        .eq("id", service_order_id)
        .eq("organization_id", order.organization_id);
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEvolutionSendPhone(leadPhone);
    } catch (phoneError) {
      const msg = phoneError instanceof InvalidWhatsappPhoneError
        ? phoneError.message
        : "Telefone do cliente inválido";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const whatsappNumber = normalizedPhone;
    const totalFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(order.total || 0));

    const serviceLine = order.service_name ? `\n🔧 Serviço: ${order.service_name}` : "";
    const caption = `📋 Ordem de Serviço ${order.code}

Olá ${leadName}, segue a ordem de serviço.${serviceLine}

💰 Valor: ${totalFormatted}

Para mais informações, entre em contato conosco.`;

    const pdfFileName = serviceOrderPdfFileName(leadName, order.code);
    const orgId = order.organization_id || evolutionConfig.organization_id;

    if (orgId) {
      const viaChatwoot = await trySendViaExistingChatwootConversation({
        supabase,
        organizationId: orgId,
        phone: normalizedPhone,
        content: caption,
        evolution: {
          apiUrl: evolutionConfig.api_url,
          apiKey: evolutionConfig.api_key || "",
          instanceName: evolutionConfig.instance_name,
        },
        mediaUrl: pdfUrl,
        mediaType: "document",
        fileName: pdfFileName,
      });
      if (viaChatwoot.ok) {
        if (order.lead_id) {
          try {
            await supabase.from("activities").insert({
              lead_id: order.lead_id,
              type: "whatsapp",
              content: `Ordem de serviço ${order.code} enviada via WhatsApp`,
              user_name: "Sistema",
              direction: "outgoing",
            });
          } catch (_) { /* ignore */ }
        }
        return new Response(
          JSON.stringify({
            success: true,
            message: "Ordem de serviço enviada com sucesso",
            service_order_id,
            via: "chatwoot",
            conversation_id: viaChatwoot.conversationId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, "");
    const sendMediaUrl = `${evolutionApiUrl}/message/sendMedia/${evolutionConfig.instance_name}`;

    const evolutionPayload = {
      number: whatsappNumber,
      mediatype: "document",
      mimetype: "application/pdf",
      media: pdfUrl,
      fileName: pdfFileName,
      caption,
    };

    const evolutionResponse = await fetch(sendMediaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionConfig.api_key || "",
      },
      body: JSON.stringify(evolutionPayload),
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      let errorDetails: Record<string, unknown> = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }

      const responseMsg = (errorDetails as { response?: { message?: unknown } }).response?.message;
      if (evolutionResponse.status === 400 && responseMsg) {
        const messages = Array.isArray(responseMsg) ? responseMsg : [responseMsg];
        const numberError = messages.find(
          (m: { exists?: boolean }) => m && m.exists === false
        );
        if (numberError) {
          return new Response(
            JSON.stringify({
              error: "Número do WhatsApp não encontrado",
              details: `O número ${whatsappNumber} não está cadastrado no WhatsApp ou não é válido.`,
              phone: whatsappNumber,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          error: "Erro ao enviar ordem de serviço via WhatsApp",
          details: errorText,
          status: evolutionResponse.status,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evolutionResult = await evolutionResponse.json().catch(() => ({}));

    if (order.organization_id || evolutionConfig.organization_id) {
      await keepSingleChatwootConversationAfterSend({
        supabase,
        organizationId: order.organization_id || evolutionConfig.organization_id,
        phone: normalizedPhone,
        evolutionPayload: evolutionResult,
        evolutionApiUrl: evolutionConfig.api_url,
        evolutionApiKey: evolutionConfig.api_key || "",
        evolutionInstanceName: evolutionConfig.instance_name,
      });
    }

    if (order.lead_id) {
      try {
        await supabase.from("activities").insert({
          lead_id: order.lead_id,
          type: "whatsapp",
          content: `Ordem de serviço ${order.code} enviada via WhatsApp`,
          user_name: "Sistema",
          direction: "outgoing",
        });
      } catch (err) {
        console.error("Erro ao registrar atividade (não crítico):", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Ordem de serviço enviada com sucesso",
        service_order_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro no send-service-order-whatsapp:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
