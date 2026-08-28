import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  fetchConnectionStateSingle,
} from "../_shared/evolution-fetch-instances.ts";
import { normalizeApiUrl } from "../_shared/evolution-connection-parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Limite de instâncias verificadas em paralelo (evita 28× sequencial antes do timeout). */
const READY_PROBE_CONCURRENCY = 8;
/** Máx. chips com connectionState OPEN a sondar (prioridade: is_connected no CRM). */
const MAX_READY_PROBES = 28;
/** Máx. chips tentados em whatsappNumbers (evita 504 do gateway). */
const MAX_VALIDATE_ATTEMPTS = 18;
/** Tempo máximo total da função (ms) — gateway Supabase ~60s. */
const FUNCTION_DEADLINE_MS = 52000;
/** Timeout por chamada à Evolution na validação (ms). */
const VALIDATION_FETCH_TIMEOUT_MS = 10000;
const CONNECTION_STATE_TIMEOUT_MS = 5000;
/** Número inócuo para smoke-test de whatsappNumbers (OPEN fantasma vs sessão real). */
const SMOKE_PROBE_NUMBER = "5511999999999";

type EvolutionConfigRow = {
  id: string;
  instance_name: string | null;
  api_url: string | null;
  api_key: string | null;
  is_connected: boolean | null;
  evolution_provider_id?: string | null;
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

function urlsMatchEvolution(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeApiUrl(a) === normalizeApiUrl(b);
}

async function getOrganizationAllowedProviderIds(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<string[]> {
  const { data: orgProviders } = await admin
    .from("organization_evolution_providers")
    .select("evolution_provider_id")
    .eq("organization_id", organizationId);

  let providerIds = (orgProviders || []).map(
    (r: { evolution_provider_id: string }) => r.evolution_provider_id,
  );

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

  if (providerIds.length === 0) return [];

  const { data: providers } = await admin
    .from("evolution_providers")
    .select("id, api_url")
    .in("id", providerIds)
    .eq("is_active", true);

  return (providers || []).map((p: { id: string }) => p.id);
}

function configBelongsToAllowedProviders(
  cfg: EvolutionConfigRow & { evolution_provider_id?: string | null },
  allowedProviderIds: string[],
  allowedProviderUrls: string[],
): boolean {
  if (!allowedProviderIds.length) return false;
  if (cfg.evolution_provider_id && allowedProviderIds.includes(cfg.evolution_provider_id)) {
    return true;
  }
  const apiUrl = String(cfg.api_url ?? "").trim();
  if (!apiUrl) return false;
  return allowedProviderUrls.some((url) => urlsMatchEvolution(apiUrl, url));
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

function isEvolutionTechnicalError(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    status >= 500 ||
    lower.includes("p1001") ||
    lower.includes("can't reach database") ||
    lower.includes("prismaclient") ||
    lower.includes("internal server error")
  );
}

async function validateOnInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  numbers: string[],
  useLatam: boolean,
): Promise<{
  ok: boolean;
  results: Array<{ number: string; exists: boolean }>;
  connectionClosed: boolean;
  fetchFailed?: boolean;
  technicalError?: boolean;
}> {
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

    let resp: Response;
    let preview: string;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({ numbers: formatted }),
        signal: AbortSignal.timeout(VALIDATION_FETCH_TIMEOUT_MS),
      });
      preview = await resp.text();
    } catch {
      return { ok: false, results: [], connectionClosed: false, fetchFailed: true };
    }

    if (!resp.ok) {
      if (preview.includes("Method not available") || preview.includes("method not available")) {
        return { ok: false, results: [], connectionClosed: false, technicalError: true };
      }
      if (isConnectionClosedError(resp.status, preview)) {
        return { ok: false, results: [], connectionClosed: true };
      }
      if (isEvolutionTechnicalError(resp.status, preview)) {
        return { ok: false, results: [], connectionClosed: false, technicalError: true };
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

  return {
    ok: aggregated.length > 0,
    results: aggregated,
    connectionClosed: false,
  };
}

/** Preferir chips marcados conectados no CRM — evita gastar tentativas em offline. */
function prioritizeConnected(configs: EvolutionConfigRow[]): EvolutionConfigRow[] {
  const on = configs.filter((c) => c.is_connected === true);
  const unknown = configs.filter((c) => c.is_connected !== true && c.is_connected !== false);
  const off = configs.filter((c) => c.is_connected === false);
  return [...on, ...unknown, ...off];
}

async function probeReadyInstances(
  configs: EvolutionConfigRow[],
  limit = MAX_READY_PROBES,
): Promise<EvolutionConfigRow[]> {
  const ready: EvolutionConfigRow[] = [];
  const candidates = prioritizeConnected(configs).slice(0, Math.max(limit * 2, READY_PROBE_CONCURRENCY));

  const probeOne = async (cfg: EvolutionConfigRow) => {
    const name = String(cfg.instance_name ?? "").trim();
    const apiUrl = String(cfg.api_url ?? "").trim();
    const apiKey = String(cfg.api_key ?? "").trim();
    if (!name || !apiUrl || !apiKey) return;
    const cs = await fetchConnectionStateSingle(
      apiUrl,
      apiKey,
      name,
      CONNECTION_STATE_TIMEOUT_MS,
      "batchSync",
    );
    if (cs.live !== true) return;
    // OPEN fantasma: connectionState=open mas whatsappNumbers fecha a sessão.
    // Smoke-test com 1 número antes de marcar como ready.
    const smoke = await validateOnInstance(apiUrl, apiKey, name, [SMOKE_PROBE_NUMBER], false);
    if (smoke.ok && !smoke.connectionClosed && !smoke.fetchFailed && !smoke.technicalError) {
      ready.push(cfg);
    }
  };

  for (let i = 0; i < candidates.length; i += READY_PROBE_CONCURRENCY) {
    if (ready.length >= limit) break;
    const slice = candidates.slice(i, i + READY_PROBE_CONCURRENCY);
    await Promise.all(slice.map((cfg) => probeOne(cfg)));
  }

  return ready.slice(0, limit);
}

function buildTryOrder(
  configs: EvolutionConfigRow[],
  readyInstances: EvolutionConfigRow[],
  preferredCfg: EvolutionConfigRow | null,
): EvolutionConfigRow[] {
  const readyIds = new Set(readyInstances.map((c) => c.id));
  const readyRest = readyInstances.filter((c) => c.id !== preferredCfg?.id);
  const notReady = prioritizeConnected(
    configs.filter((c) => c.id !== preferredCfg?.id && !readyIds.has(c.id)),
  );

  // Só tenta offline depois de esgotar chips OPEN — evita o erro
  // "OPEN no painel (Joana), mas não validou" quando os retries caem em close.
  if (preferredCfg) {
    const prefReady = readyIds.has(preferredCfg.id);
    if (prefReady) {
      return [preferredCfg, ...readyRest, ...notReady];
    }
    return [...readyRest, preferredCfg, ...notReady];
  }

  return [...readyInstances, ...notReady];
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const startedAt = Date.now();
  const pastDeadline = () => Date.now() - startedAt >= FUNCTION_DEADLINE_MS;

  try {
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
    preferredInstanceId?: string;
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
  const preferredInstanceId = String(body.preferredInstanceId ?? "").trim();

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
    .select("id, instance_name, api_url, api_key, is_connected, evolution_provider_id")
    .eq("organization_id", organizationId)
    .in("id", instanceIds);

  if (cfgErr || !configs?.length) {
    return new Response(JSON.stringify({ error: "Instâncias não encontradas" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allowedProviderIds = await getOrganizationAllowedProviderIds(admin, organizationId);
  let allowedProviderUrls: string[] = [];
  if (allowedProviderIds.length > 0) {
    const { data: providerRows } = await admin
      .from("evolution_providers")
      .select("id, api_url")
      .in("id", allowedProviderIds)
      .eq("is_active", true);
    allowedProviderUrls = (providerRows || []).map((p: { api_url: string }) => p.api_url);
  }

  const allowedConfigs = (configs as EvolutionConfigRow[]).filter((cfg) =>
    configBelongsToAllowedProviders(cfg, allowedProviderIds, allowedProviderUrls),
  );

  if (allowedConfigs.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Nenhuma instância pertence aos servidores Evolution habilitados para esta organização.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const configList = prioritizeConnected(allowedConfigs);

  const preferredCfg =
    preferredInstanceId && configList.find((c) => c.id === preferredInstanceId)
      ? configList.find((c) => c.id === preferredInstanceId)!
      : null;

  // Sempre sondar vários chips OPEN (não só o preferred). Antes, se o preferred
  // parecia OPEN e whatsappNumbers falhava, os retries caiam em chips close.
  let readyInstances: EvolutionConfigRow[] = [];
  const othersForProbe = preferredCfg
    ? configList.filter((c) => c.id !== preferredCfg.id)
    : configList;

  if (preferredCfg) {
    const name = String(preferredCfg.instance_name ?? "").trim();
    const apiUrl = String(preferredCfg.api_url ?? "").trim();
    const apiKey = String(preferredCfg.api_key ?? "").trim();
    if (name && apiUrl && apiKey) {
      const cs = await fetchConnectionStateSingle(
        apiUrl,
        apiKey,
        name,
        CONNECTION_STATE_TIMEOUT_MS,
        "batchSync",
      );
      if (cs.live === true) {
        const smoke = await validateOnInstance(apiUrl, apiKey, name, [SMOKE_PROBE_NUMBER], false);
        if (smoke.ok && !smoke.connectionClosed && !smoke.fetchFailed && !smoke.technicalError) {
          readyInstances.push(preferredCfg);
        }
      }
    }
  }

  if (othersForProbe.length > 0 && !pastDeadline()) {
    const moreReady = await probeReadyInstances(
      othersForProbe,
      MAX_READY_PROBES - readyInstances.length,
    );
    const seen = new Set(readyInstances.map((c) => c.id));
    for (const cfg of moreReady) {
      if (!seen.has(cfg.id)) {
        readyInstances.push(cfg);
        seen.add(cfg.id);
      }
    }
  }

  const tryOrder = buildTryOrder(configList, readyInstances, preferredCfg);
  const readyIdSet = new Set(readyInstances.map((c) => c.id));
  const maxAttempts = Math.min(
    MAX_VALIDATE_ATTEMPTS,
    Math.max(4, readyInstances.length > 0 ? readyInstances.length + 2 : 4),
  );

  let usedInstance: string | null = null;
  let usedInstanceId: string | null = null;
  let apiResults: Array<{ number: string; exists: boolean }> = [];
  let allConnectionClosed = tryOrder.length > 0;
  let validateAttempts = 0;
  let hadFetchFailure = false;
  let hadTechnicalError = false;
  let readyAttempts = 0;

  for (const cfg of tryOrder) {
    if (validateAttempts >= maxAttempts || pastDeadline()) break;

    const name = String(cfg.instance_name ?? "").trim();
    if (!name || !cfg.api_url || !cfg.api_key) continue;

    const isReady = readyIdSet.has(cfg.id);
    // Com chips OPEN disponíveis, não gastar tentativas em offline.
    if (!isReady && readyInstances.length > 0 && readyAttempts < readyInstances.length) {
      continue;
    }

    validateAttempts += 1;
    if (isReady) readyAttempts += 1;

    const attempt = await validateOnInstance(
      cfg.api_url,
      cfg.api_key,
      name,
      numbers,
      useLatam,
    );

    if (attempt.fetchFailed) {
      hadFetchFailure = true;
      continue;
    }
    if (attempt.technicalError) {
      hadTechnicalError = true;
      continue;
    }
    if (attempt.connectionClosed) continue;

    allConnectionClosed = false;

    if (attempt.ok) {
      usedInstance = name;
      usedInstanceId = cfg.id;
      apiResults = attempt.results;
      break;
    }
  }

  if (!usedInstance && readyInstances.length > 0) {
    const names = readyInstances.map((c) => c.instance_name).filter(Boolean).slice(0, 5).join(", ");
    if (hadTechnicalError) {
      const host = (() => {
        try {
          const u = String(readyInstances[0]?.api_url ?? "");
          return new URL(u.startsWith("http") ? u : `https://${u}`).hostname;
        } catch {
          return "Evolution";
        }
      })();
      return jsonResponse({
        ok: false,
        error:
          `Evolution API (${host}): banco de dados indisponível no servidor. Os chips (${names}${readyInstances.length > 5 ? "…" : ""}) aparecem conectados, mas validação WhatsApp e envio estão bloqueados até o Postgres da Evolution voltar. Contacte o administrador do servidor Evolution.`,
        validatedNumbers: [] as string[],
        rejectedNumbers: numbers,
      });
    }
    return jsonResponse({
      ok: false,
      error:
        `As instâncias estão OPEN no painel (${names}${readyInstances.length > 5 ? "…" : ""}), mas a Evolution não validou os números (sessão fechada ou whatsappNumbers indisponível). Reconecte um chip e tente de novo.`,
      validatedNumbers: [] as string[],
      rejectedNumbers: numbers,
    });
  }

  if (!usedInstance) {
    let msg = allConnectionClosed
      ? "Nenhuma instância conseguiu validar (sessão WhatsApp fechada na Evolution)."
      : "Falha ao validar números na Evolution API.";
    if (hadFetchFailure) {
      msg =
        "Não foi possível contactar a Evolution API (timeout ou URL inacessível). Verifique api_url do chip e se o servidor Evolution está online.";
    } else if (hadTechnicalError) {
      msg =
        "Evolution API respondeu com erro interno (base de dados/serviço). Reconecte o chip ou contacte o suporte da Evolution.";
    } else if (pastDeadline()) {
      msg = "Validação expirou (muitas instâncias lentas). Reduza os chips selecionados e tente novamente.";
    }
    return jsonResponse({ error: msg, ok: false, validatedNumbers: [], rejectedNumbers: numbers });
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
      if (!exDigits || !digits) return false;
      if (exDigits === digits) return true;
      if (digits.length >= 10 && exDigits.length >= 10) {
        return exDigits.slice(-10) === digits.slice(-10) || exDigits.slice(-11) === digits.slice(-11);
      }
      return false;
    });
    if (found) validatedNumbers.push(n);
    else rejectedNumbers.push(n);
  }

  return jsonResponse({
    ok: true,
    skippedApiValidation: false,
    usedInstance,
    usedInstanceId,
    validatedNumbers,
    rejectedNumbers,
  });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[validate-broadcast-whatsapp] erro não tratado:", message);
    return jsonResponse(
      {
        ok: false,
        error: "Erro interno na validação WhatsApp. Tente novamente com menos instâncias selecionadas.",
        detail: message.slice(0, 200),
      },
      200,
    );
  }
});
