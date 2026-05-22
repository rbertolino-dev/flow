import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isInstanceReadyToSend } from "../_shared/evolution-fetch-instances.ts";
import { normalizeApiUrl } from "../_shared/evolution-connection-parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isConnectionClosedError(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    status === 428 ||
    (status === 400 &&
      (lower.includes("connection closed") || lower.includes("precondition required")))
  );
}

function normalizePhoneBr(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

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

async function validateOnInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  numbers: string[],
  useLatam: boolean,
): Promise<{ ok: boolean; results: Array<{ number: string; exists: boolean }>; connectionClosed: boolean }> {
  const base = normalizeApiUrl(apiUrl);
  const endpoint = `${base}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`;
  const chunkSize = 50;
  const aggregated: Array<{ number: string; exists: boolean }> = [];

  for (let i = 0; i < numbers.length; i += chunkSize) {
    const chunk = numbers.slice(i, i + chunkSize);
    const formatted = chunk.map((n) => {
      if (useLatam && n.startsWith("+")) return n.replace(/\s/g, "");
      return normalizePhoneBr(n);
    });

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ numbers: formatted }),
      signal: AbortSignal.timeout(30000),
    });

    const preview = await resp.text();
    if (!resp.ok) {
      if (preview.includes("Method not available") || preview.includes("method not available")) {
        return {
          ok: true,
          results: formatted.map((number) => ({ number, exists: true })),
          connectionClosed: false,
        };
      }
      if (isConnectionClosedError(resp.status, preview)) {
        return { ok: false, results: [], connectionClosed: true };
      }
      return { ok: false, results: [], connectionClosed: false };
    }

    let data: unknown = null;
    try {
      data = preview ? JSON.parse(preview) : null;
    } catch {
      data = null;
    }
    const rows = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] })?.data ?? (data as { results?: unknown[] })?.results ?? [];
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const r = row as { number?: string; exists?: boolean };
        if (r?.number != null) {
          aggregated.push({ number: String(r.number), exists: r.exists === true });
        }
      }
    }
  }

  return { ok: aggregated.length > 0, results: aggregated, connectionClosed: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  });

  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: { user }, error: userErr } = await userClient.auth.getUser(accessToken);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    organizationId?: string;
    instanceIds?: string[];
    numbers?: string[];
    useLatamValidator?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const organizationId = String(body.organizationId ?? "").trim();
  const instanceIds = Array.isArray(body.instanceIds)
    ? body.instanceIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const numbers = Array.isArray(body.numbers)
    ? body.numbers.map((n) => String(n).trim()).filter(Boolean)
    : [];
  const useLatam = body.useLatamValidator === true;

  if (!organizationId || instanceIds.length === 0 || numbers.length === 0) {
    return new Response(
      JSON.stringify({ error: "organizationId, instanceIds e numbers são obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(supabaseUrl, supabaseService);
  if (!(await userCanAccessOrganization(admin, user.id, organizationId))) {
    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: configs, error: cfgErr } = await admin
    .from("evolution_config")
    .select("id, instance_name, api_url, api_key, is_connected")
    .eq("organization_id", organizationId)
    .in("id", instanceIds);

  if (cfgErr || !configs?.length) {
    return new Response(JSON.stringify({ error: "Instâncias não encontradas" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const readyInstances: typeof configs = [];
  for (const cfg of configs) {
    const name = String(cfg.instance_name ?? "").trim();
    const apiUrl = String(cfg.api_url ?? "").trim();
    const apiKey = String(cfg.api_key ?? "").trim();
    if (!name || !apiUrl || !apiKey) continue;
    const ready = await isInstanceReadyToSend(apiUrl, apiKey, name);
    if (ready.ready) readyInstances.push(cfg);
  }

  const tryOrder = [
    ...readyInstances,
    ...configs.filter((c) => !readyInstances.some((o) => o.id === c.id)),
  ];

  let usedInstance: string | null = null;
  let apiResults: Array<{ number: string; exists: boolean }> = [];
  let allConnectionClosed = tryOrder.length > 0;

  for (const cfg of tryOrder) {
    const name = String(cfg.instance_name ?? "").trim();
    if (!name || !cfg.api_url || !cfg.api_key) continue;

    const attempt = await validateOnInstance(
      cfg.api_url,
      cfg.api_key,
      name,
      numbers,
      useLatam,
    );

    if (attempt.connectionClosed) continue;

    allConnectionClosed = false;

    if (attempt.ok) {
      usedInstance = name;
      apiResults = attempt.results;
      break;
    }
  }

  if (!usedInstance && readyInstances.length > 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        skippedApiValidation: true,
        usedInstance: readyInstances[0]?.instance_name ?? null,
        warning:
          "whatsappNumbers indisponível (Connection Closed), mas instâncias estão OPEN no painel Evolution. Contatos aceitos para a campanha.",
        validatedNumbers: numbers,
        rejectedNumbers: [] as string[],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!usedInstance) {
    const msg = allConnectionClosed
      ? "Nenhuma instância conseguiu validar (sessão WhatsApp fechada na Evolution)."
      : "Falha ao validar números na Evolution API.";
    return new Response(JSON.stringify({ error: msg, ok: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const existsSet = new Set(
    apiResults.filter((r) => r.exists).map((r) => r.number.replace(/\D/g, "")),
  );

  const validatedNumbers: string[] = [];
  const rejectedNumbers: string[] = [];

  for (const n of numbers) {
    const digits = (useLatam && n.startsWith("+") ? n.replace(/\s/g, "") : normalizePhoneBr(n)).replace(
      /\D/g,
      "",
    );
    const found = [...existsSet].some((ex) => {
      const exDigits = ex.replace(/\D/g, "");
      return (
        exDigits === digits ||
        exDigits.endsWith(digits.slice(-8)) ||
        digits.endsWith(exDigits.slice(-8))
      );
    });
    if (found) validatedNumbers.push(n);
    else rejectedNumbers.push(n);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      skippedApiValidation: false,
      usedInstance,
      validatedNumbers,
      rejectedNumbers,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
