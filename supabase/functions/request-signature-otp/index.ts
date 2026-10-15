import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function cleanCpf(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function isValidCpf(cpf: string): boolean {
  const cleaned = cleanCpf(cpf);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === parseInt(cleaned.charAt(10), 10);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  return String(num % 1000000).padStart(6, "0");
}

function normalizePhone(leadPhone: string): string | null {
  if (!leadPhone || /@lid/i.test(leadPhone)) return null;
  let normalized = leadPhone.replace(/\D/g, "");
  if (leadPhone.includes("@")) {
    normalized = leadPhone.split("@")[0].replace(/\D/g, "");
  }
  if (!normalized.startsWith("55") && normalized.length >= 10 && normalized.length <= 11) {
    const ddd = parseInt(normalized.substring(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) normalized = "55" + normalized;
  }
  if (!normalized || normalized.length < 12 || normalized.length > 13) return null;
  return normalized;
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
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
      signer_name?: string;
    };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Corpo da requisição inválido" });
    }

    const contractId = body.contract_id?.trim();
    const signatureToken = body.signature_token?.trim();
    const signerName = (body.signer_name || "").trim();
    const signerCpf = cleanCpf(body.signer_cpf || "");

    if (!contractId || !signatureToken) {
      return json(400, { error: "contract_id e signature_token são obrigatórios" });
    }
    if (!signerName) {
      return json(400, { error: "Nome do signatário é obrigatório" });
    }
    if (!isValidCpf(signerCpf)) {
      return json(400, { error: "CPF inválido" });
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select(`
        id, organization_id, status, expires_at, signature_token,
        lead:leads(id, name, phone)
      `)
      .eq("id", contractId)
      .eq("signature_token", signatureToken)
      .maybeSingle();

    if (contractError || !contract) {
      return json(404, { error: "Contrato não encontrado ou link inválido" });
    }
    if (contract.status === "cancelled") {
      return json(400, { error: "Este contrato foi cancelado" });
    }
    if (contract.status === "signed") {
      return json(400, { error: "Este contrato já foi assinado" });
    }
    if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
      return json(400, { error: "Este contrato expirou" });
    }

    const lead = contract.lead as { id: string; name: string; phone: string } | null;
    if (!lead?.phone) {
      return json(400, {
        error: "Cliente sem telefone cadastrado. Não é possível enviar o código por WhatsApp.",
      });
    }

    const normalizedPhone = normalizePhone(lead.phone);
    if (!normalizedPhone) {
      return json(400, { error: "Telefone do cliente inválido para WhatsApp" });
    }

    // Rate limit: último OTP recente
    const { data: recentOtps } = await supabase
      .from("contract_signature_otps")
      .select("id, last_sent_at")
      .eq("contract_id", contractId)
      .eq("signature_token", signatureToken)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastSent = recentOtps?.[0]?.last_sent_at
      ? new Date(recentOtps[0].last_sent_at).getTime()
      : 0;
    if (lastSent && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return json(429, {
        error: `Aguarde ${waitSec}s antes de solicitar um novo código`,
        retry_after_seconds: waitSec,
      });
    }

    const { data: evolutionConfig, error: evoError } = await supabase
      .from("evolution_config")
      .select("api_url, api_key, instance_name, is_connected, organization_id")
      .eq("organization_id", contract.organization_id)
      .eq("is_connected", true)
      .limit(1)
      .maybeSingle();

    const testMode = Deno.env.get("SIGNATURE_OTP_TEST_MODE") === "true";

    if (!testMode && (evoError || !evolutionConfig?.api_url || !evolutionConfig.is_connected)) {
      return json(503, {
        error: "WhatsApp da empresa não está conectado. Tente novamente mais tarde.",
      });
    }

    const otpCode = generateOtp();
    const codeHash = await sha256Hex(`${contractId}|${signatureToken}|${signerCpf}|${otpCode}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: insertError } = await supabase.from("contract_signature_otps").insert({
      contract_id: contractId,
      signature_token: signatureToken,
      signer_cpf: signerCpf,
      signer_name: signerName,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      last_sent_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Erro ao gravar OTP:", insertError);
      return json(500, { error: "Erro ao gerar código de verificação" });
    }

    const message =
      `Seu código de assinatura Agilize: ${otpCode}. Válido por 10 minutos. Não compartilhe este código.`;

    if (!testMode && evolutionConfig) {
      const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, "");
      const sendUrl =
        `${evolutionApiUrl}/message/sendText/${encodeURIComponent(evolutionConfig.instance_name)}`;

      const evoRes = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionConfig.api_key || "",
        },
        body: JSON.stringify({
          number: normalizedPhone,
          text: message,
        }),
      });

      if (!evoRes.ok) {
        const errText = await evoRes.text();
        console.error("Erro Evolution sendText:", errText);
        return json(502, { error: "Falha ao enviar código por WhatsApp" });
      }
    }

    const response: Record<string, unknown> = {
      success: true,
      message: "Código enviado por WhatsApp",
      masked_phone: maskPhone(normalizedPhone),
      expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    };

    if (testMode) {
      response.test_otp = otpCode;
    }

    return json(200, response);
  } catch (error: unknown) {
    console.error("request-signature-otp:", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Erro interno",
    });
  }
});
