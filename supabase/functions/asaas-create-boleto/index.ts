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
  customer: {
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
  };
  boleto: {
    valor: number;
    dataVencimento: string; // yyyy-MM-dd
    descricao?: string;
    referenciaExterna?: string;
  };
}

interface AsaasPaymentResponse {
  id: string;
  dateCreated: string;
  customer: string;
  paymentLink?: string;
  invoiceUrl?: string;
  billingType: string;
  value: number;
  netValue?: number;
  dueDate: string;
  status: string;
  description?: string;
  externalReference?: string;
  originalValue?: number;
  interestValue?: number;
  originalDueDate?: string;
  bankSlipUrl?: string;
  nossoNumero?: string;
  barCode?: string;
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
    const { organizationId, leadId, workflowId, scheduledMessageId, customer, boleto } = payload;

    // Validações
    if (!organizationId || !leadId) {
      return new Response(
        JSON.stringify({ error: "organizationId e leadId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar configuração Asaas
    const { data: config, error: configError } = await supabase
      .from("asaas_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (configError || !config) {
      console.error("Config Asaas não encontrada:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração Asaas não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl: string = config.base_url || "https://www.asaas.com/api/v3";
    const apiKey: string = config.api_key;

    // 1) Garantir que o cliente existe no Asaas
    let customerId: string | null = null;

    const searchParams = new URLSearchParams();
    if (customer.cpfCnpj) searchParams.append("cpfCnpj", customer.cpfCnpj);
    else if (customer.email) searchParams.append("email", customer.email);

    if ([...searchParams.keys()].length > 0) {
      const findUrl = `${baseUrl}/customers?${searchParams.toString()}`;
      const findRes = await fetch(findUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
      });

      if (findRes.ok) {
        const findData = await findRes.json();
        if (Array.isArray(findData?.data) && findData.data.length > 0) {
          customerId = findData.data[0].id;
        }
      }
    }

    // Criar cliente se não encontrar
    if (!customerId) {
      const createCustomerRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify({
          name: customer.name,
          cpfCnpj: customer.cpfCnpj,
          email: customer.email,
          mobilePhone: customer.phone,
        }),
      });

      if (!createCustomerRes.ok) {
        const errorText = await createCustomerRes.text();
        console.error("Erro ao criar cliente Asaas:", errorText);
        return new Response(
          JSON.stringify({ error: "Erro ao criar cliente no Asaas", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const createdCustomer = await createCustomerRes.json();
      customerId = createdCustomer.id;
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Não foi possível obter o ID do cliente Asaas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Criar boleto no Asaas
    const boletoRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: boleto.valor,
        dueDate: boleto.dataVencimento,
        description: boleto.descricao,
        externalReference: boleto.referenciaExterna,
      }),
    });

    const paymentData: AsaasPaymentResponse = await boletoRes.json();

    if (!boletoRes.ok) {
      console.error("Erro ao criar boleto Asaas:", paymentData);
      return new Response(
        JSON.stringify({ error: "Erro ao criar boleto no Asaas", details: paymentData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("✅ Boleto criado no Asaas:", JSON.stringify(paymentData, null, 2));

    // 3) Gerar PDF do boleto
    let boleoPdfUrl: string | null = null;
    if (paymentData.id) {
      try {
        const pdfRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pdf`, {
          method: "GET",
          headers: {
            "access_token": apiKey,
          },
        });

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          boleoPdfUrl = pdfData.url || pdfData.data?.url || null;
          console.log("📄 PDF URL gerada:", boleoPdfUrl);
        } else {
          console.warn("⚠️ Erro ao gerar PDF:", await pdfRes.text());
        }
      } catch (pdfError) {
        console.warn("Aviso: Não foi possível gerar PDF do boleto:", pdfError);
        // Continuar mesmo se falhar a geração do PDF
      }
    }

    console.log("💾 Dados que serão salvos no banco:", {
      boleto_url: paymentData.paymentLink,
      boleto_pdf_url: boleoPdfUrl,
      bankSlipUrl: paymentData.bankSlipUrl,
      invoiceUrl: paymentData.invoiceUrl,
    });

    // 4) Registrar boleto no banco de dados
    const boletoUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || paymentData.paymentLink || null;
    const boletoPdfFinal = boleoPdfUrl || paymentData.bankSlipUrl || paymentData.invoiceUrl || null;

    console.log("🔗 URLs finais:", { boletoUrl, boletoPdfFinal });

    const { data: boletoRecord, error: insertError } = await supabase
      .from("whatsapp_boletos")
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        workflow_id: workflowId || null,
        scheduled_message_id: scheduledMessageId || null,
        asaas_payment_id: paymentData.id,
        asaas_customer_id: customerId,
        valor: boleto.valor,
        data_vencimento: boleto.dataVencimento,
        descricao: boleto.descricao,
        referencia_externa: boleto.referenciaExterna,
        boleto_url: boletoUrl,
        boleto_pdf_url: boletoPdfFinal,
        linha_digitavel: paymentData.barCode,
        codigo_barras: paymentData.barCode,
        nosso_numero: paymentData.nossoNumero,
        status: paymentData.status || "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao registrar boleto:", insertError);
      return new Response(
        JSON.stringify({
          error: "Boleto criado no Asaas mas não foi registrado localmente",
          details: insertError,
          payment: paymentData,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5) Retornar sucesso com dados completos
    return new Response(
      JSON.stringify({
        success: true,
        boleto: boletoRecord,
        payment: paymentData,
        download_url: boleoPdfUrl,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico na função asaas-create-boleto:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "asaas-create-boleto failed", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

