import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentPayload {
  organizationId: string;
  leadId: string;
  workflowId?: string;
  scheduledMessageId?: string;
  payer: {
    name: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
  };
  payment: {
    valor: number;
    descricao?: string;
    referenciaExterna?: string;
    expirationDateFrom?: string; // ISO 8601
    expirationDateTo?: string; // ISO 8601
  };
}

interface MercadoPagoPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  date_created: string;
  items: Array<{
    id: string;
    title: string;
    description?: string;
    quantity: number;
    unit_price: number;
  }>;
  payer?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
    identification?: {
      type?: string;
      number?: string;
    };
  };
  external_reference?: string;
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  auto_return?: string;
  notification_url?: string;
  status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = (await req.json()) as CreatePaymentPayload;
    const { organizationId, leadId, workflowId, scheduledMessageId, payer, payment } = payload;

    // Validações
    if (!organizationId || !leadId) {
      return new Response(
        JSON.stringify({ error: "organizationId e leadId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!payment.valor || payment.valor <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor do pagamento deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar configuração Mercado Pago
    const { data: config, error: configError } = await supabase
      .from("mercado_pago_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (configError || !config) {
      console.error("Config Mercado Pago não encontrada:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração Mercado Pago não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = config.access_token;
    const isSandbox = config.environment === "sandbox";
    const baseUrl = isSandbox
      ? "https://api.mercadopago.com"
      : "https://api.mercadopago.com";

    // Construir URL de notificação (webhook)
    const webhookUrl = config.webhook_url || 
      `${supabaseUrl}/functions/v1/mercado-pago-webhook`;

    // Construir preferência de pagamento
    const preferenceData: any = {
      items: [
        {
          title: payment.descricao || "Pagamento",
          description: payment.descricao || `Pagamento para lead ${leadId}`,
          quantity: 1,
          unit_price: payment.valor,
        },
      ],
      payer: {
        name: payer.name,
        email: payer.email,
        phone: payer.phone
          ? {
              area_code: payer.phone.substring(0, 2),
              number: payer.phone.substring(2),
            }
          : undefined,
        identification: payer.cpfCnpj
          ? {
              type: payer.cpfCnpj.length === 11 ? "CPF" : "CNPJ",
              number: payer.cpfCnpj.replace(/\D/g, ""),
            }
          : undefined,
      },
      external_reference: payment.referenciaExterna || leadId,
      notification_url: webhookUrl,
      back_urls: {
        success: `${supabaseUrl}/functions/v1/mercado-pago-webhook?success=true`,
        failure: `${supabaseUrl}/functions/v1/mercado-pago-webhook?failure=true`,
        pending: `${supabaseUrl}/functions/v1/mercado-pago-webhook?pending=true`,
      },
      auto_return: "approved",
    };

    // Adicionar datas de expiração se fornecidas
    if (payment.expirationDateFrom) {
      preferenceData.expiration_date_from = payment.expirationDateFrom;
    }
    if (payment.expirationDateTo) {
      preferenceData.expiration_date_to = payment.expirationDateTo;
    }

    console.log("📤 Criando preferência no Mercado Pago:", JSON.stringify(preferenceData, null, 2));

    // Criar preferência no Mercado Pago
    const preferenceRes = await fetch(`${baseUrl}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    const preferenceDataResponse: MercadoPagoPreferenceResponse = await preferenceRes.json();

    if (!preferenceRes.ok) {
      console.error("Erro ao criar preferência Mercado Pago:", preferenceDataResponse);
      return new Response(
        JSON.stringify({
          error: "Erro ao criar preferência no Mercado Pago",
          details: preferenceDataResponse,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("✅ Preferência criada no Mercado Pago:", preferenceDataResponse.id);

    // Determinar qual link usar (sandbox ou production)
    const paymentLink = isSandbox
      ? preferenceDataResponse.sandbox_init_point
      : preferenceDataResponse.init_point;

    // Registrar pagamento no banco de dados
    const { data: paymentRecord, error: insertError } = await supabase
      .from("mercado_pago_payments")
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        workflow_id: workflowId || null,
        scheduled_message_id: scheduledMessageId || null,
        mercado_pago_preference_id: preferenceDataResponse.id,
        valor: payment.valor,
        descricao: payment.descricao,
        referencia_externa: payment.referenciaExterna || leadId,
        payer_name: payer.name,
        payer_email: payer.email,
        payer_phone: payer.phone,
        payer_cpf_cnpj: payer.cpfCnpj,
        payment_link: paymentLink,
        sandbox_init_point: preferenceDataResponse.sandbox_init_point,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao registrar pagamento:", insertError);
      return new Response(
        JSON.stringify({
          error: "Preferência criada no Mercado Pago mas não foi registrada localmente",
          details: insertError,
          preference: preferenceDataResponse,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Retornar sucesso com dados completos
    return new Response(
      JSON.stringify({
        success: true,
        payment: paymentRecord,
        preference: preferenceDataResponse,
        payment_link: paymentLink,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico na função mercado-pago-create-payment:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "mercado-pago-create-payment failed", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

