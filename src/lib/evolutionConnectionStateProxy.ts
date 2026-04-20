import { supabase } from "@/integrations/supabase/client";

function base64UrlToUtf8(segment: string): string {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return atob(b64);
}

/** Chave anon clássica (JWT) inclui `ref`. Chaves `sb_publishable_*` não são JWT — usar VITE_SUPABASE_PROJECT_REF. */
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

/**
 * URL base para Edge Functions. Com domínio customizado (proxy), chamar diretamente o host do projeto
 * evita 401 no gateway (JWT/Authorization atrás do proxy) e mantém o mesmo token de sessão.
 */
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

export type EvolutionConnectionStateResult = {
  evolutionOk: boolean;
  evolutionHttpStatus: number | null;
  body: unknown;
  proxyError?: string;
  proxyMessage?: string;
  edgeError?: string;
};

function parseJsonResponse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _raw: text.slice(0, 500) };
  }
}

/**
 * POST evolution-connection-state via fetch (cabeçalhos explícitos; mais previsível que invoke atrás de proxy).
 */
async function postConnectionStateOnce(
  configId: string,
  accessToken: string,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const baseUrl = resolveFunctionsBaseUrl();
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!baseUrl || !anon) {
    return { ok: false, status: 0, payload: { error: "VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY ausente" } };
  }

  const res = await fetch(`${baseUrl}/functions/v1/evolution-connection-state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anon,
    },
    body: JSON.stringify({ configId }),
  });

  const payload = parseJsonResponse(await res.text());
  return { ok: res.ok, status: res.status, payload };
}

function normalizeResult(payload: unknown): EvolutionConnectionStateResult {
  const d = payload as Partial<EvolutionConnectionStateResult> & { error?: string } | null;
  if (!d || typeof d !== "object") {
    return {
      evolutionOk: false,
      evolutionHttpStatus: null,
      body: null,
      edgeError: "Resposta vazia da edge",
    };
  }
  if ("error" in d && typeof d.error === "string" && !("evolutionOk" in d)) {
    return {
      evolutionOk: false,
      evolutionHttpStatus: null,
      body: null,
      edgeError: d.error,
    };
  }
  return {
    evolutionOk: Boolean(d.evolutionOk),
    evolutionHttpStatus: typeof d.evolutionHttpStatus === "number" ? d.evolutionHttpStatus : null,
    body: d.body ?? null,
    proxyError: d.proxyError,
    proxyMessage: d.proxyMessage,
  };
}

/**
 * Consulta GET /instance/connectionState via Edge Function (sem CORS no browser).
 */
export async function fetchEvolutionConnectionStateByConfigId(
  configId: string,
): Promise<EvolutionConnectionStateResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return {
      evolutionOk: false,
      evolutionHttpStatus: null,
      body: null,
      edgeError: "Sessão expirada ou ausente. Faça login novamente.",
    };
  }

  let token = session.access_token;
  let { ok, status, payload } = await postConnectionStateOnce(configId, token);

  if (status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      token = refreshed.session.access_token;
      ({ ok, status, payload } = await postConnectionStateOnce(configId, token));
    }
  }

  if (!ok) {
    const err = normalizeResult(payload);
    if (err.edgeError) {
      return { ...err, evolutionHttpStatus: status || err.evolutionHttpStatus };
    }
    return {
      evolutionOk: false,
      evolutionHttpStatus: status,
      body: payload,
      edgeError: `HTTP ${status}`,
    };
  }

  return normalizeResult(payload);
}
