import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthContext,
  errorResponse,
  json,
  paginatedMeta,
  parsePagination,
  requireScope,
} from "../shared.ts";

export async function handleBookings(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);
  const match = path.match(/^\/bookings(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;
  const fields =
    "id, organization_id, requested_datetime, duration_minutes, client_name, client_email, client_phone, client_notes, status, created_at, updated_at";

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "bookings:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("booking_requests")
      .select(fields, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("requested_datetime", { ascending: false })
      .range(from, to);
    const status = url.searchParams.get("status");
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) {
      console.error("list_bookings_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar agendamentos");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && id) {
    const scopeErr = requireScope(auth, "bookings:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("booking_requests")
      .select(fields)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar agendamento");
    }
    if (!data) {
      return errorResponse(404, "not_found", "Agendamento não encontrado");
    }
    return json({ data });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "bookings:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const clientName = String(body.client_name || "").trim();
    const clientPhone = String(body.client_phone || "").trim();
    const requested = String(body.requested_datetime || "").trim();
    if (!clientName || !clientPhone || !requested) {
      return errorResponse(
        400,
        "validation_error",
        "client_name, client_phone e requested_datetime são obrigatórios",
      );
    }
    const { data, error } = await supabase
      .from("booking_requests")
      .insert({
        organization_id: auth.organizationId,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: body.client_email != null ? String(body.client_email) : null,
        client_notes: body.client_notes != null ? String(body.client_notes) : null,
        requested_datetime: requested,
        duration_minutes: Number(body.duration_minutes ?? 30),
        status: "pending",
        user_id: body.user_id != null ? String(body.user_id) : null,
      })
      .select(fields)
      .single();
    if (error) {
      console.error("create_booking_error", error);
      return errorResponse(
        500,
        "internal_error",
        error.message || "Falha ao criar agendamento",
      );
    }
    return json({ data }, 201);
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}

export async function handleCalendarEvents(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);
  const match = path.match(/^\/calendar\/events(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const id = match[1] || null;
  const fields =
    "id, organization_id, summary, description, location, start_datetime, end_datetime, status, html_link, created_at, updated_at";

  if (req.method === "GET" && !id) {
    const scopeErr = requireScope(auth, "calendar:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("calendar_events")
      .select(fields, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .order("start_datetime", { ascending: false })
      .range(from, to);
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    if (fromDate) query = query.gte("start_datetime", fromDate);
    if (toDate) query = query.lte("start_datetime", toDate);
    const { data, error, count } = await query;
    if (error) {
      console.error("list_events_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar eventos");
    }
    return json({
      data: data || [],
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && id) {
    const scopeErr = requireScope(auth, "calendar:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("calendar_events")
      .select(fields)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar evento");
    }
    if (!data) return errorResponse(404, "not_found", "Evento não encontrado");
    return json({ data });
  }

  if (req.method === "POST" && !id) {
    const scopeErr = requireScope(auth, "calendar:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const summary = String(body.summary || "").trim();
    const start = String(body.start_datetime || "").trim();
    const end = String(body.end_datetime || "").trim();
    if (!summary || !start || !end) {
      return errorResponse(
        400,
        "validation_error",
        "summary, start_datetime e end_datetime são obrigatórios",
      );
    }
    // google_calendar_config_id may be required — try with placeholder google_event_id
    const { data: cfg } = await supabase
      .from("google_calendar_configs")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .limit(1)
      .maybeSingle();

    const insert: Record<string, unknown> = {
      organization_id: auth.organizationId,
      summary,
      description: body.description != null ? String(body.description) : null,
      location: body.location != null ? String(body.location) : null,
      start_datetime: start,
      end_datetime: end,
      status: String(body.status || "confirmed"),
      google_event_id: `api-${crypto.randomUUID()}`,
    };
    if (cfg?.id) insert.google_calendar_config_id = cfg.id;

    const { data, error } = await supabase
      .from("calendar_events")
      .insert(insert)
      .select(fields)
      .single();
    if (error) {
      console.error("create_event_error", error);
      return errorResponse(
        500,
        "internal_error",
        error.message || "Falha ao criar evento",
      );
    }
    return json({ data }, 201);
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}
