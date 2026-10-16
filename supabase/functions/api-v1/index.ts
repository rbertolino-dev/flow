import {
  AuthContext,
  authenticate,
  checkRateLimit,
  clientIp,
  corsHeaders,
  createServiceClient,
  errorResponse,
  json,
  logRequest,
  normalizePath,
  rateLimitForScopes,
} from "./shared.ts";
import { handleLeads } from "./handlers/leads.ts";
import { handleProducts, handleStages, handleTags } from "./handlers/catalog.ts";
import { handleBudgets, handleServiceOrders } from "./handlers/sales.ts";
import { handleBroadcasts, handleMembers } from "./handlers/org.ts";
import { handleFinancial, handlePosSales } from "./handlers/finance.ts";
import { handleBookings, handleCalendarEvents } from "./handlers/calendar.ts";
import { handleWebhooks } from "./handlers/webhooks.ts";
import { handleAsaas } from "./handlers/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);
  const ip = clientIp(req);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return errorResponse(500, "misconfigured", "Serviço mal configurado");
  }

  const authResult = await authenticate(supabase, req);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { auth } = authResult;

  const limit = rateLimitForScopes(auth.scopes);
  const allowed = await checkRateLimit(supabase, auth.key.id, limit);
  if (!allowed) {
    await logRequest(supabase, auth, req.method, path, 429, ip);
    return errorResponse(
      429,
      "rate_limited",
      `Limite de ${limit} requisições por minuto excedido`,
    );
  }

  let response: Response;
  try {
    response = await route(supabase, auth, req, path);
  } catch (e) {
    console.error("api_v1_unhandled", e);
    response = errorResponse(500, "internal_error", "Erro interno");
  }

  await logRequest(supabase, auth, req.method, path, response.status, ip);
  return response;
});

async function route(
  supabase: ReturnType<typeof createServiceClient>,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  if (path === "/" || path === "") {
    return json({
      data: {
        name: "Agilize CRM Public API",
        version: "1.2.0",
        organization_id: auth.organizationId,
        scopes: Array.from(auth.scopes),
      },
    });
  }

  if (path.startsWith("/leads")) {
    return handleLeads(supabase, auth, req, path);
  }
  if (path === "/tags") {
    return handleTags(supabase, auth, req);
  }
  if (path === "/stages") {
    return handleStages(supabase, auth, req);
  }
  if (path.startsWith("/products")) {
    return handleProducts(supabase, auth, req, path);
  }
  if (path.startsWith("/budgets")) {
    return handleBudgets(supabase, auth, req, path);
  }
  if (path.startsWith("/service-orders")) {
    return handleServiceOrders(supabase, auth, req, path);
  }
  if (path === "/members") {
    return handleMembers(supabase, auth, req);
  }
  if (path.startsWith("/broadcasts")) {
    return handleBroadcasts(supabase, auth, req, path);
  }
  if (path.startsWith("/financial")) {
    return handleFinancial(supabase, auth, req, path);
  }
  if (path.startsWith("/pos/")) {
    return handlePosSales(supabase, auth, req, path);
  }
  if (path.startsWith("/bookings")) {
    return handleBookings(supabase, auth, req, path);
  }
  if (path.startsWith("/calendar/")) {
    return handleCalendarEvents(supabase, auth, req, path);
  }
  if (path.startsWith("/webhooks")) {
    return handleWebhooks(supabase, auth, req, path);
  }
  if (path.startsWith("/asaas/")) {
    return handleAsaas(supabase, auth, req, path);
  }

  return errorResponse(404, "not_found", "Endpoint não encontrado");
}
