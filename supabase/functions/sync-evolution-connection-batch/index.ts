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

async function userCanAccessOrganization(
  admin: ReturnType<typeof createClient>,
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

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser(accessToken);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    organizationId?: string;
    onlyMarkedDisconnected?: boolean;
    instanceIds?: string[];
  } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const organizationId = typeof body.organizationId === "string"
    ? body.organizationId.trim()
    : "";
  if (!organizationId) {
    return new Response(JSON.stringify({ error: "organizationId é obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, supabaseService);
  const allowed = await userCanAccessOrganization(admin, user.id, organizationId);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let query = admin
    .from("evolution_config")
    .select("id, instance_name, api_url, api_key, is_connected")
    .eq("organization_id", organizationId);

  if (body.onlyMarkedDisconnected === true) {
    query = query.eq("is_connected", false);
  }

  const filterIds = Array.isArray(body.instanceIds)
    ? body.instanceIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (filterIds.length > 0) {
    query = query.in("id", filterIds);
  }

  const { data: configs, error: cfgErr } = await query;
  if (cfgErr) {
    return new Response(JSON.stringify({ error: cfgErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const list = configs ?? [];
  let checked = 0;
  let setConnected = 0;
  let setDisconnected = 0;
  let unchanged = 0;
  let verifyErrors = 0;
  let skippedTransient = 0;
  const SYNC_CONCURRENCY = 5;
  const samples: Array<{
    instance_name: string;
    was: boolean;
    live: boolean | null;
    source?: string;
    error?: string;
  }> = [];

  // Agrupar por servidor Evolution (1 fetchInstances por api_url+api_key)
  const groups = new Map<string, typeof list>();
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

    const processOne = async (cfg: (typeof list)[0]) => {
      const name = String(cfg.instance_name ?? "").trim();
      if (!name) {
        verifyErrors++;
        return;
      }

      const resolved = await resolveInstanceLiveStatusForSync(apiUrl, apiKey, name, fetchMap);
      const live = resolved.live;
      checked++;

      if (samples.length < 15) {
        samples.push({
          instance_name: name,
          was: cfg.is_connected === true,
          live,
          source: resolved.source,
          error: resolved.error,
        });
      }

      if (live === null) {
        skippedTransient++;
        return;
      }

      if (live === cfg.is_connected) {
        unchanged++;
        return;
      }

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

      if (live) setConnected++;
      else setDisconnected++;
    };

    for (let i = 0; i < groupConfigs.length; i += SYNC_CONCURRENCY) {
      const chunk = groupConfigs.slice(i, i + SYNC_CONCURRENCY);
      await Promise.all(chunk.map((cfg) => processOne(cfg)));
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      organizationId,
      total: list.length,
      checked,
      setConnected,
      setDisconnected,
      unchanged,
      verifyErrors,
      skippedTransient,
      scopedInstanceIds: filterIds.length > 0 ? filterIds.length : null,
      method: "sync_batch_safe_transient_connectionState_first",
      samples,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
