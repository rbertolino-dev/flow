import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthContext,
  errorResponse,
  json,
  requireScope,
} from "../shared.ts";

const ALLOWED_EVENTS = [
  "lead.created",
  "lead.updated",
  "budget.updated",
  "service_order.updated",
  "financial_entry.settled",
];

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function handleWebhooks(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const match = path.match(/^\/webhooks(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "webhooks:write");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("organization_api_webhooks")
      .select(
        "id, organization_id, url, events, active, created_at, updated_at, last_delivery_at, last_status",
      )
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("list_webhooks_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar webhooks");
    }
    return json({
      data: (data || []).map((w) => ({
        ...w,
        // never return signing secret on list
      })),
    });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "webhooks:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const url = String(body.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return errorResponse(400, "validation_error", "url HTTPS válida é obrigatória");
    }
    let events = Array.isArray(body.events)
      ? body.events.map(String).filter((e) => ALLOWED_EVENTS.includes(e))
      : [...ALLOWED_EVENTS];
    if (events.length === 0) {
      return errorResponse(400, "validation_error", "events inválidos");
    }
    const secret = randomSecret();
    const { data, error } = await supabase
      .from("organization_api_webhooks")
      .insert({
        organization_id: auth.organizationId,
        url,
        events,
        secret,
        active: body.active !== false,
        api_key_id: auth.key.id,
      })
      .select(
        "id, organization_id, url, events, active, created_at, updated_at",
      )
      .single();
    if (error) {
      console.error("create_webhook_error", error);
      return errorResponse(
        500,
        "internal_error",
        error.message || "Falha ao criar webhook",
      );
    }
    return json(
      {
        data: {
          ...data,
          secret,
        },
        warning:
          "Guarde o secret agora. Ele assina o header X-Agilize-Signature e não será exibido novamente.",
        allowed_events: ALLOWED_EVENTS,
      },
      201,
    );
  }

  if (req.method === "DELETE" && id) {
    const scopeErr = requireScope(auth, "webhooks:write");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("organization_api_webhooks")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select("id, active")
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao desativar webhook");
    }
    if (!data) return errorResponse(404, "not_found", "Webhook não encontrado");
    return json({ data: { ...data, deactivated: true } });
  }

  if (req.method === "PATCH" && id) {
    const scopeErr = requireScope(auth, "webhooks:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const allowed: Record<string, unknown> = {};
    if (body.url !== undefined) {
      const u = String(body.url).trim();
      if (!/^https?:\/\//i.test(u)) {
        return errorResponse(400, "validation_error", "url inválida");
      }
      allowed.url = u;
    }
    if (body.active !== undefined) allowed.active = !!body.active;
    if (body.events !== undefined) {
      const events = Array.isArray(body.events)
        ? body.events.map(String).filter((e) => ALLOWED_EVENTS.includes(e))
        : [];
      if (events.length === 0) {
        return errorResponse(400, "validation_error", "events inválidos");
      }
      allowed.events = events;
    }
    if (Object.keys(allowed).length === 0) {
      return errorResponse(400, "validation_error", "Nenhum campo para atualizar");
    }
    allowed.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("organization_api_webhooks")
      .update(allowed)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select(
        "id, organization_id, url, events, active, created_at, updated_at",
      )
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao atualizar webhook");
    }
    if (!data) return errorResponse(404, "not_found", "Webhook não encontrado");
    return json({ data });
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}
