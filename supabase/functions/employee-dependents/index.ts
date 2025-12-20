import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Dependent {
  id: string;
  employee_id: string;
  name: string;
  relationship: string;
  birth_date?: string;
  cpf?: string;
  is_ir_dependent: boolean;
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

  // Verificar se o funcionário pertence à organização
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
    const dependentId = url.searchParams.get('id');

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
        if (dependentId) {
          const result = await client.queryObject<Dependent>(
            'SELECT * FROM employee_dependents WHERE id = $1 AND employee_id = $2',
            [dependentId, employeeId]
          );
          return new Response(
            JSON.stringify({ data: result.rows[0] || null }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const result = await client.queryObject<Dependent>(
            'SELECT * FROM employee_dependents WHERE employee_id = $1 ORDER BY name ASC',
            [employeeId]
          );
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
      const { id, employee_id, name, relationship, birth_date, cpf, is_ir_dependent } = body;

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

      if (!name || !relationship) {
        return new Response(
          JSON.stringify({ error: 'Nome e relacionamento são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        if (id || req.method === 'PUT') {
          const updateId = id || dependentId;
          if (!updateId) {
            return new Response(
              JSON.stringify({ error: 'ID do dependente é obrigatório para atualização' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const result = await client.queryObject<Dependent>(
            `UPDATE employee_dependents
             SET name = $1, relationship = $2, birth_date = $3, cpf = $4, is_ir_dependent = $5, updated_at = now()
             WHERE id = $6 AND employee_id = $7
             RETURNING *`,
            [name, relationship, birth_date || null, cpf || null, is_ir_dependent || false, updateId, empId]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Dependente não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const result = await client.queryObject<Dependent>(
            `INSERT INTO employee_dependents (employee_id, name, relationship, birth_date, cpf, is_ir_dependent)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [empId, name, relationship, birth_date || null, cpf || null, is_ir_dependent || false]
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
      if (!dependentId) {
        return new Response(
          JSON.stringify({ error: 'ID do dependente é obrigatório' }),
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
          JSON.stringify({ error: 'Sem permissão para deletar este dependente' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        const result = await client.queryObject(
          'DELETE FROM employee_dependents WHERE id = $1 AND employee_id = $2 RETURNING id',
          [dependentId, employeeId]
        );

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Dependente não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: { id: dependentId } }),
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


