import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Benefit {
  id: string;
  employee_id: string;
  benefit_type: string;
  provider?: string;
  plan_name?: string;
  value?: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

async function getPostgresClient() {
  const postgresHost = Deno.env.get('POSTGRES_HOST') || 'localhost';
  const postgresPort = parseInt(Deno.env.get('POSTGRES_PORT') || '5432');
  const postgresDb = Deno.env.get('POSTGRES_DB') || 'budget_services';
  const postgresUser = Deno.env.get('POSTGRES_USER') || 'budget_user';
  const postgresPassword = Deno.env.get('POSTGRES_PASSWORD');

  if (!postgresPassword) {
    throw new Error('POSTGRES_PASSWORD não configurada');
  }

  const client = new Client({
    hostname: postgresHost,
    port: postgresPort,
    database: postgresDb,
    user: postgresUser,
    password: postgresPassword,
    connection: {
      keepAlive: true,
      tls: { enforce: false },
    },
  });

  await client.connect();
  return client;
}

async function validateEmployeeAccess(
  supabase: any,
  userId: string,
  employeeId: string
): Promise<{ hasAccess: boolean; organizationId?: string }> {
  const { data: orgMembers } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1);

  if (!orgMembers || orgMembers.length === 0) {
    return { hasAccess: false };
  }

  const organizationId = orgMembers[0].organization_id;

  const client = await getPostgresClient();
  try {
    const result = await client.queryObject<{ organization_id: string }>(
      'SELECT organization_id FROM employees WHERE id = $1',
      [employeeId]
    );

    if (result.rows.length === 0 || result.rows[0].organization_id !== organizationId) {
      return { hasAccess: false };
    }

    return { hasAccess: true, organizationId };
  } finally {
    await client.end();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employee_id');
    const benefitId = url.searchParams.get('id');
    const activeOnly = url.searchParams.get('active_only') === 'true';

    if (req.method === 'GET') {
      if (!employeeId) {
        return new Response(
          JSON.stringify({ error: 'employee_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access = await validateEmployeeAccess(supabase, user.id, employeeId);
      if (!access.hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para acessar este funcionário' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        if (benefitId) {
          const result = await client.queryObject<Benefit>(
            'SELECT * FROM employee_benefits WHERE id = $1 AND employee_id = $2',
            [benefitId, employeeId]
          );
          return new Response(
            JSON.stringify({ data: result.rows[0] || null }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          let query = 'SELECT * FROM employee_benefits WHERE employee_id = $1';
          const params: any[] = [employeeId];

          if (activeOnly) {
            query += ' AND is_active = true';
          }

          query += ' ORDER BY start_date DESC';

          const result = await client.queryObject<Benefit>(query, params);
          return new Response(
            JSON.stringify({ data: result.rows }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } finally {
        await client.end();
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.json();
      const {
        id,
        employee_id,
        benefit_type,
        provider,
        plan_name,
        value,
        start_date,
        end_date,
        is_active,
        notes,
      } = body;

      const empId = employee_id || employeeId;
      if (!empId) {
        return new Response(
          JSON.stringify({ error: 'employee_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access = await validateEmployeeAccess(supabase, user.id, empId);
      if (!access.hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para modificar este funcionário' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!benefit_type || !start_date) {
        return new Response(
          JSON.stringify({ error: 'Tipo de benefício e data de início são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        if (id || req.method === 'PUT') {
          const updateId = id || benefitId;
          if (!updateId) {
            return new Response(
              JSON.stringify({ error: 'ID do benefício é obrigatório para atualização' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const result = await client.queryObject<Benefit>(
            `UPDATE employee_benefits
             SET benefit_type = $1, provider = $2, plan_name = $3, value = $4,
                 start_date = $5, end_date = $6, is_active = $7, notes = $8, updated_at = now()
             WHERE id = $9 AND employee_id = $10
             RETURNING *`,
            [
              benefit_type,
              provider || null,
              plan_name || null,
              value || null,
              start_date,
              end_date || null,
              is_active !== false,
              notes || null,
              updateId,
              empId,
            ]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Benefício não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const result = await client.queryObject<Benefit>(
            `INSERT INTO employee_benefits (
              employee_id, benefit_type, provider, plan_name, value,
              start_date, end_date, is_active, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
              empId,
              benefit_type,
              provider || null,
              plan_name || null,
              value || null,
              start_date,
              end_date || null,
              is_active !== false,
              notes || null,
            ]
          );

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } finally {
        await client.end();
      }
    }

    if (req.method === 'DELETE') {
      if (!benefitId) {
        return new Response(
          JSON.stringify({ error: 'ID do benefício é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!employeeId) {
        return new Response(
          JSON.stringify({ error: 'employee_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access = await validateEmployeeAccess(supabase, user.id, employeeId);
      if (!access.hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para deletar este benefício' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        const result = await client.queryObject(
          'DELETE FROM employee_benefits WHERE id = $1 AND employee_id = $2 RETURNING id',
          [benefitId, employeeId]
        );

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Benefício não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: { id: benefitId } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        await client.end();
      }
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


