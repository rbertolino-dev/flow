import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthContext,
  errorResponse,
  json,
  orgOwnerUserId,
  paginatedMeta,
  parsePagination,
  requireScope,
} from "../shared.ts";

const BUDGET_FIELDS =
  "id, organization_id, budget_number, lead_id, client_data, products, services, payment_methods, validity_days, observations, subtotal_products, subtotal_services, additions, total, approved, rejected, created_at, updated_at";

const OS_FIELDS =
  "id, organization_id, code, lead_id, client_name, client_phone, service_name, status_id, starts_at, ends_at, address, subtotal, discount, total, deleted_at, created_at, updated_at";

export async function handleBudgets(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);
  const match = path.match(/^\/budgets(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "budgets:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("budgets")
      .select(BUDGET_FIELDS, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);
    const leadId = url.searchParams.get("lead_id");
    if (leadId) query = query.eq("lead_id", leadId);
    const updatedSince = url.searchParams.get("updated_since");
    if (updatedSince) query = query.gte("updated_at", updatedSince);
    const { data, error, count } = await query;
    if (error) {
      console.error("list_budgets_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar orçamentos");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && id) {
    const scopeErr = requireScope(auth, "budgets:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("budgets")
      .select(BUDGET_FIELDS)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar orçamento");
    }
    if (!data) return errorResponse(404, "not_found", "Orçamento não encontrado");
    return json({ data });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "budgets:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const userId = await orgOwnerUserId(supabase, auth.organizationId);
    const products = Array.isArray(body.products) ? body.products : [];
    const services = Array.isArray(body.services) ? body.services : [];
    const subtotalProducts = Number(body.subtotal_products ?? 0);
    const subtotalServices = Number(body.subtotal_services ?? 0);
    const additions = Number(body.additions ?? 0);
    const total = Number(
      body.total ?? subtotalProducts + subtotalServices + additions,
    );
    const budgetNumber =
      String(body.budget_number || "").trim() ||
      `API-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from("budgets")
      .insert({
        organization_id: auth.organizationId,
        budget_number: budgetNumber,
        lead_id: body.lead_id != null ? String(body.lead_id) : null,
        client_data: body.client_data ?? {},
        products,
        services,
        payment_methods: Array.isArray(body.payment_methods)
          ? body.payment_methods
          : [],
        validity_days: Number(body.validity_days ?? 15),
        observations: body.observations != null ? String(body.observations) : null,
        subtotal_products: subtotalProducts,
        subtotal_services: subtotalServices,
        additions,
        total,
        created_by: userId,
      })
      .select(BUDGET_FIELDS)
      .single();
    if (error) {
      console.error("create_budget_error", error);
      return errorResponse(500, "internal_error", error.message || "Falha ao criar orçamento");
    }
    return json({ data }, 201);
  }

  if (req.method === "PATCH" && id) {
    const scopeErr = requireScope(auth, "budgets:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const allowed: Record<string, unknown> = {};
    if (body.observations !== undefined) {
      allowed.observations = body.observations === null ? null : String(body.observations);
    }
    if (body.approved !== undefined) allowed.approved = !!body.approved;
    if (body.rejected !== undefined) allowed.rejected = !!body.rejected;
    if (body.products !== undefined) allowed.products = body.products;
    if (body.services !== undefined) allowed.services = body.services;
    if (body.total !== undefined) allowed.total = Number(body.total);
    if (body.subtotal_products !== undefined) {
      allowed.subtotal_products = Number(body.subtotal_products);
    }
    if (body.subtotal_services !== undefined) {
      allowed.subtotal_services = Number(body.subtotal_services);
    }
    if (body.client_data !== undefined) allowed.client_data = body.client_data;
    if (Object.keys(allowed).length === 0) {
      return errorResponse(400, "validation_error", "Nenhum campo para atualizar");
    }
    allowed.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("budgets")
      .update(allowed)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select(BUDGET_FIELDS)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao atualizar orçamento");
    }
    if (!data) return errorResponse(404, "not_found", "Orçamento não encontrado");
    return json({ data });
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}

export async function handleServiceOrders(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);
  const match = path.match(/^\/service-orders(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "service_orders:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("service_orders")
      .select(OS_FIELDS, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    const leadId = url.searchParams.get("lead_id");
    if (leadId) query = query.eq("lead_id", leadId);
    const updatedSince = url.searchParams.get("updated_since");
    if (updatedSince) query = query.gte("updated_at", updatedSince);
    const { data, error, count } = await query;
    if (error) {
      console.error("list_os_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar ordens de serviço");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && id) {
    const scopeErr = requireScope(auth, "service_orders:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("service_orders")
      .select(OS_FIELDS)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar OS");
    }
    if (!data) return errorResponse(404, "not_found", "OS não encontrada");
    return json({ data });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "service_orders:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const userId = await orgOwnerUserId(supabase, auth.organizationId);
    const code =
      String(body.code || "").trim() ||
      `OS-API-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from("service_orders")
      .insert({
        organization_id: auth.organizationId,
        code,
        lead_id: body.lead_id != null ? String(body.lead_id) : null,
        client_name: body.client_name != null ? String(body.client_name) : null,
        client_phone: body.client_phone != null ? String(body.client_phone) : null,
        service_name: body.service_name != null ? String(body.service_name) : null,
        status_id: body.status_id != null ? String(body.status_id) : null,
        starts_at: body.starts_at != null ? String(body.starts_at) : null,
        ends_at: body.ends_at != null ? String(body.ends_at) : null,
        address: body.address != null ? String(body.address) : null,
        subtotal: Number(body.subtotal ?? 0),
        discount: Number(body.discount ?? 0),
        total: Number(body.total ?? 0),
        custom_fields: body.custom_fields ?? {},
        reference_images: body.reference_images ?? [],
        is_single_day: body.is_single_day !== false,
        has_commission: !!body.has_commission,
        created_by: userId,
      })
      .select(OS_FIELDS)
      .single();
    if (error) {
      console.error("create_os_error", error);
      return errorResponse(500, "internal_error", error.message || "Falha ao criar OS");
    }
    return json({ data }, 201);
  }

  if (req.method === "PATCH" && id) {
    const scopeErr = requireScope(auth, "service_orders:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const allowed: Record<string, unknown> = {};
    for (const key of [
      "client_name",
      "client_phone",
      "service_name",
      "address",
      "status_id",
      "starts_at",
      "ends_at",
      "diagnosis",
      "solution",
    ]) {
      if (body[key] !== undefined) {
        allowed[key] = body[key] === null ? null : String(body[key]);
      }
    }
    for (const key of ["subtotal", "discount", "total"]) {
      if (body[key] !== undefined) allowed[key] = Number(body[key]);
    }
    if (Object.keys(allowed).length === 0) {
      return errorResponse(400, "validation_error", "Nenhum campo para atualizar");
    }
    allowed.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("service_orders")
      .update(allowed)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .select(OS_FIELDS)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao atualizar OS");
    }
    if (!data) return errorResponse(404, "not_found", "OS não encontrada");
    return json({ data });
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}
