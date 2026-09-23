import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { normalizeApiUrl } from "../_shared/evolution-connection-parse.ts";
import {
  buildChatwootSetBody,
  buildSettingsSetBody,
  buildWebhookSetBody,
  extractQrFromEvolutionResponse,
  isUuid,
  pickFetchInstance,
} from "../_shared/evolution-unstuck.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evoFetch(
  method: string,
  url: string,
  apiKey: string,
  body?: Record<string, unknown> | null,
  timeoutMs = 30000,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        apikey: apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text.trim()) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text.slice(0, 500);
      }
    }
    return { ok: res.ok, status: res.status, json: parsed };
  } finally {
    clearTimeout(timer);
  }
}

async function userCanAccessOrganization(
  admin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string | null,
): Promise<boolean> {
  if (!organizationId) return false;

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
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Use POST" });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "Não autenticado" });
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return json(401, { error: "Não autenticado" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnon || !supabaseService) {
    return json(500, { error: "Configuração do servidor incompleta" });
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(accessToken);

  if (userErr || !user) {
    return json(401, { error: "Sessão inválida" });
  }

  let body: { instanceId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
  if (!isUuid(instanceId)) {
    return json(400, { error: "instanceId inválido" });
  }

  const admin = createClient(supabaseUrl, supabaseService);

  const { data: config, error: cfgErr } = await admin
    .from("evolution_config")
    .select("id, api_url, api_key, instance_name, organization_id")
    .eq("id", instanceId)
    .maybeSingle();

  if (cfgErr || !config) {
    return json(404, { error: "Instância não encontrada" });
  }

  const allowed = await userCanAccessOrganization(admin, user.id, config.organization_id);
  if (!allowed) {
    return json(403, { error: "Sem permissão para esta instância" });
  }

  const apiKey = String(config.api_key || "").trim();
  const instanceName = String(config.instance_name || "").trim();
  if (!apiKey || !instanceName) {
    return json(400, { error: "Instância sem api_key ou nome no CRM" });
  }

  const base = normalizeApiUrl(String(config.api_url || ""));
  if (!base) {
    return json(400, { error: "URL da Evolution inválida" });
  }

  const enc = encodeURIComponent(instanceName);
  console.log("[unstuck-evolution-instance] start", {
    instanceId,
    instanceName,
    org: config.organization_id,
    userId: user.id,
  });

  const fetchAll = await evoFetch("GET", `${base}/instance/fetchInstances`, apiKey, null, 25000);
  const fetchMatch = pickFetchInstance(fetchAll.json, instanceName);

  const [chatwootFind, webhookFind, settingsFind] = await Promise.all([
    evoFetch("GET", `${base}/chatwoot/find/${enc}`, apiKey),
    evoFetch("GET", `${base}/webhook/find/${enc}`, apiKey),
    evoFetch("GET", `${base}/settings/find/${enc}`, apiKey),
  ]);

  const chatwootBackup = (chatwootFind.ok && chatwootFind.json)
    ? chatwootFind.json
    : (fetchMatch?.Chatwoot ?? null);
  const webhookBackup = webhookFind.ok ? webhookFind.json : null;
  const settingsBackup = settingsFind.ok ? settingsFind.json : (fetchMatch?.Setting ?? null);
  const instanceToken = typeof fetchMatch?.token === "string" ? fetchMatch.token : null;
  const integration = typeof fetchMatch?.integration === "string"
    ? fetchMatch.integration
    : "WHATSAPP-BAILEYS";

  const del = await evoFetch("DELETE", `${base}/instance/delete/${enc}`, apiKey, null, 25000);
  if (!del.ok && del.status !== 404) {
    return json(502, {
      error: "Não foi possível excluir a instância na Evolution",
      evolutionHttpStatus: del.status,
    });
  }

  await sleep(2500);

  const createBody: Record<string, unknown> = {
    instanceName,
    integration,
    qrcode: true,
  };
  if (instanceToken) createBody.token = instanceToken;

  let created = await evoFetch("POST", `${base}/instance/create`, apiKey, createBody, 60000);
  if (!created.ok) {
    await sleep(2000);
    created = await evoFetch("POST", `${base}/instance/create`, apiKey, createBody, 60000);
  }
  if (!created.ok) {
    return json(502, {
      error: "Instância excluída, mas a recriação na Evolution falhou. Tente novamente.",
      evolutionHttpStatus: created.status,
    });
  }

  await sleep(1500);

  const settingsBody = buildSettingsSetBody(settingsBackup);
  await evoFetch("POST", `${base}/settings/set/${enc}`, apiKey, settingsBody, 20000);

  const chatwootBody = buildChatwootSetBody(chatwootBackup, instanceName);
  let chatwootRestored = false;
  if (chatwootBody) {
    const cwSet = await evoFetch(
      "POST",
      `${base}/chatwoot/set/${enc}`,
      apiKey,
      chatwootBody,
      90000,
    );
    chatwootRestored = cwSet.ok;
    if (!cwSet.ok) {
      console.warn("[unstuck-evolution-instance] chatwoot/set falhou", cwSet.status);
    }
  }

  const webhookBody = buildWebhookSetBody(webhookBackup);
  let webhookRestored = false;
  if (webhookBody) {
    const whSet = await evoFetch(
      "POST",
      `${base}/webhook/set/${enc}`,
      apiKey,
      webhookBody,
      20000,
    );
    webhookRestored = whSet.ok;
  }

  await sleep(1500);
  const connect = await evoFetch("GET", `${base}/instance/connect/${enc}`, apiKey, null, 40000);
  let qr = extractQrFromEvolutionResponse(connect.json);
  if (!qr.qrCode && !qr.qrCodeData) {
    qr = extractQrFromEvolutionResponse(created.json);
  }

  await admin
    .from("evolution_config")
    .update({ is_connected: false, updated_at: new Date().toISOString() })
    .eq("id", instanceId);

  console.log("[unstuck-evolution-instance] done", {
    instanceName,
    chatwootRestored,
    webhookRestored,
    hasQr: Boolean(qr.qrCode || qr.qrCodeData),
  });

  return json(200, {
    success: true,
    instanceId,
    instanceName,
    chatwootRestored,
    webhookRestored,
    qrCode: qr.qrCode,
    qrCodeData: qr.qrCodeData,
    message: "Instância recriada. Escaneie o QR Code para conectar.",
  });
});
