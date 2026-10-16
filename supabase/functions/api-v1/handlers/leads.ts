import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthContext,
  assertLeadInOrg,
  errorResponse,
  json,
  paginatedMeta,
  parsePagination,
  requireScope,
} from "../shared.ts";

const LEAD_FIELDS =
  "id, organization_id, name, phone, email, company, value, stage_id, status, source, notes, assigned_to, created_at, updated_at";

function mapLead(row: Record<string, unknown>) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? null,
    company: row.company ?? null,
    value: row.value ?? null,
    stage_id: row.stage_id ?? null,
    status: row.status ?? null,
    source: row.source ?? null,
    notes: row.notes ?? null,
    assigned_to: row.assigned_to ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function handleLeads(
  supabase: SupabaseClient,
  auth: AuthContext,
  req: Request,
  path: string,
): Promise<Response> {
  const url = new URL(req.url);

  // /leads/:id/tags/:tagId
  const tagDetach = path.match(
    /^\/leads\/([0-9a-f-]{36})\/tags\/([0-9a-f-]{36})$/i,
  );
  if (tagDetach) {
    const [, leadId, tagId] = tagDetach;
    if (req.method !== "DELETE") {
      return errorResponse(405, "method_not_allowed", "Método não permitido");
    }
    const scopeErr = requireScope(auth, "tags:write");
    if (scopeErr) return scopeErr;
    if (!(await assertLeadInOrg(supabase, auth.organizationId, leadId))) {
      return errorResponse(404, "not_found", "Lead não encontrado");
    }
    const { error } = await supabase
      .from("lead_tags")
      .delete()
      .eq("lead_id", leadId)
      .eq("tag_id", tagId);
    if (error) {
      console.error("detach_tag_error", error);
      return errorResponse(500, "internal_error", "Falha ao remover etiqueta");
    }
    return json({ data: { lead_id: leadId, tag_id: tagId, detached: true } });
  }

  // /leads/:id/tags
  const tagsMatch = path.match(/^\/leads\/([0-9a-f-]{36})\/tags\/?$/i);
  if (tagsMatch) {
    const leadId = tagsMatch[1];
    if (!(await assertLeadInOrg(supabase, auth.organizationId, leadId))) {
      return errorResponse(404, "not_found", "Lead não encontrado");
    }

    if (req.method === "GET") {
      const scopeErr = requireScope(auth, "tags:read");
      if (scopeErr) return scopeErr;
      const { data: links, error } = await supabase
        .from("lead_tags")
        .select("tag_id, created_at, tags(id, name, color)")
        .eq("lead_id", leadId);
      if (error) {
        console.error("list_lead_tags_error", error);
        return errorResponse(500, "internal_error", "Falha ao listar etiquetas");
      }
      const tags = (links || []).map((l: Record<string, unknown>) => {
        const t = l.tags as Record<string, unknown> | null;
        return {
          id: t?.id ?? l.tag_id,
          name: t?.name ?? null,
          color: t?.color ?? null,
          attached_at: l.created_at,
        };
      });
      return json({ data: tags });
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

      let tagId = body.tag_id ? String(body.tag_id) : null;
      if (!tagId && body.name) {
        const name = String(body.name).trim();
        const { data: existing } = await supabase
          .from("tags")
          .select("id")
          .eq("organization_id", auth.organizationId)
          .eq("name", name)
          .maybeSingle();
        if (existing) {
          tagId = existing.id;
        } else {
          const owner = await supabase
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", auth.organizationId)
            .limit(1)
            .maybeSingle();
          const { data: created, error: cErr } = await supabase
            .from("tags")
            .insert({
              organization_id: auth.organizationId,
              name,
              color: String(body.color || "#10b981"),
              user_id: owner.data?.user_id,
            })
            .select("id")
            .single();
          if (cErr || !created) {
            return errorResponse(500, "internal_error", "Falha ao criar etiqueta");
          }
          tagId = created.id;
        }
      }
      if (!tagId) {
        return errorResponse(400, "validation_error", "Informe tag_id ou name");
      }

      const { data: tagOk } = await supabase
        .from("tags")
        .select("id")
        .eq("id", tagId)
        .eq("organization_id", auth.organizationId)
        .maybeSingle();
      if (!tagOk) {
        return errorResponse(400, "validation_error", "Etiqueta inválida");
      }

      const { error } = await supabase.from("lead_tags").upsert(
        { lead_id: leadId, tag_id: tagId },
        { onConflict: "lead_id,tag_id", ignoreDuplicates: true },
      );
      if (error) {
        // fallback insert if upsert constraint name differs
        const { error: iErr } = await supabase
          .from("lead_tags")
          .insert({ lead_id: leadId, tag_id: tagId });
        if (iErr && !/duplicate|unique/i.test(iErr.message)) {
          console.error("attach_tag_error", iErr);
          return errorResponse(500, "internal_error", "Falha ao associar etiqueta");
        }
      }
      return json({ data: { lead_id: leadId, tag_id: tagId } }, 201);
    }

    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }

  // /leads/:id/activities
  const actMatch = path.match(/^\/leads\/([0-9a-f-]{36})\/activities\/?$/i);
  if (actMatch) {
    const leadId = actMatch[1];
    if (!(await assertLeadInOrg(supabase, auth.organizationId, leadId))) {
      return errorResponse(404, "not_found", "Lead não encontrado");
    }

    if (req.method === "GET") {
      const scopeErr = requireScope(auth, "activities:read");
      if (scopeErr) return scopeErr;
      const { page, limit, from, to } = parsePagination(url);
      const { data, error, count } = await supabase
        .from("activities")
        .select(
          "id, organization_id, lead_id, type, content, direction, user_name, created_at",
          { count: "exact" },
        )
        .eq("organization_id", auth.organizationId)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        console.error("list_activities_error", error);
        return errorResponse(500, "internal_error", "Falha ao listar atividades");
      }
      return json({
        data: data || [],
        meta: paginatedMeta(page, limit, count ?? 0, to),
      });
    }

    if (req.method === "POST") {
      const scopeErr = requireScope(auth, "activities:write");
      if (scopeErr) return scopeErr;
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, "invalid_json", "JSON inválido");
      }
      const type = String(body.type || "note").trim();
      const content = String(body.content || "").trim();
      if (!content) {
        return errorResponse(400, "validation_error", "content é obrigatório");
      }
      const { data, error } = await supabase
        .from("activities")
        .insert({
          organization_id: auth.organizationId,
          lead_id: leadId,
          type,
          content,
          direction: body.direction != null ? String(body.direction) : null,
          user_name: body.user_name != null ? String(body.user_name) : "API",
        })
        .select(
          "id, organization_id, lead_id, type, content, direction, user_name, created_at",
        )
        .single();
      if (error) {
        console.error("create_activity_error", error);
        return errorResponse(500, "internal_error", "Falha ao criar atividade");
      }
      return json({ data }, 201);
    }

    return errorResponse(405, "method_not_allowed", "Método não permitido");
  }

  const leadMatch = path.match(/^\/leads(?:\/([0-9a-f-]{36}))?$/i);
  if (!leadMatch) {
    return errorResponse(404, "not_found", "Endpoint não encontrado");
  }
  const leadId = leadMatch[1] || null;

  if (req.method === "GET" && !leadId) {
    const scopeErr = requireScope(auth, "leads:read");
    if (scopeErr) return scopeErr;
    const { page, limit, from, to } = parsePagination(url);
    let query = supabase
      .from("leads")
      .select(LEAD_FIELDS, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    const stageId = url.searchParams.get("stage_id");
    const phone = url.searchParams.get("phone");
    const email = url.searchParams.get("email");
    const q = url.searchParams.get("q");
    const updatedSince = url.searchParams.get("updated_since");

    if (stageId) query = query.eq("stage_id", stageId);
    if (phone) query = query.eq("phone", phone.replace(/\D/g, ""));
    if (email) query = query.ilike("email", email);
    if (q) query = query.ilike("name", `%${q}%`);
    if (updatedSince) query = query.gte("updated_at", updatedSince);

    const { data, error, count } = await query;
    if (error) {
      console.error("list_leads_error", error);
      return errorResponse(500, "internal_error", "Falha ao listar leads");
    }
    return json({
      data: (data || []).map((r) => mapLead(r as Record<string, unknown>)),
      meta: paginatedMeta(page, limit, count ?? 0, to),
    });
  }

  if (req.method === "GET" && leadId) {
    const scopeErr = requireScope(auth, "leads:read");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_FIELDS)
      .eq("organization_id", auth.organizationId)
      .eq("id", leadId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao buscar lead");
    }
    if (!data) return errorResponse(404, "not_found", "Lead não encontrado");
    return json({ data: mapLead(data as Record<string, unknown>) });
  }

  if (req.method === "POST" && !leadId) {
    const scopeErr = requireScope(auth, "leads:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!name || !phone) {
      return errorResponse(400, "validation_error", "Campos obrigatórios: name, phone");
    }
    const { data: newId, error } = await supabase.rpc("create_lead_via_api", {
      p_org_id: auth.organizationId,
      p_name: name,
      p_phone: phone,
      p_email: body.email != null ? String(body.email) : null,
      p_company: body.company != null ? String(body.company) : null,
      p_value: body.value != null && body.value !== "" ? Number(body.value) : null,
      p_stage_id: body.stage_id != null ? String(body.stage_id) : null,
      p_notes: body.notes != null ? String(body.notes) : null,
      p_source: body.source != null ? String(body.source) : "api",
    });
    if (error) {
      const msg = error.message || "Falha ao criar lead";
      if (/já existe/i.test(msg)) {
        return errorResponse(409, "duplicate_phone", msg);
      }
      if (/obrigatór|inválid|Etapa|Limite/i.test(msg)) {
        return errorResponse(400, "validation_error", msg);
      }
      return errorResponse(500, "internal_error", msg);
    }
    const { data: created } = await supabase
      .from("leads")
      .select(LEAD_FIELDS)
      .eq("id", newId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    return json(
      { data: created ? mapLead(created as Record<string, unknown>) : { id: newId } },
      201,
    );
  }

  if (req.method === "PATCH" && leadId) {
    const scopeErr = requireScope(auth, "leads:write");
    if (scopeErr) return scopeErr;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "JSON inválido");
    }
    const allowed: Record<string, unknown> = {};
    for (const key of ["name", "email", "company", "notes", "status", "source", "assigned_to"]) {
      if (body[key] !== undefined) {
        allowed[key] = body[key] === null ? null : String(body[key]);
      }
    }
    if (body.phone !== undefined) {
      allowed.phone = String(body.phone).replace(/\D/g, "");
    }
    if (body.value !== undefined) {
      allowed.value = body.value === null || body.value === "" ? null : Number(body.value);
    }
    if (body.stage_id !== undefined) {
      if (body.stage_id !== null) {
        const { data: stageOk } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("id", String(body.stage_id))
          .eq("organization_id", auth.organizationId)
          .maybeSingle();
        if (!stageOk) {
          return errorResponse(400, "validation_error", "Etapa inválida");
        }
      }
      allowed.stage_id = body.stage_id === null ? null : String(body.stage_id);
    }
    if (Object.keys(allowed).length === 0) {
      return errorResponse(400, "validation_error", "Nenhum campo para atualizar");
    }
    allowed.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("leads")
      .update(allowed)
      .eq("id", leadId)
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .select(LEAD_FIELDS)
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao atualizar lead");
    }
    if (!data) return errorResponse(404, "not_found", "Lead não encontrado");
    return json({ data: mapLead(data as Record<string, unknown>) });
  }

  if (req.method === "DELETE" && leadId) {
    const scopeErr = requireScope(auth, "leads:write");
    if (scopeErr) return scopeErr;
    const { data, error } = await supabase
      .from("leads")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("organization_id", auth.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      return errorResponse(500, "internal_error", "Falha ao excluir lead");
    }
    if (!data) return errorResponse(404, "not_found", "Lead não encontrado");
    return json({ data: { id: data.id, deleted: true } });
  }

  return errorResponse(405, "method_not_allowed", "Método não permitido");
}
