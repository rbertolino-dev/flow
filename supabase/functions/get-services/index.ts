import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, PATCH",
  "Access-Control-Max-Age": "86400",
};

interface Service {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  tax_class_ref?: string | null;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractOrganizationId(
  req: Request,
  url: URL,
  body?: Record<string, unknown> | null
): string {
  const fromHeader = (req.headers.get("x-organization-id") || "").trim();
  const fromQuery = (url.searchParams.get("organization_id") || "").trim();
  const fromBody =
    body && typeof body.organization_id === "string"
      ? body.organization_id.trim()
      : "";
  return fromHeader || fromQuery || fromBody;
}

async function assertOrgAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, status: 400, error: "organization_id inválido" };
  }

  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (memberError) {
    console.error("Erro ao validar membership:", memberError);
    return { ok: false, status: 500, error: "Erro ao validar organização" };
  }

  if (membership?.organization_id) {
    return { ok: true };
  }

  // Super admin da plataforma pode operar na org ativa escolhida no CRM
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    console.error("Erro ao validar role admin:", roleError);
    return { ok: false, status: 500, error: "Erro ao validar permissões" };
  }

  if (roleRow?.role === "admin") {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: "Sem acesso a esta organização",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Content-Length": "0",
      },
    });
  }

  let client: Client | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const url = new URL(req.url);
    let body: Record<string, unknown> | null = null;
    if (req.method === "POST" || req.method === "PATCH") {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }

    const organizationId = extractOrganizationId(req, url, body);
    if (!organizationId) {
      return jsonResponse(
        {
          error:
            "organization_id é obrigatório. Cada empresa só vê e gerencia a própria lista de serviços.",
        },
        400
      );
    }

    const access = await assertOrgAccess(supabase, user.id, organizationId);
    if (!access.ok) {
      return jsonResponse({ error: access.error, data: [] }, access.status);
    }

    const postgresHost = Deno.env.get("POSTGRES_HOST") || "localhost";
    const postgresPort = parseInt(Deno.env.get("POSTGRES_PORT") || "5432");
    const postgresDb = Deno.env.get("POSTGRES_DB") || "budget_services";
    const postgresUser = Deno.env.get("POSTGRES_USER") || "budget_user";
    const postgresPassword = Deno.env.get("POSTGRES_PASSWORD");

    if (!postgresPassword) {
      console.error("POSTGRES_PASSWORD não configurada");
      return jsonResponse({ error: "Configuração do PostgreSQL não encontrada" }, 500);
    }

    client = new Client({
      hostname: postgresHost,
      port: postgresPort,
      database: postgresDb,
      user: postgresUser,
      password: postgresPassword,
    });

    await client.connect();
    await client.queryArray(`ALTER TABLE services ADD COLUMN IF NOT EXISTS tax_class_ref TEXT`);

    const serviceId = url.searchParams.get("id");
    const category = url.searchParams.get("category");
    const activeOnly = url.searchParams.get("active_only") !== "false";

    if (req.method === "GET") {
      let query = `
        SELECT
          id,
          organization_id,
          name,
          description,
          price,
          category,
          tax_class_ref,
          image_url,
          is_active,
          created_at,
          updated_at
        FROM services
        WHERE organization_id = $1
      `;
      const params: unknown[] = [organizationId];

      if (serviceId) {
        query += " AND id = $2";
        params.push(serviceId);
      } else {
        if (category) {
          query += " AND category = $2";
          params.push(category);
        }
        if (activeOnly) {
          query += " AND is_active = true";
        }
      }

      query += " ORDER BY name ASC";

      const result = await client.queryObject<Service>(query, params);
      // Blindagem: nunca devolver linha de outra organização
      const rows = result.rows.filter((row) => row.organization_id === organizationId);

      return jsonResponse({ data: rows });
    }

    if (req.method === "DELETE") {
      const deleteId = url.searchParams.get("id");

      if (!deleteId) {
        return jsonResponse({ error: "ID do serviço é obrigatório" }, 400);
      }

      const checkQuery = `
        SELECT id FROM services
        WHERE id = $1 AND organization_id = $2
      `;
      const checkResult = await client.queryObject(checkQuery, [deleteId, organizationId]);

      if (checkResult.rows.length === 0) {
        return jsonResponse({ error: "Serviço não encontrado nesta organização" }, 404);
      }

      const deleteQuery = `
        DELETE FROM services
        WHERE id = $1 AND organization_id = $2
        RETURNING id
      `;
      const result = await client.queryObject<{ id: string }>(deleteQuery, [
        deleteId,
        organizationId,
      ]);

      return jsonResponse({ data: { id: result.rows[0].id, deleted: true } });
    }

    if (req.method === "POST") {
      if (!body) {
        return jsonResponse({ error: "Corpo da requisição inválido" }, 400);
      }

      const {
        id,
        name,
        description,
        price,
        category,
        is_active,
        image_url,
        tax_class_ref,
      } = body;

      if (!name || price === undefined) {
        return jsonResponse({ error: "Nome e preço são obrigatórios" }, 400);
      }

      if (id) {
        const updateQuery = `
          UPDATE services
          SET
            name = $1,
            description = $2,
            price = $3,
            category = $4,
            is_active = $5,
            image_url = $6,
            tax_class_ref = $7,
            updated_at = now()
          WHERE id = $8 AND organization_id = $9
          RETURNING *
        `;
        const result = await client.queryObject<Service>(updateQuery, [
          name,
          description || null,
          price,
          category || null,
          is_active !== false,
          image_url ?? null,
          tax_class_ref || null,
          id,
          organizationId,
        ]);

        if (result.rows.length === 0) {
          return jsonResponse(
            { error: "Serviço não encontrado nesta organização" },
            404
          );
        }

        const updated = result.rows[0];
        if (updated.organization_id !== organizationId) {
          return jsonResponse({ error: "Violação de isolamento por organização" }, 403);
        }

        return jsonResponse({ data: updated });
      }

      const insertQuery = `
        INSERT INTO services (organization_id, name, description, price, category, is_active, image_url, tax_class_ref)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await client.queryObject<Service>(insertQuery, [
        organizationId,
        name,
        description || null,
        price,
        category || null,
        is_active !== false,
        image_url ?? null,
        tax_class_ref || null,
      ]);

      if (result.rows.length === 0) {
        return jsonResponse({ error: "Erro ao criar serviço" }, 500);
      }

      const createdService = result.rows[0];
      if (createdService.organization_id !== organizationId) {
        return jsonResponse({ error: "Violação de isolamento por organização" }, 500);
      }

      console.log(
        "Serviço criado:",
        createdService.id,
        createdService.name,
        "org:",
        organizationId
      );

      return jsonResponse({ data: createdService }, 201);
    }

    return jsonResponse({ error: "Método não permitido" }, 405);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro no get-services:", error);
    return jsonResponse(
      {
        error: "Erro interno do servidor",
        details: message,
      },
      500
    );
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore close errors
      }
    }
  }
});
