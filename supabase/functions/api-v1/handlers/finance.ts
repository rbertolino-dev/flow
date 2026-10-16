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

const ENTRY_FIELDS =
  "id, organization_id, direction, amount, due_date, competence_date, paid_at, status, settlement_status, source_type, source_id, lead_id, budget_id, description, contact_name, category, category_id, account, payment_method, notes, created_at, updated_at";

export async function handleFinancial(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);

  if (path === "/financial/accounts" && req.method === "GET") {
    const scopeErr = requireScope(auth, "finance:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("financial_accounts")
      .select("id, organization_id, name, bank_name, account_type, created_at")
      .eq("organization_id", auth.organizationId)
      .order("name");
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao listar contas");
    }
    return json({ data: data || [] });
  }

  if (path === "/financial/categories" && req.method === "GET") {
    const scopeErr = requireScope(auth, "finance:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("financial_categories")
      .select("id, organization_id, name, direction, created_at")
      .eq("organization_id", auth.organizationId)
      .order("name");
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao listar categorias");
    }
    return json({ data: data || [] });
  }

  const settleMatch = path.match(
    /^\/financial\/entries\/([0-9a-f-]{36})\/settle$/i,
  );
  if (settleMatch) {
    if (req.method !== "PATCH" && req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Método não permitido");
    }
    const scopeErr = requireScope(auth, "finance:write");
    if (scopeErr) return scopeErr;
    const id = settleMatch[1];
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const paidAt = body.paid_at
      ? String(body.paid_at)
      : new Date().toISOString();
    const { data, error } = await supabase
      .from("financial_entries")
      .update({
        status: "paid",
        settlement_status: "confirmado",
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .neq("status", "cancelled")
      .select(ENTRY_FIELDS)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao baixar lançamento");
    }
    if (!data) {
      return errorResponse(404, "not_found", "Lançamento não encontrado");
    }
    return json({ data });
  }

  const entryMatch = path.match(/^\/financial\/entries(?:\/([0-9a-f-]{36}))?$/i);
  if (!entryMatch) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = entryMatch[1] || null;

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "finance:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("financial_entries")
      .select(ENTRY_FIELDS, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("due_date", { ascending: false })
      .range(from, to);
    const direction = url.searchParams.get("direction");
    const status = url.searchParams.get("status");
    const dueFrom = url.searchParams.get("due_from");
    const dueTo = url.searchParams.get("due_to");
    const updatedSince = url.searchParams.get("updated_since");
    if (direction) query = query.eq("direction", direction);
    if (status) query = query.eq("status", status);
    if (dueFrom) query = query.gte("due_date", dueFrom);
    if (dueTo) query = query.lte("due_date", dueTo);
    if (updatedSince) query = query.gte("updated_at", updatedSince);
    const { data, error, count } = await query;
    if (error) {
      console.error("list_entries_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar lançamentos");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && id) {
    const scopeErr = requireScope(auth, "finance:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("financial_entries")
      .select(ENTRY_FIELDS)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar lançamento");
    }
    if (!data) return errorResponse(404, "not_found", "Lançamento não encontrado");
    return json({ data });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "finance:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const direction = String(body.direction || "");
    if (direction !== "receber" && direction !== "pagar") {
      return errorResponse(
        400,
        "validation_error",
        "direction deve ser 'receber' ou 'pagar'",
      );
    }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return errorResponse(400, "validation_error", "amount inválido");
    }
    const dueDate = String(body.due_date || "").trim();
    if (!dueDate) {
      return errorResponse(400, "validation_error", "due_date é obrigatório");
    }
    const userId = await orgOwnerUserId(supabase, auth.organizationId);
    const sourceId =
      String(body.source_id || "").trim() || `api-${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("financial_entries")
      .insert({
        organization_id: auth.organizationId,
        direction,
        amount,
        due_date: dueDate,
        competence_date: body.competence_date
          ? String(body.competence_date)
          : dueDate,
        status: String(body.status || "open"),
        settlement_status: String(body.settlement_status || "previsto"),
        source_type: String(body.source_type || "manual"),
        source_id: sourceId,
        lead_id: body.lead_id != null ? String(body.lead_id) : null,
        description: body.description != null ? String(body.description) : null,
        contact_name: body.contact_name != null ? String(body.contact_name) : null,
        category: body.category != null ? String(body.category) : null,
        category_id: body.category_id != null ? String(body.category_id) : null,
        account: body.account != null ? String(body.account) : null,
        payment_method:
          body.payment_method != null ? String(body.payment_method) : null,
        notes: body.notes != null ? String(body.notes) : null,
        origin_label: "api",
        created_by: userId,
      })
      .select(ENTRY_FIELDS)
      .single();
    if (error) {
      console.error("create_entry_error", error);
      return errorResponse(
        500,
        "internal_error",
        error.message || "Falha ao criar lançamento",
      );
    }
    return json({ data }, 201);
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}

export async function handlePosSales(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }
  const scopeErr = requireScope(auth, "pos:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const match = path.match(/^\/pos\/sales(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;
  const fields =
    "id, organization_id, sale_number, lead_id, customer_name, customer_phone, status, subtotal, discount_amount, total, sale_origin, sold_at, sold_by_name, created_at, updated_at";

  if (!id) {
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("pos_sales")
      .select(fields, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);
    const status = url.searchParams.get("status");
    if (status) query = query.eq("status", status);
    const updatedSince = url.searchParams.get("updated_since");
    if (updatedSince) query = query.gte("updated_at", updatedSince);
    const { data, error, count } = await query;
    if (error) {
      // Tabela PDV pode ainda não existir neste projeto
      const msg = String(error.message || "");
      if (/pos_sales|does not exist|schema cache/i.test(msg)) {
        return json({
          data: [],
          meta: paginatedMeta(page, limit, 0, to),
        });
      }
      console.error("list_pos_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar vendas");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  const { data, error } = await supabase
    .from("pos_sales")
    .select(fields)
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (error) {
    const msg = String(error.message || "");
    if (/pos_sales|does not exist|schema cache/i.test(msg)) {
      return errorResponse(404, "not_found", "Venda não encontrada");
    }
    return errorResponse(500, "internal_error", "Falha ao buscar venda");
  }
  if (!data) return errorResponse(404, "not_found", "Venda não encontrada");

  const { data: items } = await supabase
    .from("pos_sale_items")
    .select(
      "id, product_id, product_name, quantity, unit_price, total_price, discount_amount",
    )
    .eq("sale_id", id);

  return json({ data: { ...data, items: items || [] } });
}
