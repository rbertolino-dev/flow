import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const DEFAULT_SCOPES = [
  "leads:read",
  "leads:write",
  "stages:read",
  "tags:read",
  "tags:write",
  "activities:read",
  "activities:write",
  "products:read",
  "products:write",
  "budgets:read",
  "budgets:write",
  "service_orders:read",
  "service_orders:write",
  "members:read",
  "comms:read",
];

const ALLOWED_SCOPES = new Set([
  ...DEFAULT_SCOPES,
  "finance:read",
  "finance:write",
  "pos:read",
  "asaas:write",
  "bookings:read",
  "bookings:write",
  "calendar:read",
  "calendar:write",
  "webhooks:write",
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
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

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `agz_live_${hex}`;
}

async function assertOrgAdmin(
  admin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return true;

  const { data: member } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return member?.role === "owner" || member?.role === "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return errorResponse(401, "Não autorizado");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return errorResponse(401, "Usuário não autenticado");
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const url = new URL(req.url);

    let organizationId =
      req.headers.get("x-organization-id") ||
      url.searchParams.get("organization_id") ||
      "";

    if (req.method === "GET") {
      if (!organizationId) {
        return errorResponse(400, "organization_id é obrigatório");
      }
      if (!(await assertOrgAdmin(admin, user.id, organizationId))) {
        return errorResponse(403, "Sem permissão para gerenciar API keys");
      }

      const { data, error } = await admin
        .from("organization_api_keys")
        .select(
          "id, organization_id, name, key_prefix, scopes, last_used_at, revoked_at, expires_at, created_at, created_by",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("list_api_keys_error", error);
        return errorResponse(500, "Falha ao listar API keys");
      }

      return json({
        data: (data || []).map((k) => ({
          ...k,
          status: k.revoked_at ? "revoked" : "active",
        })),
      });
    }

    if (req.method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      organizationId = organizationId || String(body.organization_id || "").trim();
      if (!organizationId) {
        return errorResponse(400, "organization_id é obrigatório");
      }
      if (!(await assertOrgAdmin(admin, user.id, organizationId))) {
        return errorResponse(403, "Sem permissão para gerenciar API keys");
      }

      const name = String(body.name || "").trim();
      if (!name) {
        return errorResponse(400, "name é obrigatório");
      }

      let scopes = DEFAULT_SCOPES;
      if (Array.isArray(body.scopes) && body.scopes.length > 0) {
        scopes = body.scopes.map(String).filter((s) => ALLOWED_SCOPES.has(s));
        if (scopes.length === 0) {
          return errorResponse(400, "scopes inválidos");
        }
      }

      const secret = randomSecret();
      const keyHash = await sha256Hex(secret);
      const keyPrefix = secret.slice(0, 16);

      const { data, error } = await admin
        .from("organization_api_keys")
        .insert({
          organization_id: organizationId,
          name,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          scopes,
          created_by: user.id,
          expires_at: body.expires_at ? String(body.expires_at) : null,
        })
        .select(
          "id, organization_id, name, key_prefix, scopes, last_used_at, revoked_at, expires_at, created_at",
        )
        .single();

      if (error) {
        console.error("create_api_key_error", error);
        return errorResponse(500, "Falha ao criar API key");
      }

      return json(
        {
          data: {
            ...data,
            status: "active",
            secret,
          },
          warning: "Guarde esta chave agora. Ela não será exibida novamente.",
        },
        201,
      );
    }

    if (req.method === "DELETE") {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      organizationId = organizationId || String(body.organization_id || "").trim();
      const keyId = url.searchParams.get("id") || String(body.id || "").trim();

      if (!organizationId || !keyId) {
        return errorResponse(400, "organization_id e id são obrigatórios");
      }
      if (!(await assertOrgAdmin(admin, user.id, organizationId))) {
        return errorResponse(403, "Sem permissão para gerenciar API keys");
      }

      const { data, error } = await admin
        .from("organization_api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", keyId)
        .eq("organization_id", organizationId)
        .is("revoked_at", null)
        .select("id, key_prefix, revoked_at")
        .maybeSingle();

      if (error) {
        console.error("revoke_api_key_error", error);
        return errorResponse(500, "Falha ao revogar API key");
      }
      if (!data) {
        return errorResponse(404, "API key não encontrada ou já revogada");
      }

      return json({ data: { ...data, status: "revoked" } });
    }

    return errorResponse(405, "Método não permitido");
  } catch (e) {
    console.error("manage_organization_api_key_error", e);
    return errorResponse(500, "Erro interno");
  }
});
