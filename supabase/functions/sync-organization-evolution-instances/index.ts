import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { connectionStateToBoolean, normalizeApiUrl } from "../_shared/evolution-connection-parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createClient>;

type ProviderRow = {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
};

type CrmInstance = {
  id: string;
  instance_name: string;
  api_url: string;
  organization_id: string;
  evolution_provider_id: string | null;
  is_connected: boolean | null;
  phone_number: string | null;
};

type RemoteInstance = {
  name: string;
  connected: boolean | null;
  phone: string | null;
};

type ProviderResult = {
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function userCanAccessOrganization(
  admin: AdminClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return true;

  const { data: isPubdigital } = await admin.rpc("is_pubdigital_user", {
    _user_id: userId,
  });
  if (isPubdigital) return true;

  const { data: member } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  return !!member;
}

function instanceKey(name: string): string {
  return name.trim().toLowerCase();
}

function urlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeApiUrl(a) === normalizeApiUrl(b);
}

function parseRemoteInstances(data: unknown): RemoteInstance[] {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const out: RemoteInstance[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const inst = (rec.instance as Record<string, unknown> | undefined) ?? rec;
    const name = String(inst.instanceName ?? inst.name ?? rec.instanceName ?? rec.name ?? "").trim();
    if (!name) continue;
    const rawStatus = inst.connectionStatus ?? inst.status ?? inst.state ?? rec.status ?? rec.state;
    const connected = connectionStateToBoolean(rawStatus == null ? undefined : String(rawStatus));
    const owner = inst.ownerJid ?? rec.ownerJid ?? inst.owner ?? rec.owner;
    let phone: string | null = null;
    if (typeof owner === "string" && owner.includes("@")) {
      phone = owner.split("@")[0] || null;
    } else if (typeof inst.number === "string" && inst.number.trim()) {
      phone = inst.number.trim();
    }
    out.push({ name, connected, phone });
  }
  return out;
}

function belongsToProvider(row: CrmInstance, provider: ProviderRow): boolean {
  return row.evolution_provider_id === provider.id || urlsMatch(row.api_url, provider.api_url);
}

async function orgCanCreateInstance(
  admin: AdminClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("can_create_evolution_instance", {
    _org_id: organizationId,
    _user_id: userId,
  });
  if (!error && typeof data === "boolean") return data;

  const { data: limits } = await admin
    .from("organization_limits")
    .select("max_evolution_instances")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const max = (limits as { max_evolution_instances?: number | null } | null)?.max_evolution_instances;
  if (max == null) return true;
  const { count } = await admin
    .from("evolution_config")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  return (count ?? 0) < max;
}

async function fetchRemoteInstances(apiUrl: string, apiKey: string): Promise<RemoteInstance[]> {
  const base = normalizeApiUrl(apiUrl);
  const res = await fetch(`${base}/instance/fetchInstances`, {
    headers: { apikey: apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new Error(`Evolution fetchInstances HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseRemoteInstances(data);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Use POST" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, supabaseService, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser(accessToken);
  if (userErr || !user) {
    return jsonResponse({ error: "Sessão inválida" }, 401);
  }

  let body: { organizationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const organizationId = String(body.organizationId || "").trim();
  if (!organizationId) {
    return jsonResponse({ error: "organizationId é obrigatório" }, 400);
  }

  if (!(await userCanAccessOrganization(admin, user.id, organizationId))) {
    return jsonResponse({ error: "Sem permissão nesta organização" }, 403);
  }

  const { data: orgProviders, error: orgProvErr } = await admin
    .from("organization_evolution_providers")
    .select("evolution_provider_id")
    .eq("organization_id", organizationId);

  if (orgProvErr) {
    return jsonResponse({ error: orgProvErr.message }, 500);
  }

  let providerIds = (orgProviders || []).map((r: { evolution_provider_id: string }) => r.evolution_provider_id);

  if (providerIds.length === 0) {
    const { data: limits } = await admin
      .from("organization_limits")
      .select("evolution_provider_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (limits?.evolution_provider_id) {
      providerIds = [limits.evolution_provider_id];
    }
  }

  if (providerIds.length === 0) {
    return jsonResponse({
      ok: false,
      error: "Nenhum servidor Evolution habilitado para esta organização.",
      providers: [],
    }, 400);
  }

  const { data: providers, error: provErr } = await admin
    .from("evolution_providers")
    .select("id, name, api_url, api_key, is_active")
    .in("id", providerIds)
    .eq("is_active", true)
    .order("name");

  if (provErr) {
    return jsonResponse({ error: provErr.message }, 500);
  }

  const activeProviders = (providers || []) as ProviderRow[];
  if (activeProviders.length === 0) {
    return jsonResponse({
      ok: false,
      error: "Nenhum servidor Evolution ativo habilitado para esta organização.",
      providers: [],
    }, 400);
  }

  const { data: crmRows, error: crmErr } = await admin
    .from("evolution_config")
    .select("id, instance_name, api_url, organization_id, evolution_provider_id, is_connected, phone_number")
    .eq("organization_id", organizationId);

  if (crmErr) {
    return jsonResponse({ error: crmErr.message }, 500);
  }

  const crmList = (crmRows || []) as CrmInstance[];
  const crmByName = new Map<string, CrmInstance>();
  for (const row of crmList) {
    crmByName.set(instanceKey(row.instance_name), row);
  }

  let tagged = 0;
  for (const row of crmList) {
    if (row.evolution_provider_id) continue;
    const match = activeProviders.find((p) => urlsMatch(p.api_url, row.api_url));
    if (!match) continue;
    const { error } = await admin
      .from("evolution_config")
      .update({ evolution_provider_id: match.id })
      .eq("id", row.id);
    if (!error) {
      row.evolution_provider_id = match.id;
      tagged += 1;
    }
  }

  const results: ProviderResult[] = [];
  let createdTotal = 0;
  let updatedTotal = 0;
  let disconnectedTotal = 0;
  let conflictTotal = 0;
  let otherOrgTotal = 0;
  let skippedLimit = 0;

  for (const provider of activeProviders) {
    const result: ProviderResult = {
      provider_id: provider.id,
      provider_name: provider.name,
      api_url: normalizeApiUrl(provider.api_url),
      remote_total: 0,
      remote_connected: 0,
      created: [],
      updated: [],
      disconnected: [],
      skipped_name_conflict: [],
      skipped_other_org: [],
      tagged: 0,
    };

    let remote: RemoteInstance[] = [];
    try {
      remote = await fetchRemoteInstances(provider.api_url, provider.api_key);
    } catch (e) {
      result.fetch_error = e instanceof Error ? e.message : String(e);
      results.push(result);
      continue;
    }

    result.remote_total = remote.length;
    const connected = remote.filter((i) => i.connected === true);
    result.remote_connected = connected.length;

    for (const inst of connected) {
      const key = instanceKey(inst.name);
      const existing = crmByName.get(key);

      if (existing) {
        if (!belongsToProvider(existing, provider)) {
          result.skipped_name_conflict.push(inst.name);
          conflictTotal += 1;
          continue;
        }

        const normalizedUrl = normalizeApiUrl(provider.api_url);
        const needsVisibleUpdate =
          existing.evolution_provider_id !== provider.id ||
          !urlsMatch(existing.api_url, provider.api_url) ||
          existing.is_connected !== true ||
          (!!inst.phone && !existing.phone_number);

        if (!needsVisibleUpdate) continue;

        const patch: Record<string, unknown> = {
          evolution_provider_id: provider.id,
          api_url: normalizedUrl,
          api_key: provider.api_key,
          is_connected: true,
        };
        if (inst.phone && !existing.phone_number) {
          patch.phone_number = inst.phone;
        }
        const { error } = await admin
          .from("evolution_config")
          .update(patch)
          .eq("id", existing.id);
        if (!error) {
          result.updated.push(inst.name);
          updatedTotal += 1;
          existing.evolution_provider_id = provider.id;
          existing.api_url = normalizedUrl;
          existing.is_connected = true;
          if (inst.phone && !existing.phone_number) existing.phone_number = inst.phone;
        }
        continue;
      }

      const { data: otherOrg } = await admin
        .from("evolution_config")
        .select("id, organization_id, api_url")
        .ilike("instance_name", inst.name)
        .neq("organization_id", organizationId);

      const ownedElsewhere = (otherOrg || []).find((row: { api_url: string }) =>
        urlsMatch(row.api_url, provider.api_url)
      );
      if (ownedElsewhere) {
        result.skipped_other_org.push({
          name: inst.name,
          organization_id: ownedElsewhere.organization_id,
        });
        otherOrgTotal += 1;
        continue;
      }

      const stillCan = await orgCanCreateInstance(admin, organizationId, user.id);
      if (stillCan === false) {
        skippedLimit += 1;
        continue;
      }

      const insertPayload = {
        user_id: user.id,
        organization_id: organizationId,
        api_url: normalizeApiUrl(provider.api_url),
        api_key: provider.api_key,
        instance_name: inst.name,
        phone_number: inst.phone,
        is_connected: true,
        webhook_enabled: true,
        webhook_secret: crypto.randomUUID(),
        evolution_provider_id: provider.id,
      };

      const { data: inserted, error: insertErr } = await admin
        .from("evolution_config")
        .insert(insertPayload)
        .select("id, instance_name, api_url, organization_id, evolution_provider_id, is_connected, phone_number")
        .single();

      if (insertErr || !inserted) {
        if (insertErr?.code === "23505") {
          result.skipped_name_conflict.push(inst.name);
          conflictTotal += 1;
        }
        continue;
      }

      const createdRow = inserted as CrmInstance;
      crmByName.set(key, createdRow);
      result.created.push(inst.name);
      createdTotal += 1;
    }

    const closed = remote.filter((i) => i.connected === false);
    for (const inst of closed) {
      const existing = crmByName.get(instanceKey(inst.name));
      if (!existing || !belongsToProvider(existing, provider)) continue;
      if (existing.is_connected === false && existing.evolution_provider_id === provider.id) continue;

      const wasConnected = existing.is_connected !== false;
      const { error } = await admin
        .from("evolution_config")
        .update({
          evolution_provider_id: provider.id,
          api_url: normalizeApiUrl(provider.api_url),
          is_connected: false,
        })
        .eq("id", existing.id);
      if (!error) {
        existing.evolution_provider_id = provider.id;
        existing.api_url = normalizeApiUrl(provider.api_url);
        existing.is_connected = false;
        if (wasConnected) {
          result.disconnected.push(inst.name);
          disconnectedTotal += 1;
        }
      }
    }

    results.push(result);
  }

  return jsonResponse({
    ok: true,
    organizationId,
    tagged,
    created: createdTotal,
    updated: updatedTotal,
    disconnected: disconnectedTotal,
    skipped_name_conflict: conflictTotal,
    skipped_other_org: otherOrgTotal,
    skipped_limit: skippedLimit,
    providers: results,
  });
});
