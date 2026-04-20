import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeApiUrl(url: string): string {
  try {
    const u = new URL(url);
    let base = u.origin + u.pathname.replace(/\/$/, "");
    base = base.replace(/\/(manager|dashboard|app)$/i, "");
    return base;
  } catch {
    return url.replace(/\/$/, "").replace(/\/(manager|dashboard|app)$/i, "");
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
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(accessToken);

  if (userErr || !user) {
    console.warn("[evolution-connection-state] getUser falhou:", userErr?.message ?? userErr);
    return new Response(
      JSON.stringify({
        error: "Sessão inválida",
        authCode: userErr?.code ?? null,
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: { configId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const configId = typeof body?.configId === "string" ? body.configId.trim() : "";
  if (!configId) {
    return new Response(JSON.stringify({ error: "configId é obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, supabaseService);

  const { data: config, error: cfgErr } = await admin
    .from("evolution_config")
    .select("id, api_url, api_key, instance_name, organization_id")
    .eq("id", configId)
    .maybeSingle();

  if (cfgErr || !config) {
    return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allowed = await userCanAccessOrganization(admin, user.id, config.organization_id);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Sem permissão para esta instância" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = (config.api_key || "").trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        evolutionOk: false,
        evolutionHttpStatus: null,
        body: null,
        proxyError: "missing_api_key",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const baseUrl = normalizeApiUrl(config.api_url);
  const evoUrl =
    `${baseUrl}/instance/connectionState/${encodeURIComponent(config.instance_name)}`;

  try {
    const evoRes = await fetch(evoUrl, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(12000),
    });

    const text = await evoRes.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { _raw: text.slice(0, 500) };
      }
    }

    return new Response(
      JSON.stringify({
        evolutionOk: evoRes.ok,
        evolutionHttpStatus: evoRes.status,
        body: parsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    const message = e instanceof Error ? e.message : String(e);
    const proxyError = name === "AbortError" ? "timeout" : "fetch_failed";
    return new Response(
      JSON.stringify({
        evolutionOk: false,
        evolutionHttpStatus: null,
        body: null,
        proxyError,
        proxyMessage: message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
