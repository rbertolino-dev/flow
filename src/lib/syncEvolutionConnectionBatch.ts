import { supabase } from "@/integrations/supabase/client";

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
    const host = new URL(configured).hostname;
    if (host.endsWith(".supabase.co")) return configured;
  } catch {
    return configured;
  }
  const ref = getSupabaseProjectRef();
  if (ref) return `https://${ref}.supabase.co`;
  return configured;
}

export type SyncEvolutionBatchResult = {
  ok: boolean;
  setConnected?: number;
  setDisconnected?: number;
  checked?: number;
  verifyErrors?: number;
  skippedTransient?: number;
  total?: number;
  error?: string;
};

export async function syncEvolutionConnectionBatch(
  organizationId: string,
  options?: { onlyMarkedDisconnected?: boolean; instanceIds?: string[] },
): Promise<SyncEvolutionBatchResult> {
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
    const res = await fetch(`${baseUrl}/functions/v1/sync-evolution-connection-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        organizationId,
        onlyMarkedDisconnected: options?.onlyMarkedDisconnected ?? false,
        instanceIds:
          options?.instanceIds && options.instanceIds.length > 0
            ? options.instanceIds
            : undefined,
      }),
    });
    const text = await res.text();
    let payload: SyncEvolutionBatchResult & { error?: string } = { ok: false };
    try {
      payload = JSON.parse(text) as SyncEvolutionBatchResult & { error?: string };
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

  if (!res.ok) {
    return { ok: false, error: payload.error ?? `HTTP ${res.status}` };
  }

  return payload;
}
