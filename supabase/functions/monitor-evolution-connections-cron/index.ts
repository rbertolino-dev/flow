import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  buildFetchInstancesStatusMap,
  fetchConnectionStateSingle,
  resolveInstanceLiveStatusForSync,
} from "../_shared/evolution-fetch-instances.ts";
import { normalizeApiUrl } from "../_shared/evolution-connection-parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTO_RECONNECT_COOLDOWN_MS = 30 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 12000;
const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 2000;
/** Cap por execução para caber no timeout da edge (~150s idle). */
const MAX_RECONNECTS_PER_RUN = 10;
const SYNC_CONCURRENCY = 5;
const RECONNECT_CONCURRENCY = 2;

type ConfigRow = {
  id: string;
  organization_id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
  updated_at: string | null;
  phone_number?: string | null;
};

type OpenAlert = {
  id: string;
  last_auto_reconnect_at: string | null;
};

type AdminClient = ReturnType<typeof createClient>;

function jwtRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertCallerAllowed(
  req: Request,
  admin: AdminClient,
  supabaseUrl: string,
  supabaseAnon: string,
  serviceKey: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Não autenticado" };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && (token === serviceKey || jwtRole(token) === "service_role")) {
    return { ok: true };
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !user) {
    return { ok: false, status: 401, error: "Sessão inválida" };
  }

  const [{ data: isAdmin }, { data: isPubdigital }] = await Promise.all([
    admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    admin.rpc("is_pubdigital_user", { _user_id: user.id }),
  ]);

  if (isAdmin || isPubdigital) {
    return { ok: true };
  }

  return { ok: false, status: 403, error: "Sem permissão" };
}

async function loadAllConfigs(admin: AdminClient): Promise<ConfigRow[]> {
  const pageSize = 1000;
  const all: ConfigRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("evolution_config")
      .select("id, organization_id, instance_name, api_url, api_key, is_connected, updated_at, phone_number")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ConfigRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

async function getOpenAlert(admin: AdminClient, configId: string): Promise<OpenAlert | null> {
  const { data } = await admin
    .from("platform_connection_alerts")
    .select("id, last_auto_reconnect_at")
    .eq("evolution_config_id", configId)
    .is("resolved_at", null)
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OpenAlert | null) ?? null;
}

async function resolveOpenAlerts(
  admin: AdminClient,
  configId: string,
  opts?: { fromAutoReconnect?: boolean },
): Promise<number> {
  const { data: openAlerts } = await admin
    .from("platform_connection_alerts")
    .select("id")
    .eq("evolution_config_id", configId)
    .is("resolved_at", null)
    .limit(50);
  if (!openAlerts?.length) return 0;
  const patch: Record<string, unknown> = {
    resolved_at: new Date().toISOString(),
  };
  if (opts?.fromAutoReconnect) {
    patch.auto_reconnect_result = "restored";
    patch.last_auto_reconnect_at = new Date().toISOString();
  }
  const { error } = await admin
    .from("platform_connection_alerts")
    .update(patch)
    .eq("evolution_config_id", configId)
    .is("resolved_at", null);
  return error ? 0 : openAlerts.length;
}

async function ensureOpenAlert(
  admin: AdminClient,
  cfg: ConfigRow,
  orgName: string | null,
  apiUrl: string,
  patch?: { last_auto_reconnect_at?: string; auto_reconnect_result?: string },
): Promise<{ created: boolean; alertId: string | null }> {
  const existing = await getOpenAlert(admin, cfg.id);
  if (existing) {
    if (patch && Object.keys(patch).length > 0) {
      await admin.from("platform_connection_alerts").update(patch).eq("id", existing.id);
    }
    return { created: false, alertId: existing.id };
  }

  const { data, error } = await admin
    .from("platform_connection_alerts")
    .insert({
      organization_id: cfg.organization_id,
      organization_name: orgName,
      evolution_config_id: cfg.id,
      instance_name: cfg.instance_name,
      provider_api_url: apiUrl,
      detected_at: new Date().toISOString(),
      ...(patch ?? {}),
    })
    .select("id")
    .single();

  if (error) return { created: false, alertId: null };
  return { created: true, alertId: data?.id ?? null };
}

/** Silent reconnect: call /instance/connect but never persist QR. */
async function trySilentReconnect(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<"restored" | "needs_scan" | "error"> {
  const baseUrl = normalizeApiUrl(apiUrl);
  const connectUrl = `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`;

  try {
    const res = await fetch(connectUrl, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
    });
    // Discard body (may contain base64 QR) — never persist
    await res.text().catch(() => "");
    if (!res.ok && res.status !== 200) {
      // Some Evolution builds still return 200 with QR; non-2xx = hard error
      if (res.status >= 400) return "error";
    }
  } catch {
    return "error";
  }

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await sleep(POLL_DELAY_MS);
    const state = await fetchConnectionStateSingle(apiUrl, apiKey, instanceName, 12000, true);
    if (state.live === true) return "restored";
  }

  return "needs_scan";
}

async function fetchOwnerPhone(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<string | null> {
  try {
    const baseUrl = normalizeApiUrl(apiUrl);
    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [data];
    const key = instanceName.trim().toLowerCase();
    for (const row of rows) {
      const o = row as Record<string, unknown>;
      const inst = (o.instance as Record<string, unknown> | undefined) ?? o;
      const name = String(inst.instanceName ?? inst.name ?? o.instanceName ?? "").trim().toLowerCase();
      if (name !== key) continue;
      const jid = String(inst.ownerJid ?? o.ownerJid ?? "");
      if (!jid) return null;
      return jid.split("@")[0] || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function inCooldown(lastAt: string | null | undefined): boolean {
  if (!lastAt) return false;
  const ms = Date.now() - new Date(lastAt).getTime();
  return ms >= 0 && ms < AUTO_RECONNECT_COOLDOWN_MS;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseService);

  const auth = await assertCallerAllowed(req, admin, supabaseUrl, supabaseAnon, supabaseService);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const list = await loadAllConfigs(admin);
    const orgIds = [...new Set(list.map((c) => c.organization_id).filter(Boolean))];
    const orgNameById = new Map<string, string>();
    for (let i = 0; i < orgIds.length; i += 100) {
      const chunk = orgIds.slice(i, i + 100);
      const { data: orgs } = await admin.from("organizations").select("id, name").in("id", chunk);
      for (const o of orgs ?? []) {
        orgNameById.set(o.id, o.name ?? "—");
      }
    }

    let checked = 0;
    let setConnected = 0;
    let setDisconnected = 0;
    let unchanged = 0;
    let verifyErrors = 0;
    let skippedTransient = 0;
    let newlyDisconnected = 0;
    let alertsCreated = 0;
    let alertsResolved = 0;
    let stillOpen = 0;
    let autoReconnectAttempted = 0;
    let autoReconnectRestored = 0;
    let autoReconnectFailed = 0;
    let autoReconnectSkippedCooldown = 0;

    type ReconnectCandidate = {
      cfg: ConfigRow;
      apiUrl: string;
      apiKey: string;
      name: string;
    };
    const reconnectCandidates: ReconnectCandidate[] = [];

    const groups = new Map<string, ConfigRow[]>();
    for (const cfg of list) {
      const apiUrl = String(cfg.api_url ?? "").trim();
      const apiKey = String(cfg.api_key ?? "").trim();
      const gk = `${apiUrl}|||${apiKey}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push(cfg);
    }

    // Pass 1: sync status (no connect yet)
    for (const [, groupConfigs] of groups) {
      const sampleCfg = groupConfigs[0];
      const apiUrl = String(sampleCfg.api_url ?? "").trim();
      const apiKey = String(sampleCfg.api_key ?? "").trim();
      if (!apiUrl || !apiKey) {
        verifyErrors += groupConfigs.length;
        continue;
      }

      const fetchMap = await buildFetchInstancesStatusMap(apiUrl, apiKey);

      const processOne = async (cfg: ConfigRow) => {
        const name = String(cfg.instance_name ?? "").trim();
        if (!name) {
          verifyErrors++;
          return;
        }

        const resolved = await resolveInstanceLiveStatusForSync(apiUrl, apiKey, name, fetchMap);
        const live = resolved.live;
        checked++;

        if (live === null) {
          skippedTransient++;
          if (cfg.is_connected === true) stillOpen++;
          return;
        }

        if (live === true) {
          stillOpen++;
          if (cfg.is_connected === true) {
            unchanged++;
            const n = await resolveOpenAlerts(admin, cfg.id);
            alertsResolved += n;
            return;
          }

          const lastMs = cfg.updated_at ? new Date(String(cfg.updated_at)).getTime() : 0;
          if (Date.now() - lastMs < 45000) {
            unchanged++;
            return;
          }

          const { error: upErr } = await admin
            .from("evolution_config")
            .update({
              is_connected: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cfg.id);
          if (upErr) {
            verifyErrors++;
            return;
          }
          setConnected++;
          alertsResolved += await resolveOpenAlerts(admin, cfg.id);
          return;
        }

        // live === false
        const wasConnected = cfg.is_connected === true;
        if (wasConnected) {
          const lastMs = cfg.updated_at ? new Date(String(cfg.updated_at)).getTime() : 0;
          if (Date.now() - lastMs < 45000) {
            unchanged++;
            reconnectCandidates.push({ cfg, apiUrl, apiKey, name });
            return;
          }
          const { error: upErr } = await admin
            .from("evolution_config")
            .update({
              is_connected: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cfg.id);
          if (upErr) {
            verifyErrors++;
            return;
          }
          setDisconnected++;
          newlyDisconnected++;
          const ensured = await ensureOpenAlert(
            admin,
            cfg,
            orgNameById.get(cfg.organization_id) ?? null,
            apiUrl,
          );
          if (ensured.created) alertsCreated++;
        } else {
          unchanged++;
          // Already marked disconnected — still candidate for silent reconnect
          await ensureOpenAlert(
            admin,
            cfg,
            orgNameById.get(cfg.organization_id) ?? null,
            apiUrl,
          );
        }

        reconnectCandidates.push({ cfg, apiUrl, apiKey, name });
      };

      for (let i = 0; i < groupConfigs.length; i += SYNC_CONCURRENCY) {
        const chunk = groupConfigs.slice(i, i + SYNC_CONCURRENCY);
        await Promise.all(chunk.map((cfg) => processOne(cfg)));
      }
    }

    // Pass 2: silent auto-reconnect (cap + concurrency 2)
    // Prefer never-attempted, then oldest attempt
    const eligible: Array<ReconnectCandidate & { lastAttemptMs: number }> = [];
    for (const item of reconnectCandidates) {
      const openAlert = await getOpenAlert(admin, item.cfg.id);
      if (openAlert && inCooldown(openAlert.last_auto_reconnect_at)) {
        autoReconnectSkippedCooldown++;
        continue;
      }
      const lastMs = openAlert?.last_auto_reconnect_at
        ? new Date(openAlert.last_auto_reconnect_at).getTime()
        : 0;
      eligible.push({ ...item, lastAttemptMs: lastMs });
    }
    eligible.sort((a, b) => a.lastAttemptMs - b.lastAttemptMs);
    const toReconnect = eligible.slice(0, MAX_RECONNECTS_PER_RUN);
    autoReconnectSkippedCooldown += Math.max(0, eligible.length - toReconnect.length);

    for (let i = 0; i < toReconnect.length; i += RECONNECT_CONCURRENCY) {
      const chunk = toReconnect.slice(i, i + RECONNECT_CONCURRENCY);
      await Promise.all(chunk.map(async (item) => {
        const { cfg, apiUrl, apiKey, name } = item;
        const openAlert = await getOpenAlert(admin, cfg.id);

        autoReconnectAttempted++;
        const result = await trySilentReconnect(apiUrl, apiKey, name);
        const nowIso = new Date().toISOString();

        if (result === "restored") {
          autoReconnectRestored++;
          stillOpen++;
          const phone = await fetchOwnerPhone(apiUrl, apiKey, name);
          const patch: Record<string, unknown> = {
            is_connected: true,
            updated_at: nowIso,
          };
          if (phone) patch.phone_number = phone;
          await admin.from("evolution_config").update(patch).eq("id", cfg.id);

          if (openAlert) {
            await admin
              .from("platform_connection_alerts")
              .update({
                resolved_at: nowIso,
                last_auto_reconnect_at: nowIso,
                auto_reconnect_result: "restored",
              })
              .eq("id", openAlert.id);
            alertsResolved++;
          } else {
            alertsResolved += await resolveOpenAlerts(admin, cfg.id, { fromAutoReconnect: true });
          }
          return;
        }

        autoReconnectFailed++;
        const ensured = await ensureOpenAlert(
          admin,
          cfg,
          orgNameById.get(cfg.organization_id) ?? null,
          apiUrl,
          {
            last_auto_reconnect_at: nowIso,
            auto_reconnect_result: result,
          },
        );
        if (ensured.created) alertsCreated++;
      }));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: list.length,
        checked,
        updated: setConnected + setDisconnected,
        setConnected,
        setDisconnected,
        newlyDisconnected,
        stillOpen,
        unchanged,
        verifyErrors,
        skippedTransient,
        alertsCreated,
        alertsResolved,
        autoReconnectAttempted,
        autoReconnectRestored,
        autoReconnectFailed,
        autoReconnectSkippedCooldown,
        autoReconnectQueued: toReconnect.length,
        method: "monitor_global_silent_auto_reconnect_no_qr",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[monitor-evolution-connections-cron]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
