import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthContext,
  errorResponse,
  json,
  paginatedMeta,
  parsePagination,
  requireScope,
} from "../shared.ts";

export async function handleMembers(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }
  const scopeErr = requireScope(auth, "members:read");
  if (scopeErr) return scopeErr;

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    return errorResponse(500, "internal_error", "Falha ao listar membros");
  }

  const userIds = (members || []).map((m) => m.user_id).filter(Boolean);
  let profiles: Record<string, { full_name: string | null; email: string | null }> =
    {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of profs || []) {
      profiles[p.id] = {
        full_name: p.full_name ?? null,
        email: p.email ?? null,
      };
    }
  }

  return json({
    data: (members || []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      full_name: profiles[m.user_id]?.full_name ?? null,
      email: profiles[m.user_id]?.email ?? null,
      created_at: m.created_at,
    })),
  });
}

export async function handleBroadcasts(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }
  const scopeErr = requireScope(auth, "comms:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const match = path.match(/^\/broadcasts(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;
  const fields =
    "id, organization_id, name, status, total_contacts, sent_count, failed_count, started_at, completed_at, created_at, instance_id, sending_method, scheduled_start_at";

  if (!id) {
    const { page, limit, from, to } = parsePagination(url);
    const { data, error, count } = await supabase
      .from("broadcast_campaigns")
      .select(fields, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      console.error("list_broadcasts_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar campanhas");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  const { data, error } = await supabase
    .from("broadcast_campaigns")
    .select(fields)
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (error) {
    return errorResponse(500, "internal_error", "Falha ao buscar campanha");
  }
  if (!data) return errorResponse(404, "not_found", "Campanha não encontrada");
  return json({ data });
}
