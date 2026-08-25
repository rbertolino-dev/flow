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

export type SyncOrgEvolutionProviderResult = {
  provider_id: string;
  provider_name: string;
  api_url: string;
  remote_total: number;
  remote_connected: number;
  created: string[];
  updated: string[];
  disconnected: string[];
  skipped_name_conflict: string[];
  skipped_other_org: Array<{ name: string; organization_id: string }>;
  tagged: number;
  fetch_error?: string;
};

export type SyncOrgEvolutionInstancesResult = {
  ok: boolean;
  organizationId?: string;
  tagged?: number;
  created?: number;
  updated?: number;
  disconnected?: number;
  skipped_name_conflict?: number;
  skipped_other_org?: number;
  skipped_limit?: number;
  providers?: SyncOrgEvolutionProviderResult[];
  error?: string;
};

export async function syncOrganizationEvolutionInstances(
  organizationId: string,
): Promise<SyncOrgEvolutionInstancesResult> {
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
    const res = await fetch(`${baseUrl}/functions/v1/sync-organization-evolution-instances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({ organizationId }),
    });
    const text = await res.text();
    let payload: SyncOrgEvolutionInstancesResult = { ok: false };
    try {
      payload = JSON.parse(text) as SyncOrgEvolutionInstancesResult;
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

export function describeEvolutionSyncResult(result: SyncOrgEvolutionInstancesResult): string {
  if (!result.ok) return result.error || "Falha ao sincronizar.";
  const parts: string[] = [];
  if ((result.created ?? 0) > 0) parts.push(`${result.created} criada(s)`);
  if ((result.updated ?? 0) > 0) parts.push(`${result.updated} atualizada(s)`);
  if ((result.disconnected ?? 0) > 0) parts.push(`${result.disconnected} desconectada(s)`);
  if ((result.tagged ?? 0) > 0) parts.push(`${result.tagged} etiquetada(s)`);
  if ((result.skipped_name_conflict ?? 0) > 0) {
    parts.push(`${result.skipped_name_conflict} com nome já usado em outra Evo`);
  }
  if ((result.skipped_other_org ?? 0) > 0) {
    parts.push(`${result.skipped_other_org} já em outra organização`);
  }
  if ((result.skipped_limit ?? 0) > 0) {
    parts.push(`${result.skipped_limit} fora do limite da organização`);
  }
  if (parts.length === 0) {
    return "Nenhuma instância nova. As Evos habilitadas já estavam alinhadas.";
  }
  return parts.join(" · ");
}
