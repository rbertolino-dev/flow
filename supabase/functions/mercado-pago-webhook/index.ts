import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MercadoPagoNotification {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: string;
}

interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved?: string;
  payment_method_id?: string;
  payer?: {
    id?: string;
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  external_reference?: string;
}

async function settleMercadoPago(
  supabase: ReturnType<typeof createClient>,
  paymentRecord: { id: string; organization_id: string; lead_id?: string | null; valor?: number; descricao?: string | null; payer_name?: string | null },
  paymentData: MercadoPagoPayment,
) {
  const paid = paymentData.status === "approved" || paymentData.status === "authorized";
  const { error } = await supabase.rpc("attach_gateway_receivable", {
    p_organization_id: paymentRecord.organization_id,
    p_gateway: "mercado_pago",
    p_gateway_id: paymentRecord.id,
    p_amount: paymentData.transaction_amount ?? paymentRecord.valor,
    p_lead_id: paymentRecord.lead_id || null,
    p_description: paymentRecord.descricao || "Mercado Pago",
    p_contact_name: paymentRecord.payer_name || null,
    p_paid: paid,
    p_paid_at: paid ? (paymentData.date_approved || paymentData.date_created || null) : null,
    p_cancel: false,
  });
  if (error) console.error("Erro ao baixar Mercado Pago no financeiro:", error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se é uma notificação do Mercado Pago ou callback de retorno
    const url = new URL(req.url);
    const isCallback = url.searchParams.has("success") || 
                       url.searchParams.has("failure") || 
                       url.searchParams.has("pending");

    if (isCallback) {
      // Callback de retorno do checkout (não processar aqui, apenas retornar OK)
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Processar notificação webhook
    const notification: MercadoPagoNotification = await req.json();

    console.log("📨 Notificação recebida do Mercado Pago:", JSON.stringify(notification, null, 2));

    if (notification.type !== "payment") {
      console.log("⚠️ Tipo de notificação não é payment, ignorando:", notification.type);
      return new Response(
        JSON.stringify({ received: true, message: "Notificação não é de pagamento" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const paymentId = notification.data.id;

    // Buscar pagamento pelo preference_id ou payment_id
    let paymentRecord: any = null;
    const { data: paymentByPreference } = await supabase
      .from("mercado_pago_payments")
      .select("*")
      .eq("mercado_pago_preference_id", paymentId)
      .maybeSingle();

    if (paymentByPreference) {
      paymentRecord = paymentByPreference;
    } else {
      // Tentar buscar pelo payment_id se já foi atualizado
      const { data: paymentById } = await supabase
        .from("mercado_pago_payments")
        .select("*")
        .eq("mercado_pago_payment_id", paymentId.toString())
        .maybeSingle();

      if (paymentById) {
        paymentRecord = paymentById;
      }
    }

    if (!paymentRecord) {
      console.error("Pagamento não encontrado para preference_id ou payment_id:", paymentId);
      return new Response(
        JSON.stringify({ error: "Pagamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar configuração do Mercado Pago
    const { data: config, error: configError } = await supabase
      .from("mercado_pago_configs")
      .select("*")
      .eq("organization_id", paymentRecord.organization_id)
      .single();

    if (configError || !config) {
      console.error("Configuração não encontrada:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = config.access_token;
    const baseUrl = "https://api.mercadopago.com";

    // Buscar informações do pagamento no Mercado Pago usando o payment_id da notificação
    const paymentRes = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (paymentRes.ok) {
      const paymentData: MercadoPagoPayment = await paymentRes.json();

      // Atualizar registro no banco
      const updateData: any = {
        mercado_pago_payment_id: paymentData.id.toString(),
        status: paymentData.status,
        status_detail: paymentData.status_detail,
        atualizado_em: new Date().toISOString(),
      };

      if (paymentData.status === "approved" || paymentData.status === "authorized") {
        updateData.valor_pago = paymentData.transaction_amount;
        updateData.data_pagamento = paymentData.date_approved || paymentData.date_created;
        updateData.metodo_pagamento = paymentData.payment_method_id;
      }

      const { error: updateError } = await supabase
        .from("mercado_pago_payments")
        .update(updateData)
        .eq("id", paymentRecord.id);

      if (updateError) {
        console.error("Erro ao atualizar pagamento:", updateError);
      } else {
        console.log("✅ Pagamento atualizado:", paymentRecord.id);
        await settleMercadoPago(supabase, paymentRecord, paymentData);

        // Se pagamento foi aprovado, atualizar lead se necessário
        if (paymentData.status === "approved" && paymentRecord.lead_id) {
          console.log("💰 Pagamento aprovado para lead:", paymentRecord.lead_id);
        }
      }
    } else {
      // Se não conseguir buscar pelo payment_id, tentar pela preferência
      const preferenceRes = await fetch(
        `${baseUrl}/checkout/preferences/${paymentRecord.mercado_pago_preference_id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (preferenceRes.ok) {
        const preferenceData = await preferenceRes.json();

        // Se houver payment_id na preferência, buscar detalhes do pagamento
        if (preferenceData.payment_id) {
          const paymentResByPreference = await fetch(`${baseUrl}/v1/payments/${preferenceData.payment_id}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (paymentResByPreference.ok) {
            const paymentData: MercadoPagoPayment = await paymentResByPreference.json();

            // Atualizar registro no banco
            const updateData: any = {
              mercado_pago_payment_id: paymentData.id.toString(),
              status: paymentData.status,
              status_detail: paymentData.status_detail,
              atualizado_em: new Date().toISOString(),
            };

            if (paymentData.status === "approved" || paymentData.status === "authorized") {
              updateData.valor_pago = paymentData.transaction_amount;
              updateData.data_pagamento = paymentData.date_approved || paymentData.date_created;
              updateData.metodo_pagamento = paymentData.payment_method_id;
            }

            const { error: updateError } = await supabase
              .from("mercado_pago_payments")
              .update(updateData)
              .eq("id", paymentRecord.id);

            if (updateError) {
              console.error("Erro ao atualizar pagamento:", updateError);
            } else {
              console.log("✅ Pagamento atualizado:", paymentRecord.id);
              await settleMercadoPago(supabase, paymentRecord, paymentData);

              // Se pagamento foi aprovado, atualizar lead se necessário
              if (paymentData.status === "approved" && paymentRecord.lead_id) {
                console.log("💰 Pagamento aprovado para lead:", paymentRecord.lead_id);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico na função mercado-pago-webhook:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "mercado-pago-webhook failed", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

