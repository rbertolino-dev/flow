import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateBoletoPayload {
  organizationId: string;
  leadId?: string;
  workflowId?: string;
  scheduledMessageId?: string;
  budgetId?: string;
  posSaleId?: string;
  generateFinancial?: boolean;
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
    multaValor?: number;
    jurosPercentual?: number;
    postalEnabled?: boolean;
    installmentCount?: number;
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
  dueDate: string;
  status: string;
  description?: string;
  externalReference?: string;
  bankSlipUrl?: string;
  nossoNumero?: string;
  barCode?: string;
  installment?: string;
  installmentNumber?: number;
}

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) =>
    (base + (i < remainder ? 1 : 0)) / 100
  );
}

function onlyDigits(value?: string | null): string {
  return (value || "").replace(/\D/g, "");
}

async function resolveLeadId(
  supabase: SupabaseClient,
  organizationId: string,
  payload: CreateBoletoPayload,
): Promise<string> {
  if (payload.leadId) return payload.leadId;

  if (payload.budgetId) {
    const { data: budget } = await supabase
      .from("budgets")
      .select("lead_id, client_data")
      .eq("id", payload.budgetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (budget?.lead_id) return budget.lead_id as string;
  }

  if (payload.posSaleId) {
    const { data: sale } = await supabase
      .from("pos_sales")
      .select("lead_id")
      .eq("id", payload.posSaleId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (sale?.lead_id) return sale.lead_id as string;
  }

  const customer = payload.customer;
  const phoneDigits = onlyDigits(customer.phone);
  const cpfDigits = onlyDigits(customer.cpfCnpj);

  if (phoneDigits || cpfDigits || customer.email) {
    let query = supabase
      .from("leads")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(1);

    if (cpfDigits) {
      query = query.eq("cpf_cnpj", cpfDigits);
    } else if (phoneDigits) {
      query = query.or(`phone.eq.${phoneDigits},phone.ilike.%${phoneDigits.slice(-8)}%`);
    } else if (customer.email) {
      query = query.ilike("email", customer.email);
    }

    const { data: existing } = await query.maybeSingle();
    if (existing?.id) {
      await supabase
        .from("leads")
        .update({
          name: customer.name || undefined,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          cpf_cnpj: cpfDigits || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return existing.id as string;
    }
  }

  const { data: created, error: createError } = await supabase
    .from("leads")
    .insert({
      organization_id: organizationId,
      name: customer.name || "Cliente boleto",
      email: customer.email || null,
      phone: customer.phone || null,
      cpf_cnpj: cpfDigits || null,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new Error(createError?.message || "Não foi possível criar lead para o boleto");
  }
  return created.id as string;
}

async function ensureAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  customer: CreateBoletoPayload["customer"],
  postalEnabled: boolean,
): Promise<string> {
  let customerId: string | null = null;
  const searchParams = new URLSearchParams();
  if (customer.cpfCnpj) searchParams.append("cpfCnpj", onlyDigits(customer.cpfCnpj));
  else if (customer.email) searchParams.append("email", customer.email);

  if ([...searchParams.keys()].length > 0) {
    const findRes = await fetch(`${baseUrl}/customers?${searchParams.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", access_token: apiKey },
    });
    if (findRes.ok) {
      const findData = await findRes.json();
      if (Array.isArray(findData?.data) && findData.data.length > 0) {
        customerId = findData.data[0].id;
      }
    }
  }

  if (!customerId) {
    const createCustomerRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({
        name: customer.name,
        cpfCnpj: customer.cpfCnpj ? onlyDigits(customer.cpfCnpj) : undefined,
        email: customer.email,
        mobilePhone: customer.phone ? onlyDigits(customer.phone) : undefined,
        notificationDisabled: !postalEnabled,
      }),
    });
    if (!createCustomerRes.ok) {
      const errorText = await createCustomerRes.text();
      throw new Error(`Erro ao criar cliente no Asaas: ${errorText}`);
    }
    const createdCustomer = await createCustomerRes.json();
    customerId = createdCustomer.id;
  } else if (postalEnabled) {
    await fetch(`${baseUrl}/customers/${customerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({ notificationDisabled: false }),
    }).catch(() => undefined);
  }

  if (!customerId) throw new Error("Não foi possível obter o ID do cliente Asaas");
  return customerId;
}

async function createAsaasPayment(
  baseUrl: string,
  apiKey: string,
  args: {
    customerId: string;
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
    multaValor?: number;
    jurosPercentual?: number;
  },
): Promise<AsaasPaymentResponse> {
  const body: Record<string, unknown> = {
    customer: args.customerId,
    billingType: "BOLETO",
    value: args.value,
    dueDate: args.dueDate,
    description: args.description,
    externalReference: args.externalReference,
  };
  if (args.multaValor && args.multaValor > 0) {
    body.fine = { value: args.multaValor, type: "FIXED" };
  }
  if (args.jurosPercentual && args.jurosPercentual > 0) {
    body.interest = { value: args.jurosPercentual };
  }

  const boletoRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(body),
  });
  const paymentData: AsaasPaymentResponse = await boletoRes.json();
  if (!boletoRes.ok) {
    throw new Error(`Erro ao criar boleto no Asaas: ${JSON.stringify(paymentData)}`);
  }
  return paymentData;
}

async function fetchPdfUrl(baseUrl: string, apiKey: string, paymentId: string): Promise<string | null> {
  try {
    const pdfRes = await fetch(`${baseUrl}/payments/${paymentId}/pdf`, {
      method: "GET",
      headers: { access_token: apiKey },
    });
    if (!pdfRes.ok) return null;
    const pdfData = await pdfRes.json();
    return pdfData.url || pdfData.data?.url || null;
  } catch {
    return null;
  }
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
    const {
      organizationId,
      workflowId,
      scheduledMessageId,
      budgetId,
      posSaleId,
      customer,
      boleto,
    } = payload;
    const generateFinancial = payload.generateFinancial !== false;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!customer?.name) {
      return new Response(
        JSON.stringify({ error: "Nome do cliente é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!boleto?.valor || !boleto?.dataVencimento) {
      return new Response(
        JSON.stringify({ error: "Valor e vencimento são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const leadId = await resolveLeadId(supabase, organizationId, payload);

    const { data: config, error: configError } = await supabase
      .from("asaas_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração Asaas não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl: string = config.base_url || "https://www.asaas.com/api/v3";
    const apiKey: string = config.api_key;
    const postalEnabled = !!boleto.postalEnabled;
    const multaValor = Number(boleto.multaValor || 0);
    const jurosPercentual = Number(boleto.jurosPercentual || 0);
    const installmentCount = Math.max(1, Math.min(48, Math.floor(Number(boleto.installmentCount || 1))));

    const customerId = await ensureAsaasCustomer(baseUrl, apiKey, customer, postalEnabled);
    const installmentGroupId = installmentCount > 1 ? crypto.randomUUID() : null;
    const amounts = installmentCount > 1
      ? splitInstallments(Number(boleto.valor), installmentCount)
      : [Number(boleto.valor)];

    const createdRecords: Record<string, unknown>[] = [];
    let firstPayment: AsaasPaymentResponse | null = null;

    for (let i = 0; i < amounts.length; i++) {
      const installmentNumber = i + 1;
      const dueDate = installmentCount > 1
        ? addMonths(boleto.dataVencimento, i)
        : boleto.dataVencimento;
      const description = installmentCount > 1
        ? `PARC. ${installmentNumber}: ${boleto.descricao || "Cobrança"}`
        : (boleto.descricao || undefined);
      const externalRef = boleto.referenciaExterna
        ? (installmentCount > 1 ? `${boleto.referenciaExterna}-${installmentNumber}` : boleto.referenciaExterna)
        : undefined;

      const paymentData = await createAsaasPayment(baseUrl, apiKey, {
        customerId,
        value: amounts[i],
        dueDate,
        description,
        externalReference: externalRef,
        multaValor,
        jurosPercentual,
      });
      if (!firstPayment) firstPayment = paymentData;

      const pdfUrl = await fetchPdfUrl(baseUrl, apiKey, paymentData.id);
      const boletoUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || paymentData.paymentLink || null;
      const boletoPdfFinal = pdfUrl || paymentData.bankSlipUrl || paymentData.invoiceUrl || null;

      const { data: boletoRecord, error: insertError } = await supabase
        .from("whatsapp_boletos")
        .insert({
          organization_id: organizationId,
          lead_id: leadId,
          workflow_id: workflowId || null,
          scheduled_message_id: scheduledMessageId || null,
          budget_id: budgetId || null,
          pos_sale_id: posSaleId || null,
          asaas_payment_id: paymentData.id,
          asaas_customer_id: customerId,
          valor: amounts[i],
          data_vencimento: dueDate,
          descricao: description || null,
          referencia_externa: externalRef || null,
          boleto_url: boletoUrl,
          boleto_pdf_url: boletoPdfFinal,
          linha_digitavel: paymentData.barCode,
          codigo_barras: paymentData.barCode,
          nosso_numero: paymentData.nossoNumero,
          status: (paymentData.status || "pending").toLowerCase(),
          installment_group_id: installmentGroupId,
          installment_number: installmentCount > 1 ? installmentNumber : null,
          installment_count: installmentCount,
          multa_valor: multaValor,
          juros_percentual: jurosPercentual,
          postal_enabled: postalEnabled,
          customer_name: customer.name,
          customer_email: customer.email || null,
          customer_phone: customer.phone || null,
          customer_cpf_cnpj: customer.cpfCnpj ? onlyDigits(customer.cpfCnpj) : null,
          generate_financial: generateFinancial,
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
            boletos: createdRecords,
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      createdRecords.push(boletoRecord);

      if (generateFinancial) {
        const { error: financeError } = await supabase.rpc("attach_gateway_receivable", {
          p_organization_id: organizationId,
          p_gateway: "asaas",
          p_gateway_id: boletoRecord.id,
          p_amount: amounts[i],
          p_due_date: dueDate,
          p_lead_id: leadId,
          p_description: description || "Boleto",
          p_contact_name: customer?.name || null,
          p_paid: false,
        });
        if (financeError) {
          console.error("Erro ao lançar boleto no financeiro:", financeError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        boleto: createdRecords[0],
        boletos: createdRecords,
        payment: firstPayment,
        installment_count: installmentCount,
        installment_group_id: installmentGroupId,
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
