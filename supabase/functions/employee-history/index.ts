import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface SalaryHistory {
  id: string;
  employee_id: string;
  salary: number;
  effective_date: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

interface PositionHistory {
  id: string;
  employee_id: string;
  position_id: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

// Função auxiliar para validar permissões
async function validatePermissions(
  supabase: any,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data: isAdmin } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin'
  });

  const { data: isPubdigital } = await supabase.rpc('is_pubdigital_user', {
    _user_id: userId
  });

  if (isAdmin || isPubdigital) {
    return true;
  }

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  return memberData?.role === 'owner' || memberData?.role === 'admin';
}

// Função auxiliar para conectar ao PostgreSQL
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
    tls: {
      enforce: false,
      caCertificates: [],
    },
    connection: {
      keepAlive: true,
    },
  });

  await client.connect();
  return client;
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

    const { data: orgMembers, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1);

    if (orgError) {
      console.error('Erro ao buscar organização:', orgError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar organização', details: orgError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orgMembers || orgMembers.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = orgMembers[0].organization_id;
    const client = await getPostgresClient();

    try {
      const url = new URL(req.url);
      const employeeId = url.searchParams.get('employee_id');
      const historyType = url.searchParams.get('type'); // 'salary' ou 'position'

      if (req.method === 'GET') {
        if (!employeeId) {
          return new Response(
            JSON.stringify({ error: 'employee_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se funcionário pertence à organização
        const { rows: empCheck } = await client.queryObject<{ id: string }>(
          'SELECT id FROM employees WHERE id = $1 AND organization_id = $2',
          [employeeId, organizationId]
        );

        if (empCheck.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Funcionário não encontrado ou não pertence à organização' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (historyType === 'salary' || !historyType) {
          // Buscar histórico de salários
          const salaryQuery = `
            SELECT 
              sh.*,
              p.name as position_name
            FROM employee_salary_history sh
            LEFT JOIN employees e ON sh.employee_id = e.id
            LEFT JOIN positions p ON e.current_position_id = p.id
            WHERE sh.employee_id = $1
            ORDER BY sh.effective_date DESC, sh.created_at DESC
          `;

          const salaryResult = await client.queryObject<SalaryHistory & { position_name?: string }>(
            salaryQuery,
            [employeeId]
          );

          if (historyType === 'salary') {
            return new Response(
              JSON.stringify({ data: salaryResult.rows }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (historyType === 'position' || !historyType) {
          // Buscar histórico de cargos
          const positionQuery = `
            SELECT 
              ph.*,
              p.name as position_name
            FROM employee_position_history ph
            JOIN positions p ON ph.position_id = p.id
            WHERE ph.employee_id = $1
            ORDER BY ph.start_date DESC, ph.created_at DESC
          `;

          const positionResult = await client.queryObject<PositionHistory & { position_name: string }>(
            positionQuery,
            [employeeId]
          );

          if (historyType === 'position') {
            return new Response(
              JSON.stringify({ data: positionResult.rows }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Se não especificou tipo, retornar ambos
          if (!historyType) {
            return new Response(
              JSON.stringify({
                salary_history: salaryResult.rows,
                position_history: positionResult.rows,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ error: 'Tipo de histórico inválido. Use "salary" ou "position"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'POST') {
        const canWrite = await validatePermissions(supabase, user.id, organizationId);
        if (!canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para registrar histórico' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { type, employee_id, ...data } = body;

        if (!type || !employee_id) {
          return new Response(
            JSON.stringify({ error: 'type e employee_id são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se funcionário pertence à organização
        const { rows: empCheck } = await client.queryObject<{ id: string }>(
          'SELECT id FROM employees WHERE id = $1 AND organization_id = $2',
          [employee_id, organizationId]
        );

        if (empCheck.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Funcionário não encontrado ou não pertence à organização' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (type === 'salary') {
          const { salary, effective_date, notes } = data;

          if (!salary || !effective_date) {
            return new Response(
              JSON.stringify({ error: 'salary e effective_date são obrigatórios' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (salary <= 0) {
            return new Response(
              JSON.stringify({ error: 'Salário deve ser maior que zero' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const insertQuery = `
            INSERT INTO employee_salary_history (employee_id, salary, effective_date, notes, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `;

          const result = await client.queryObject<SalaryHistory>(
            insertQuery,
            [employee_id, salary, effective_date, notes || null, user.id]
          );

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (type === 'position') {
          const { position_id, start_date, end_date, notes } = data;

          if (!position_id || !start_date) {
            return new Response(
              JSON.stringify({ error: 'position_id e start_date são obrigatórios' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verificar se cargo pertence à organização
          const { rows: posCheck } = await client.queryObject<{ id: string }>(
            'SELECT id FROM positions WHERE id = $1 AND organization_id = $2',
            [position_id, organizationId]
          );

          if (posCheck.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Cargo não encontrado ou não pertence à organização' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const insertQuery = `
            INSERT INTO employee_position_history (employee_id, position_id, start_date, end_date, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `;

          const result = await client.queryObject<PositionHistory>(
            insertQuery,
            [employee_id, position_id, start_date, end_date || null, notes || null, user.id]
          );

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ error: 'Tipo inválido. Use "salary" ou "position"' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error('❌ Erro no employee-history:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

