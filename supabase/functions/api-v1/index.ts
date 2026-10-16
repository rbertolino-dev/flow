import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const RATE_LIMIT_PER_MINUTE = 60;

const LEAD_PUBLIC_FIELDS =
  "id, organization_id, name, phone, email, company, value, stage_id, status, source, notes, assigned_to, created_at, updated_at";

type ApiKeyRow = {
  id: string;
  organization_id: string;
  scopes: string[] | null;
  revoked_at: string | null;
  expires_at: string | null;
};

type AuthContext = {
  key: ApiKeyRow;
  organizationId: string;
  scopes: Set<string>;
};

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return req.headers.get("x-api-key")?.trim() || null;
}

function clientIp(req: Request): string | null {
  const forwarded =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "";
  return forwarded.split(",")[0]?.trim() || null;
}

function normalizePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "api-v1");
  const rest = idx >= 0 ? parts.slice(idx + 1) : parts;
  return "/" + rest.join("/");
}

function requireScope(auth: AuthContext, scope: string): Response | null {
  if (!auth.scopes.has(scope)) {
    return errorResponse(403, "forbidden_scope", `Escopo necessário: ${scope}`);
  }
  return null;
}

async function authenticate(
  supabase: SupabaseClient,
  req: Request,
): Promise<{ auth: AuthContext } | { response: Response }> {
  const rawKey = extractApiKey(req);
  if (!rawKey || !rawKey.startsWith("agz_")) {
    return {
      response: errorResponse(
        401,
        "unauthorized",
        "Informe Authorization: Bearer agz_... ou header x-api-key",
      ),
    };
  }

  const keyHash = await sha256Hex(rawKey);
  const { data, error } = await supabase
    .from("organization_api_keys")
    .select("id, organization_id, scopes, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) {
    return { response: errorResponse(401, "unauthorized", "API key inválida") };
  }

  const key = data as ApiKeyRow;
  if (key.revoked_at) {
    return { response: errorResponse(401, "unauthorized", "API key revogada") };
  }
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return { response: errorResponse(401, "unauthorized", "API key expirada") };
  }

  return {
    auth: {
      key,
      organizationId: key.organization_id,
      scopes: new Set(key.scopes || []),
    },
  };
}

async function checkRateLimit(
  supabase: SupabaseClient,
  apiKeyId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("organization_api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", since);

  if (error) {
    console.error("rate_limit_check_error", error);
    return true;
  }
  return (count ?? 0) < RATE_LIMIT_PER_MINUTE;
}

async function logRequest(
  supabase: SupabaseClient,
  auth: AuthContext,
  method: string,
  path: string,
  status: number,
  ip: string | null,
): Promise<void> {
  try {
    await Promise.all([
      supabase
        .from("organization_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", auth.key.id),
      supabase.from("organization_api_request_logs").insert({
        organization_id: auth.organizationId,
        api_key_id: auth.key.id,
        method,
        path,
        status,
        ip,
      }),
    ]);
  } catch (e) {
    console.error("api_request_log_error", e);
  }
}

function mapLead(row: Record<string, unknown>) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? null,
    company: row.company ?? null,
    value: row.value ?? null,
    stage_id: row.stage_id ?? null,
    status: row.status ?? null,
    source: row.source ?? null,
    notes: row.notes ?? null,
    assigned_to: row.assigned_to ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function handleLeads(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);
  const leadMatch = path.match(/^\/leads(?:\/([0-9a-f-]{36}))?$/i);
  if (!leadMatch) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const leadId = leadMatch[1] || null;

  if (req.method === "GET" && !leadId) {
    const scopeErr = requireScope(auth, "leads:read");
    if (scopeErr) return scopeErr;

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") || "35", 10) || 35),
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const stageId = url.searchParams.get("stage_id");

    let query = supabase
      .from("leads")
      .select(LEAD_PUBLIC_FIELDS, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (stageId) query = query.eq("stage_id", stageId);

    const { data, error, count } = await query;
    if (error) {
      console.error("list_leads_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar leads");
    }

    return json({
      data: (data || []).map((r) => mapLead(r as Record<string, unknown>)),
      meta: {
        page,
        limit,
        total: count ?? 0,
        has_more: (count ?? 0) > to + 1,
      },
    });
  }

  if (req.method === "GET" && leadId) {
    const scopeErr = requireScope(auth, "leads:read");
    if (scopeErr) return scopeErr;

    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_PUBLIC_FIELDS)
      .eq("organization_id", auth.organizationId)
      .eq("id", leadId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("get_lead_error", error);
      return errorResponse(500, "internal_error", "Falha ao buscar lead");
    }
    if (!data) return errorResponse(404, "not_found", "Lead não encontrado");
    return json({ data: mapLead(data as Record<string, unknown>) });
  }

  if (req.method === "POST" && !leadId) {
    const scopeErr = requireScope(auth, "leads:write");
    if (scopeErr) return scopeErr;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!name || !phone) {
      return errorResponse(400, "validation_error", "Campos obrigatórios: name, phone");
    }

    const { data: newId, error } = await supabase.rpc("create_lead_via_api", {
      p_org_id: auth.organizationId,
      p_name: name,
      p_phone: phone,
      p_email: body.email != null ? String(body.email) : null,
      p_company: body.company != null ? String(body.company) : null,
      p_value: body.value != null && body.value !== "" ? Number(body.value) : null,
      p_stage_id: body.stage_id != null ? String(body.stage_id) : null,
      p_notes: body.notes != null ? String(body.notes) : null,
      p_source: body.source != null ? String(body.source) : "api",
    });

    if (error) {
      const msg = error.message || "Falha ao criar lead";
      if (/já existe/i.test(msg)) {
        return errorResponse(409, "duplicate_phone", msg);
      }
      if (/obrigatór|inválid|Etapa|Limite/i.test(msg)) {
        return errorResponse(400, "validation_error", msg);
      }
      console.error("create_lead_error", error);
      return errorResponse(500, "internal_error", msg);
    }

    const { data: created } = await supabase
      .from("leads")
      .select(LEAD_PUBLIC_FIELDS)
      .eq("id", newId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    return json(
      { data: created ? mapLead(created as Record<string, unknown>) : { id: newId } },
      201,
    );
  }

  if (req.method === "PATCH" && leadId) {
    const scopeErr = requireScope(auth, "leads:write");
    if (scopeErr) return scopeErr;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }

    const allowed: Record<string, unknown> = {};
    if (body.name !== undefined) allowed.name = String(body.name).trim();
    if (body.phone !== undefined) {
      allowed.phone = String(body.phone).replace(/\D/g, "");
    }
    if (body.email !== undefined) {
      allowed.email = body.email === null ? null : String(body.email);
    }
    if (body.company !== undefined) {
      allowed.company = body.company === null ? null : String(body.company);
    }
    if (body.value !== undefined) {
      allowed.value =
        body.value === null || body.value === "" ? null : Number(body.value);
    }
    if (body.stage_id !== undefined) {
      if (body.stage_id !== null) {
        const { data: stageOk } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("id", String(body.stage_id))
          .eq("organization_id", auth.organizationId)
          .maybeSingle();
        if (!stageOk) {
          return errorResponse(400, "validation_error", "Etapa inválida para a organização");
        }
      }
      allowed.stage_id = body.stage_id === null ? null : String(body.stage_id);
    }
    if (body.notes !== undefined) {
      allowed.notes = body.notes === null ? null : String(body.notes);
    }
    if (body.status !== undefined) {
      allowed.status = body.status === null ? null : String(body.status);
    }
    if (body.source !== undefined) {
      allowed.source = body.source === null ? null : String(body.source);
    }

    if (Object.keys(allowed).length === 0) {
      return errorResponse(400, "validation_error", "Nenhum campo para atualizar");
    }

    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("leads")
      .update(allowed)
      .eq("id", leadId)
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .select(LEAD_PUBLIC_FIELDS)
      .maybeSingle();

    if (error) {
      console.error("patch_lead_error", error);
      return errorResponse(500, "internal_error", "Falha ao atualizar lead");
    }
    if (!data) return errorResponse(404, "not_found", "Lead não encontrado");
    return json({ data: mapLead(data as Record<string, unknown>) });
  }

  if (req.method === "DELETE" && leadId) {
    const scopeErr = requireScope(auth, "leads:write");
    if (scopeErr) return scopeErr;

    const { data, error } = await supabase
      .from("leads")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("delete_lead_error", error);
      return errorResponse(500, "internal_error", "Falha ao excluir lead");
    }
    if (!data) return errorResponse(404, "not_found", "Lead não encontrado");
    return json({ data: { id: data.id, deleted: true } });
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}

async function handleStages(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }
  const scopeErr = requireScope(auth, "stages:read");
  if (scopeErr) return scopeErr;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, color, position, organization_id, created_at")
    .eq("organization_id", auth.organizationId)
    .order("position", { ascending: true });

  if (error) {
    console.error("list_stages_error", error);
    return errorResponse(500, "internal_error", "Falha ao listar etapas");
  }
  return json({ data: data || [] });
}

async function handleTags(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }
  const scopeErr = requireScope(auth, "tags:read");
  if (scopeErr) return scopeErr;

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color, organization_id, created_at")
    .eq("organization_id", auth.organizationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("list_tags_error", error);
    return errorResponse(500, "internal_error", "Falha ao listar etiquetas");
  }
  return json({ data: data || [] });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);
  const ip = clientIp(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return errorResponse(500, "misconfigured", "Serviço mal configurado");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const authResult = await authenticate(supabase, req);
  if ("response" in authResult) return authResult.response;
  const { auth } = authResult;

  const allowed = await checkRateLimit(supabase, auth.key.id);
  if (!allowed) {
    await logRequest(supabase, auth, req.method, path, 429, ip);
    return errorResponse(
      429,
      "rate_limited",
      `Limite de ${RATE_LIMIT_PER_MINUTE} requisições por minuto excedido`,
    );
  }

  let response: Response;
  try {
    if (path === "/" || path === "") {
      response = json({
        data: {
          name: "Agilize CRM Public API",
          version: "v1",
          organization_id: auth.organizationId,
        },
      });
    } else if (path.startsWith("/leads")) {
      response = await handleLeads(supabase, auth, req, path);
    } else if (path === "/stages") {
      response = await handleStages(supabase, auth, req);
    } else if (path === "/tags") {
      response = await handleTags(supabase, auth, req);
    } else {
      response = errorResponse(404, "not_found", "Endpoint não encontrado");
    }
  } catch (e) {
    console.error("api_v1_unhandled", e);
    response = errorResponse(500, "internal_error", "Erro interno");
  }

  await logRequest(supabase, auth, req.method, path, response.status, ip);
  return response;
});
