import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export const RATE_LIMIT_CRM = 60;
export const RATE_LIMIT_SENSITIVE = 20;

export type ApiKeyRow = {
  id: string;
  organization_id: string;
  scopes: string[] | null;
  revoked_at: string | null;
  expires_at: string | null;
};

export type AuthContext = {
  key: ApiKeyRow;
  organizationId: string;
  scopes: Set<string>;
};

export function json(
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

export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return json({ error: { code, message } }, status);
}

export function requireScope(auth: AuthContext, scope: string): Response | null {
  if (!auth.scopes.has(scope)) {
    return errorResponse(403, "forbidden_scope", `Escopo necessário: ${scope}`);
  }
  return null;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return req.headers.get("x-api-key")?.trim() || null;
}

export function clientIp(req: Request): string | null {
  const forwarded =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "";
  return forwarded.split(",")[0]?.trim() || null;
}

export function normalizePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "api-v1");
  const rest = idx >= 0 ? parts.slice(idx + 1) : parts;
  return "/" + rest.join("/");
}

export function parsePagination(url: URL, defaultLimit = 35) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || String(defaultLimit), 10) || defaultLimit),
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}

export function paginatedMeta(
  page: number,
  limit: number,
  total: number,
  to: number,
) {
  return {
    page,
    limit,
    total,
    has_more: total > to + 1,
  };
}

export async function authenticate(
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

export function rateLimitForScopes(scopes: Set<string>): number {
  const sensitive = ["finance:read", "finance:write", "asaas:write", "pos:read"];
  if (sensitive.some((s) => scopes.has(s))) return RATE_LIMIT_SENSITIVE;
  return RATE_LIMIT_CRM;
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  apiKeyId: string,
  limit: number,
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
  return (count ?? 0) < limit;
}

export async function logRequest(
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

export async function assertLeadInOrg(
  supabase: SupabaseClient,
  orgId: string,
  leadId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  return !!data;
}

export async function orgOwnerUserId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  if (!data?.length) return null;
  const owner = data.find((m) => m.role === "owner");
  const admin = data.find((m) => m.role === "admin");
  return (owner || admin || data[0]).user_id as string;
}

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("misconfigured");
  return createClient(url, key);
}
