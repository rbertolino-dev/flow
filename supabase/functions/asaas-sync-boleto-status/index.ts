import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AsaasPaymentResponse {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  description?: string;
  externalReference?: string;
  originalValue?: number;
  interestValue?: number;
  originalDueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  nossoNumero?: string;
  barCode?: string;
  invoiceNumber?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter organization_id do header de autorização ou do body
    const authHeader = req.headers.get("authorization");
    let organizationId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        // Buscar organização do usuário
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();
        if (profile) {
          organizationId = profile.organization_id;
        }
      }
    }

    // Se não encontrou pelo token, tentar pelo body
    const body = await req.json().catch(() => ({}));
    if (!organizationId && body.organizationId) {
      organizationId = body.organizationId;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId é obrigatório" }),
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
      return new Response(
        JSON.stringify({ error: "Configuração Asaas não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl: string = config.base_url || "https://www.asaas.com/api/v3";
    const apiKey: string = config.api_key;

    // Buscar todos os boletos pendentes ou abertos da organização
    const { data: boletos, error: boletosError } = await supabase
      .from("whatsapp_boletos")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "open"]);

    if (boletosError) {
      console.error("Erro ao buscar boletos:", boletosError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar boletos", details: boletosError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!boletos || boletos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "Nenhum boleto para sincronizar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let syncedCount = 0;
    const errors: string[] = [];

    // Sincronizar cada boleto
    for (const boleto of boletos) {
      try {
        // Buscar status atualizado no Asaas
        const paymentRes = await fetch(`${baseUrl}/payments/${boleto.asaas_payment_id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            access_token: apiKey,
          },
        });

        if (!paymentRes.ok) {
          const errorText = await paymentRes.text();
          console.error(`Erro ao buscar boleto ${boleto.asaas_payment_id}:`, errorText);
          errors.push(`Boleto ${boleto.asaas_payment_id}: ${errorText}`);
          continue;
        }

        const paymentData: AsaasPaymentResponse = await paymentRes.json();

        // Atualizar status e outras informações se necessário
        const updates: Record<string, any> = {
          status: paymentData.status.toLowerCase(),
          updated_at: new Date().toISOString(),
        };

        // Atualizar URLs se disponíveis
        if (paymentData.bankSlipUrl && !boleto.boleto_url) {
          updates.boleto_url = paymentData.bankSlipUrl;
        }
        if (paymentData.invoiceUrl && !boleto.boleto_url) {
          updates.boleto_url = paymentData.invoiceUrl;
        }
        if (paymentData.transactionReceiptUrl && !boleto.boleto_pdf_url) {
          updates.boleto_pdf_url = paymentData.transactionReceiptUrl;
        }
        if (paymentData.barCode && !boleto.codigo_barras) {
          updates.codigo_barras = paymentData.barCode;
          updates.linha_digitavel = paymentData.barCode;
        }
        if (paymentData.nossoNumero && !boleto.nosso_numero) {
          updates.nosso_numero = paymentData.nossoNumero;
        }

        // Atualizar no banco
        const { error: updateError } = await supabase
          .from("whatsapp_boletos")
          .update(updates)
          .eq("id", boleto.id);

        if (updateError) {
          console.error(`Erro ao atualizar boleto ${boleto.id}:`, updateError);
          errors.push(`Boleto ${boleto.asaas_payment_id}: Erro ao atualizar`);
        } else {
          syncedCount++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar boleto ${boleto.asaas_payment_id}:`, error);
        errors.push(`Boleto ${boleto.asaas_payment_id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        total: boletos.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico na função asaas-sync-boleto-status:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "asaas-sync-boleto-status failed", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});



