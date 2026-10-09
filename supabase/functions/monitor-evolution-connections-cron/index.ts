import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  buildFetchInstancesStatusMap,
  resolveInstanceLiveStatusForSync,
} from "../_shared/evolution-fetch-instances.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ConfigRow = {
  id: string;
  organization_id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
  updated_at: string | null;
};

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

async function assertCallerAllowed(
  req: Request,
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseAnon: string,
  serviceKey: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Não autenticado" };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  // Cron / service role: match exato ou JWT com role service_role
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

async function loadAllConfigs(admin: ReturnType<typeof createClient>): Promise<ConfigRow[]> {
  const pageSize = 1000;
  const all: ConfigRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("evolution_config")
      .select("id, organization_id, instance_name, api_url, api_key, is_connected, updated_at")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ConfigRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
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
    const SYNC_CONCURRENCY = 5;

    const groups = new Map<string, ConfigRow[]>();
    for (const cfg of list) {
      const apiUrl = String(cfg.api_url ?? "").trim();
      const apiKey = String(cfg.api_key ?? "").trim();
      const gk = `${apiUrl}|||${apiKey}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push(cfg);
    }

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

        if (live === true) stillOpen++;

        if (live === cfg.is_connected) {
          unchanged++;
          if (live === true) {
            const { data: openAlerts } = await admin
              .from("platform_connection_alerts")
              .select("id")
              .eq("evolution_config_id", cfg.id)
              .is("resolved_at", null)
              .limit(20);
            if (openAlerts && openAlerts.length > 0) {
              const { error: resErr } = await admin
                .from("platform_connection_alerts")
                .update({ resolved_at: new Date().toISOString() })
                .eq("evolution_config_id", cfg.id)
                .is("resolved_at", null);
              if (!resErr) alertsResolved += openAlerts.length;
            }
          }
          return;
        }

        const lastMs = cfg.updated_at ? new Date(String(cfg.updated_at)).getTime() : 0;
        const ageMs = Date.now() - lastMs;
        if (ageMs < 45000) {
          unchanged++;
          return;
        }

        const wasConnected = cfg.is_connected === true;
        const { error: upErr } = await admin
          .from("evolution_config")
          .update({
            is_connected: live,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);

        if (upErr) {
          verifyErrors++;
          return;
        }

        if (live) {
          setConnected++;
          const { data: openAlerts } = await admin
            .from("platform_connection_alerts")
            .select("id")
            .eq("evolution_config_id", cfg.id)
            .is("resolved_at", null)
            .limit(50);
          if (openAlerts && openAlerts.length > 0) {
            const { error: resErr } = await admin
              .from("platform_connection_alerts")
              .update({ resolved_at: new Date().toISOString() })
              .eq("evolution_config_id", cfg.id)
              .is("resolved_at", null);
            if (!resErr) alertsResolved += openAlerts.length;
          }
        } else {
          setDisconnected++;
          if (wasConnected) {
            newlyDisconnected++;
            const { error: alertErr } = await admin.from("platform_connection_alerts").insert({
              organization_id: cfg.organization_id,
              organization_name: orgNameById.get(cfg.organization_id) ?? null,
              evolution_config_id: cfg.id,
              instance_name: name,
              provider_api_url: apiUrl,
              detected_at: new Date().toISOString(),
            });
            if (!alertErr) alertsCreated++;
          }
        }
      };

      for (let i = 0; i < groupConfigs.length; i += SYNC_CONCURRENCY) {
        const chunk = groupConfigs.slice(i, i + SYNC_CONCURRENCY);
        await Promise.all(chunk.map((cfg) => processOne(cfg)));
      }
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
        method: "monitor_global_no_qr_connectionState_first",
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
