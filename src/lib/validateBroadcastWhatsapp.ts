import { supabase } from "@/integrations/supabase/client";
import { parseContactList, type ParsedContact, type ValidationResult } from "@/lib/contactValidator";

function getSupabaseProjectRef(): string | null {
  const fromEnv = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const parts = anon?.split(".") ?? [];
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { ref?: string };
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

function resolveFunctionsBaseUrl(): string {
  const configured = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  if (!configured) return "";
  try {
    if (new URL(configured).hostname.endsWith(".supabase.co")) return configured;
  } catch {
    return configured;
  }
  const ref = getSupabaseProjectRef();
  return ref ? `https://${ref}.supabase.co` : configured;
}

export type BroadcastWhatsappValidationResponse = {
  ok: boolean;
  skippedApiValidation?: boolean;
  usedInstance?: string | null;
  warning?: string;
  validatedNumbers?: string[];
  rejectedNumbers?: string[];
  error?: string;
};

/**
 * Validação WhatsApp no servidor (Evolution), mesma rede do sync — evita CORS e Connection Closed falso no browser.
 */
export async function validateBroadcastWhatsappViaEdge(
  organizationId: string,
  instanceIds: string[],
  numbers: string[],
  useLatamValidator: boolean,
): Promise<BroadcastWhatsappValidationResponse> {
  const baseUrl = resolveFunctionsBaseUrl();
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!baseUrl || !anon) {
    return { ok: false, error: "Configuração Supabase ausente" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "Sessão expirada" };
  }

  const post = async (token: string) => {
    const res = await fetch(`${baseUrl}/functions/v1/validate-broadcast-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        organizationId,
        instanceIds,
        numbers,
        useLatamValidator,
      }),
    });
    const text = await res.text();
    let payload: BroadcastWhatsappValidationResponse = { ok: false };
    try {
      payload = JSON.parse(text) as BroadcastWhatsappValidationResponse;
    } catch {
      payload = { ok: false, error: text.slice(0, 200) };
    }
    return { res, payload };
  };

  let token = session.access_token;
  let { res, payload } = await post(token);
  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      token = refreshed.session.access_token;
      ({ res, payload } = await post(token));
    }
  }

  if (!res.ok && payload.error) {
    return { ...payload, ok: false };
  }
  return payload;
}

/** Monta ValidationResult a partir da lista parseada + resposta da edge. */
export function buildValidationResultFromEdge(
  text: string,
  edge: BroadcastWhatsappValidationResponse,
  useLatamValidator: boolean,
): ValidationResult {
  const parsed = parseContactList(text, useLatamValidator);
  const validSet = new Set(edge.validatedNumbers ?? []);
  const whatsappValidated: ParsedContact[] = [];
  const whatsappRejected: ParsedContact[] = [];

  for (const c of parsed) {
    if (!c.valid) continue;
    if (validSet.has(c.phone)) whatsappValidated.push(c);
    else whatsappRejected.push({ ...c, valid: false, error: "Sem WhatsApp" });
  }

  return {
    validContacts: parsed.filter((c) => c.valid),
    invalidContacts: parsed.filter((c) => !c.valid),
    whatsappValidated,
    whatsappRejected: [...parsed.filter((c) => !c.valid), ...whatsappRejected],
  };
}
