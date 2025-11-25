import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateBoletoPayload {
  organizationId: string;
  leadId: string;
  workflowId?: string;
  scheduledMessageId?: string;
  payer: {
    name: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
    address?: {
      street_name?: string;
      street_number?: string;
      zip_code?: string;
    };
  };
  boleto: {
    valor: number;
    descricao?: string;
    referenciaExterna?: string;
    dataVencimento?: string; // ISO 8601 ou yyyy-MM-dd
  };
}

interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_of_expiration?: string;
  payment_method_id: string;
  payment_type_id: string;
  payer?: {
    id?: string;
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  external_reference?: string;
  transaction_details?: {
    total_paid_amount?: number;
    installment_amount?: number;
  };
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
      barcode?: string;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = (await req.json()) as CreateBoletoPayload;
    const { organizationId, leadId, workflowId, scheduledMessageId, payer, boleto } = payload;

    // Validações
    if (!organizationId || !leadId) {
      return new Response(
        JSON.stringify({ error: "organizationId e leadId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!boleto.valor || boleto.valor <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor do boleto deve ser maior que zero" }),
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
    const baseUrl = "https://api.mercadopago.com";

    // Construir payload para criar pagamento com boleto
    const paymentData: any = {
      transaction_amount: boleto.valor,
      description: boleto.descricao || `Boleto para lead ${leadId}`,
      payment_method_id: "bolbradesco", // Boleto bancário
      payer: {
        email: payer.email || "cliente@exemplo.com",
        first_name: payer.name.split(" ")[0] || payer.name,
        last_name: payer.name.split(" ").slice(1).join(" ") || "",
        identification: payer.cpfCnpj
          ? {
              type: payer.cpfCnpj.length === 11 ? "CPF" : "CNPJ",
              number: payer.cpfCnpj.replace(/\D/g, ""),
            }
          : undefined,
      },
      external_reference: boleto.referenciaExterna || leadId,
    };

    // Adicionar endereço se fornecido
    if (payer.address) {
      paymentData.payer.address = {
        street_name: payer.address.street_name,
        street_number: payer.address.street_number,
        zip_code: payer.address.zip_code?.replace(/\D/g, ""),
      };
    }

    // Adicionar data de vencimento se fornecida
    if (boleto.dataVencimento) {
      // Converter para ISO 8601 se necessário
      let expirationDate = boleto.dataVencimento;
      if (!expirationDate.includes("T")) {
        expirationDate = `${expirationDate}T23:59:59.000-03:00`;
      }
      paymentData.date_of_expiration = expirationDate;
    }

    console.log("📤 Criando boleto no Mercado Pago:", JSON.stringify(paymentData, null, 2));

    // Criar pagamento (boleto) no Mercado Pago
    const paymentRes = await fetch(`${baseUrl}/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(paymentData),
    });

    const paymentResponse: MercadoPagoPaymentResponse = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Erro ao criar boleto Mercado Pago:", paymentResponse);
      return new Response(
        JSON.stringify({
          error: "Erro ao criar boleto no Mercado Pago",
          details: paymentResponse,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("✅ Boleto criado no Mercado Pago:", paymentResponse.id);

    // Extrair dados do boleto
    const barcode = paymentResponse.point_of_interaction?.transaction_data?.barcode || null;
    const ticketUrl = paymentResponse.point_of_interaction?.transaction_data?.ticket_url || null;
    const qrCode = paymentResponse.point_of_interaction?.transaction_data?.qr_code || null;

    // Registrar boleto no banco de dados
    const { data: boletoRecord, error: insertError } = await supabase
      .from("mercado_pago_payments")
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        workflow_id: workflowId || null,
        scheduled_message_id: scheduledMessageId || null,
        mercado_pago_payment_id: paymentResponse.id.toString(),
        mercado_pago_preference_id: paymentResponse.id.toString(), // Para boletos, usamos o payment_id
        valor: boleto.valor,
        descricao: boleto.descricao,
        referencia_externa: boleto.referenciaExterna || leadId,
        payer_name: payer.name,
        payer_email: payer.email,
        payer_phone: payer.phone,
        payer_cpf_cnpj: payer.cpfCnpj,
        payment_link: ticketUrl, // URL do boleto para impressão
        status: paymentResponse.status,
        status_detail: paymentResponse.status_detail,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao registrar boleto:", insertError);
      return new Response(
        JSON.stringify({
          error: "Boleto criado no Mercado Pago mas não foi registrado localmente",
          details: insertError,
          payment: paymentResponse,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Retornar sucesso com dados completos
    return new Response(
      JSON.stringify({
        success: true,
        boleto: boletoRecord,
        payment: paymentResponse,
        barcode,
        ticket_url: ticketUrl,
        qr_code: qrCode,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico na função mercado-pago-create-boleto:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "mercado-pago-create-boleto failed", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

