import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFICATION_TTL_MS = 15 * 60 * 1000;

function cleanCpf(value: string): string {
  return (value || "").replace(/\D/g, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return json(500, { error: "Configuração do servidor incompleta" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: {
      contract_id?: string;
      signature_token?: string;
      signer_cpf?: string;
      code?: string;
    };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Corpo da requisição inválido" });
    }

    const contractId = body.contract_id?.trim();
    const signatureToken = body.signature_token?.trim();
    const signerCpf = cleanCpf(body.signer_cpf || "");
    const code = (body.code || "").replace(/\D/g, "");

    if (!contractId || !signatureToken || !signerCpf || code.length !== 6) {
      return json(400, {
        error: "contract_id, signature_token, signer_cpf e código de 6 dígitos são obrigatórios",
      });
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, status, expires_at, signature_token, require_signature_otp")
      .eq("id", contractId)
      .eq("signature_token", signatureToken)
      .maybeSingle();

    if (contractError || !contract) {
      return json(404, { error: "Contrato não encontrado ou link inválido" });
    }
    if (!contract.require_signature_otp) {
      return json(400, {
        error: "Este contrato não exige código WhatsApp (assinatura padrão).",
      });
    }
    if (contract.status === "cancelled" || contract.status === "signed") {
      return json(400, { error: "Contrato indisponível para assinatura" });
    }

    const { data: otpRows, error: otpError } = await supabase
      .from("contract_signature_otps")
      .select("*")
      .eq("contract_id", contractId)
      .eq("signature_token", signatureToken)
      .eq("signer_cpf", signerCpf)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (otpError || !otpRows?.length) {
      return json(400, { error: "Nenhum código pendente. Solicite um novo código." });
    }

    const otp = otpRows[0];

    if (new Date(otp.expires_at) < new Date()) {
      return json(400, { error: "Código expirado. Solicite um novo código." });
    }

    if ((otp.attempts || 0) >= (otp.max_attempts || 5)) {
      return json(400, {
        error: "Número máximo de tentativas excedido. Solicite um novo código.",
      });
    }

    const expectedHash = await sha256Hex(
      `${contractId}|${signatureToken}|${signerCpf}|${code}`,
    );

    if (expectedHash !== otp.code_hash) {
      await supabase
        .from("contract_signature_otps")
        .update({ attempts: (otp.attempts || 0) + 1 })
        .eq("id", otp.id);

      const remaining = (otp.max_attempts || 5) - ((otp.attempts || 0) + 1);
      return json(400, {
        error: remaining > 0
          ? `Código incorreto. ${remaining} tentativa(s) restante(s).`
          : "Código incorreto. Solicite um novo código.",
      });
    }

    const verificationToken = crypto.randomUUID();
    const verificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    const verifiedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("contract_signature_otps")
      .update({
        verified_at: verifiedAt,
        verification_token: verificationToken,
        verification_token_expires_at: verificationExpires,
        attempts: (otp.attempts || 0) + 1,
      })
      .eq("id", otp.id);

    if (updateError) {
      console.error("Erro ao marcar OTP verificado:", updateError);
      return json(500, { error: "Erro ao verificar código" });
    }

    return json(200, {
      success: true,
      verification_token: verificationToken,
      verified_at: verifiedAt,
      expires_at: verificationExpires,
      signer_cpf: signerCpf,
      identity_verification_method: "cpf_whatsapp_otp",
    });
  } catch (error: unknown) {
    console.error("verify-signature-otp:", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Erro interno",
    });
  }
});
