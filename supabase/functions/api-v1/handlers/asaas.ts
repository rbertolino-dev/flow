import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthContext,
  errorResponse,
  json,
  requireScope,
} from "../shared.ts";

/**
 * Proxy autenticado por API key para asaas-create-boleto / asaas-create-charge.
 * Nunca expõe asaas_configs.api_key ao cliente.
 */
export async function handleAsaas(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }
  const scopeErr = requireScope(auth, "asaas:write");
  if (scopeErr) return scopeErr;

  let target: "boleto" | "charge" | null = null;
  if (path === "/asaas/boletos" || path === "/asaas/boleto") target = "boleto";
  if (path === "/asaas/charges" || path === "/asaas/charge") target = "charge";
  if (!target) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "invalid_json", "JSON inválido");
  }

  // Force organization from API key
  const payload = {
    ...body,
    organization_id: auth.organizationId,
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return errorResponse(500, "misconfigured", "Serviço mal configurado");
  }

  const fn =
    target === "boleto" ? "asaas-create-boleto" : "asaas-create-charge";
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      "X-Organization-Id": auth.organizationId,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    return json(
      {
        error: {
          code: "asaas_upstream_error",
          message: "Falha ao criar cobrança no Asaas",
          details: data,
        },
      },
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  return json({ data }, res.status === 201 ? 201 : 200);
}
