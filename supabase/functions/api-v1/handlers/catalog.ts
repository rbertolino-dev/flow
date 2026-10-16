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

export async function handleTags(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
): Promise<Response> {
  if (req.method === "GET") {
    const scopeErr = requireScope(auth, "tags:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, color, organization_id, created_at")
      .eq("organization_id", auth.organizationId)
      .order("name", { ascending: true });
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao listar etiquetas");
    }
    return json({ data: data || [] });
  }

  if (req.method === "POST") {
    const scopeErr = requireScope(auth, "tags:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const name = String(body.name || "").trim();
    if (!name) {
      return errorResponse(400, "validation_error", "name é obrigatório");
    }
    const userId = await orgOwnerUserId(supabase, auth.organizationId);
    const { data, error } = await supabase
      .from("tags")
      .insert({
        organization_id: auth.organizationId,
        name,
        color: String(body.color || "#10b981"),
        user_id: userId,
      })
      .select("id, name, color, organization_id, created_at")
      .single();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao criar etiqueta");
    }
    return json({ data }, 201);
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}

export async function handleStages(
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
    return errorResponse(500, "internal_error", "Falha ao listar etapas");
  }
  return json({ data: data || [] });
}

const PRODUCT_FIELDS =
  "id, organization_id, name, description, price, category, active, is_active, sale_paused, commission_percentage, commission_fixed, created_at, updated_at, created_by, updated_by";

export async function handleProducts(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);
  const match = path.match(/^\/products(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "products:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("products")
      .select(PRODUCT_FIELDS, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("name", { ascending: true })
      .range(from, to);
    if (url.searchParams.get("active") === "true") {
      query = query.eq("is_active", true);
    }
    const q = url.searchParams.get("q");
    if (q) query = query.ilike("name", `%${q}%`);
    const { data, error, count } = await query;
    if (error) {
      console.error("list_products_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar produtos");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && id) {
    const scopeErr = requireScope(auth, "products:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar produto");
    }
    if (!data) return errorResponse(404, "not_found", "Produto não encontrado");
    return json({ data });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "products:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const name = String(body.name || "").trim();
    if (!name) {
      return errorResponse(400, "validation_error", "name é obrigatório");
    }
    const userId = await orgOwnerUserId(supabase, auth.organizationId);
    const isActive = body.is_active !== false && body.active !== false;
    const { data, error } = await supabase
      .from("products")
      .insert({
        organization_id: auth.organizationId,
        name,
        description: body.description != null ? String(body.description) : null,
        price: Number(body.price ?? 0),
        category: body.category != null ? String(body.category) : null,
        active: isActive,
        is_active: isActive,
        sale_paused: !!body.sale_paused,
        commission_percentage:
          body.commission_percentage != null
            ? Number(body.commission_percentage)
            : null,
        commission_fixed:
          body.commission_fixed != null ? Number(body.commission_fixed) : null,
        created_by: userId,
      })
      .select(PRODUCT_FIELDS)
      .single();
    if (error) {
      console.error("create_product_error", error);
      return errorResponse(500, "internal_error", "Falha ao criar produto");
    }
    return json({ data }, 201);
  }

  if (req.method === "PATCH" && id) {
    const scopeErr = requireScope(auth, "products:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const allowed: Record<string, unknown> = {};
    for (const key of ["name", "description", "category"]) {
      if (body[key] !== undefined) {
        allowed[key] = body[key] === null ? null : String(body[key]);
      }
    }
    for (const key of ["price", "commission_percentage", "commission_fixed"]) {
      if (body[key] !== undefined) {
        allowed[key] = body[key] === null ? null : Number(body[key]);
      }
    }
    if (body.is_active !== undefined) {
      allowed.is_active = !!body.is_active;
      allowed.active = !!body.is_active;
    }
    if (body.active !== undefined) {
      allowed.active = !!body.active;
      allowed.is_active = !!body.active;
    }
    if (body.sale_paused !== undefined) allowed.sale_paused = !!body.sale_paused;
    if (Object.keys(allowed).length === 0) {
      return errorResponse(400, "validation_error", "Nenhum campo para atualizar");
    }
    allowed.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("products")
      .update(allowed)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select(PRODUCT_FIELDS)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao atualizar produto");
    }
    if (!data) return errorResponse(404, "not_found", "Produto não encontrado");
    return json({ data });
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}
