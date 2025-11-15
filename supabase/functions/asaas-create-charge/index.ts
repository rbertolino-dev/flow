import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateChargePayload {
  organizationId: string;
  customer: {
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
  };
  payment: {
    value: number;
    dueDate: string; // yyyy-MM-dd
    description?: string;
    externalReference?: string;
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

    const payload = (await req.json()) as CreateChargePayload;
    const { organizationId, customer, payment } = payload;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar configuração Asaas da organização
    const { data: config, error: configError } = await supabase
      .from("asaas_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (configError || !config) {
      console.error("Config Asaas não encontrada:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração Asaas não encontrada para a organização" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl: string = config.base_url || "https://www.asaas.com/api/v3";
    const apiKey: string = config.api_key;

    // 1) Garantir que o cliente exista no Asaas
    let customerId: string | null = null;

    // Tentar buscar cliente por cpfCnpj ou email
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

    // Se não encontrou, criar cliente
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

    // 2) Criar cobrança (boleto) no Asaas
    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: payment.value,
        dueDate: payment.dueDate,
        description: payment.description,
        externalReference: payment.externalReference,
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Erro ao criar cobrança Asaas:", paymentData);
      return new Response(
        JSON.stringify({ error: "Erro ao criar cobrança no Asaas", details: paymentData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Retornar dados da cobrança (link do boleto, código de barras, etc.)
    return new Response(
      JSON.stringify({ success: true, payment: paymentData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico na função asaas-create-charge:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "asaas-create-charge failed", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


