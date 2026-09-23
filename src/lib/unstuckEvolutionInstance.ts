import { supabase } from "@/integrations/supabase/client";
import { evolutionConnectResponseToQrDataUrl } from "@/lib/evolutionStatus";

function base64UrlToUtf8(segment: string): string {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return atob(b64);
}

function decodeProjectRefFromJwtStyleKey(anon: string | undefined): string | null {
  const parts = anon?.split(".") ?? [];
  if (parts.length < 2) return null;
  try {
    const json = base64UrlToUtf8(parts[1]);
    const payload = JSON.parse(json) as { ref?: string };
    return typeof payload.ref === "string" && payload.ref.length > 0 ? payload.ref : null;
  } catch {
    return null;
  }
}

function getSupabaseProjectRef(): string | null {
  const fromEnv = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  return decodeProjectRefFromJwtStyleKey(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);
}

function resolveFunctionsBaseUrl(): string {
  const configured = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  if (!configured) return "";
  try {
    const host = new URL(configured).hostname;
    if (host.endsWith(".supabase.co")) return configured;
  } catch {
    return configured;
  }
  const ref = getSupabaseProjectRef();
  if (ref) return `https://${ref}.supabase.co`;
  return configured;
}

export type UnstuckEvolutionResult = {
  success: boolean;
  instanceId?: string;
  instanceName?: string;
  chatwootRestored?: boolean;
  webhookRestored?: boolean;
  qrCode: string | null;
  qrCodeData: string | null;
  message?: string;
  error?: string;
};

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 300) };
  }
}

/**
 * Destrava uma instância Evolution: backup (Chatwoot/webhook) → exclui → recria → restaura.
 * Só envia instanceId; a edge busca credenciais no banco e valida o usuário.
 */
export async function unstuckEvolutionInstance(instanceId: string): Promise<UnstuckEvolutionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, qrCode: null, qrCodeData: null, error: "Sessão expirada. Faça login novamente." };
  }

  const baseUrl = resolveFunctionsBaseUrl();
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!baseUrl || !anon) {
    return { success: false, qrCode: null, qrCodeData: null, error: "Configuração do cliente incompleta." };
  }

  let token = session.access_token;
  const post = async (accessToken: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      return await fetch(`${baseUrl}/functions/v1/unstuck-evolution-instance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anon,
        },
        body: JSON.stringify({ instanceId }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await post(token);
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "Tempo esgotado ao destravar a instância."
      : (e instanceof Error ? e.message : "Falha de rede");
    return { success: false, qrCode: null, qrCodeData: null, error: msg };
  }

  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      token = refreshed.session.access_token;
      try {
        res = await post(token);
      } catch (e) {
        return {
          success: false,
          qrCode: null,
          qrCodeData: null,
          error: e instanceof Error ? e.message : "Falha de rede",
        };
      }
    }
  }

  const payload = parseJson(await res.text()) as UnstuckEvolutionResult & { error?: string };
  if (!res.ok) {
    return {
      success: false,
      qrCode: null,
      qrCodeData: null,
      error: payload?.error || `HTTP ${res.status}`,
    };
  }

  let qrCode = typeof payload?.qrCode === "string" ? payload.qrCode : null;
  const qrCodeData = typeof payload?.qrCodeData === "string" ? payload.qrCodeData : null;
  if (!qrCode && qrCodeData) {
    qrCode = await evolutionConnectResponseToQrDataUrl({ code: qrCodeData });
  }

  return {
    success: true,
    instanceId: payload.instanceId,
    instanceName: payload.instanceName,
    chatwootRestored: Boolean(payload.chatwootRestored),
    webhookRestored: Boolean(payload.webhookRestored),
    qrCode,
    qrCodeData,
    message: payload.message,
  };
}
