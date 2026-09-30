import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET_ID = "whatsapp-workflow-media";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor inválida" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      contract_id,
      signature_token,
      pdf_base64,
      update_status,
      signed_at,
    } = body as {
      contract_id?: string;
      signature_token?: string;
      pdf_base64?: string;
      update_status?: boolean;
      signed_at?: string;
    };

    if (!contract_id || !signature_token || !pdf_base64) {
      return new Response(
        JSON.stringify({
          error:
            "Parâmetros obrigatórios: contract_id, signature_token, pdf_base64",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar contrato + token (acesso público de assinatura)
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, organization_id, signature_token, status, expires_at")
      .eq("id", contract_id)
      .eq("signature_token", signature_token)
      .maybeSingle();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: "Contrato não encontrado ou token inválido" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (contract.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Este contrato foi cancelado" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Este contrato expirou" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decodificar PDF (aceita data URL ou base64 puro)
    const base64Data = pdf_base64.includes(",")
      ? pdf_base64.split(",")[1]
      : pdf_base64;
    const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const pdfBlob = new Blob([binary], { type: "application/pdf" });

    const fileName = `${contract_id}-signed-${Date.now()}.pdf`;
    const filePath = `${contract.organization_id}/contracts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_ID)
      .upload(filePath, pdfBlob, {
        upsert: false,
        cacheControl: "86400",
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error("Erro no upload do PDF assinado:", uploadError);
      return new Response(
        JSON.stringify({
          error: `Erro ao fazer upload do PDF: ${uploadError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_ID)
      .getPublicUrl(filePath);

    const signedPdfUrl = publicUrlData.publicUrl;

    const updateData: Record<string, unknown> = {
      signed_pdf_url: signedPdfUrl,
    };

    if (update_status) {
      updateData.status = "signed";
      updateData.signed_at = signed_at || new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("contracts")
      .update(updateData)
      .eq("id", contract_id);

    if (updateError) {
      console.error("Erro ao atualizar contrato:", updateError);
      return new Response(
        JSON.stringify({
          error: `PDF enviado, mas falha ao atualizar contrato: ${updateError.message}`,
          signed_pdf_url: signedPdfUrl,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        signed_pdf_url: signedPdfUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro em upload-signed-contract-pdf:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Erro interno do servidor",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
