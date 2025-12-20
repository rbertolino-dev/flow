import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Team {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  manager_id?: string;
  created_at: string;
  updated_at: string;
}

interface EmployeeTeam {
  employee_id: string;
  team_id: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
  created_at: string;
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
      const action = url.searchParams.get('action');

      if (req.method === 'DELETE') {
        const canWrite = await validatePermissions(supabase, user.id, organizationId);
        if (!canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para excluir equipes' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const teamId = url.searchParams.get('id');
        if (!teamId) {
          return new Response(
            JSON.stringify({ error: 'ID da equipe é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se há membros ativos na equipe
        const checkMembersQuery = `
          SELECT COUNT(*)::int as count
          FROM employee_teams
          WHERE team_id = $1 AND is_active = true
        `;
        const checkResult = await client.queryObject<{ count: number }>(
          checkMembersQuery,
          [teamId]
        );

        if (checkResult.rows[0]?.count > 0) {
          return new Response(
            JSON.stringify({ error: 'Não é possível excluir equipe que possui membros ativos. Remova os membros primeiro.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Excluir equipe
        const deleteQuery = `
          DELETE FROM teams
          WHERE id = $1 AND organization_id = $2
          RETURNING id
        `;

        const result = await client.queryObject<{ id: string }>(deleteQuery, [teamId, organizationId]);

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Equipe não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: { id: teamId } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'GET') {
        if (action === 'members') {
          // Listar membros de uma equipe
          const teamId = url.searchParams.get('team_id');
          if (!teamId) {
            return new Response(
              JSON.stringify({ error: 'team_id é obrigatório' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const query = `
            SELECT 
              et.*,
              e.full_name,
              e.cpf,
              e.status as employee_status
            FROM employee_teams et
            JOIN employees e ON et.employee_id = e.id
            WHERE et.team_id = $1 AND e.organization_id = $2
            ORDER BY et.joined_at DESC
          `;

          const result = await client.queryObject<EmployeeTeam & { full_name: string; cpf: string; employee_status: string }>(
            query,
            [teamId, organizationId]
          );

          return new Response(
            JSON.stringify({ data: result.rows }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Listar equipes
          const query = `
            SELECT 
              t.*,
              e.full_name as manager_name
            FROM teams t
            LEFT JOIN employees e ON t.manager_id = e.id
            WHERE t.organization_id = $1
            ORDER BY t.name ASC
          `;

          const result = await client.queryObject<Team & { manager_name?: string }>(query, [organizationId]);

          return new Response(
            JSON.stringify({ data: result.rows }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (req.method === 'DELETE') {
        const canWrite = await validatePermissions(supabase, user.id, organizationId);
        if (!canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para excluir equipes' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const teamId = url.searchParams.get('id');
        if (!teamId) {
          return new Response(
            JSON.stringify({ error: 'ID da equipe é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se há membros ativos na equipe
        const checkMembersQuery = `
          SELECT COUNT(*)::int as count
          FROM employee_teams
          WHERE team_id = $1 AND is_active = true
        `;
        const checkResult = await client.queryObject<{ count: number }>(
          checkMembersQuery,
          [teamId]
        );

        if (checkResult.rows[0]?.count > 0) {
          return new Response(
            JSON.stringify({ error: 'Não é possível excluir equipe que possui membros ativos. Remova os membros primeiro.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Excluir equipe
        const deleteQuery = `
          DELETE FROM teams
          WHERE id = $1 AND organization_id = $2
          RETURNING id
        `;

        const result = await client.queryObject<{ id: string }>(deleteQuery, [teamId, organizationId]);

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Equipe não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: { id: teamId } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'POST') {
        const canWrite = await validatePermissions(supabase, user.id, organizationId);
        if (!canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para gerenciar equipes' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const action = url.searchParams.get('action');
        
        if (action === 'add-member') {
          // Adicionar funcionário à equipe
          const body = await req.json();
          const { team_id, employee_id, joined_at } = body;

          if (!team_id || !employee_id) {
            return new Response(
              JSON.stringify({ error: 'team_id e employee_id são obrigatórios' }),
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

          // Verificar se equipe pertence à organização
          const { rows: teamCheck } = await client.queryObject<{ id: string }>(
            'SELECT id FROM teams WHERE id = $1 AND organization_id = $2',
            [team_id, organizationId]
          );

          if (teamCheck.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Equipe não encontrada ou não pertence à organização' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Inserir ou atualizar relacionamento
          const insertQuery = `
            INSERT INTO employee_teams (employee_id, team_id, joined_at, is_active)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (employee_id, team_id) 
            DO UPDATE SET 
              joined_at = $3,
              left_at = NULL,
              is_active = true
            RETURNING *
          `;

          const result = await client.queryObject<EmployeeTeam>(
            insertQuery,
            [employee_id, team_id, joined_at || new Date().toISOString().split('T')[0]]
          );

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (action === 'remove-member') {
          // Remover funcionário da equipe
          const body = await req.json();
          const { team_id, employee_id, left_at } = body;

          if (!team_id || !employee_id) {
            return new Response(
              JSON.stringify({ error: 'team_id e employee_id são obrigatórios' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const updateQuery = `
            UPDATE employee_teams
            SET left_at = $1, is_active = false
            WHERE employee_id = $2 AND team_id = $3
            RETURNING *
          `;

          const result = await client.queryObject<EmployeeTeam>(
            updateQuery,
            [left_at || new Date().toISOString().split('T')[0], employee_id, team_id]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Relacionamento não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Criar ou atualizar equipe
          const body = await req.json();
          const { id, name, description, manager_id } = body;

          if (!name) {
            return new Response(
              JSON.stringify({ error: 'Nome da equipe é obrigatório' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (id) {
            // Atualizar equipe existente
            const updateQuery = `
              UPDATE teams
              SET 
                name = $1,
                description = $2,
                manager_id = $3,
                updated_at = now()
              WHERE id = $4 AND organization_id = $5
              RETURNING *
            `;

            const result = await client.queryObject<Team>(
              updateQuery,
              [name, description || null, manager_id || null, id, organizationId]
            );

            if (result.rows.length === 0) {
              return new Response(
                JSON.stringify({ error: 'Equipe não encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            return new Response(
              JSON.stringify({ data: result.rows[0] }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            // Criar nova equipe
            const insertQuery = `
              INSERT INTO teams (organization_id, name, description, manager_id)
              VALUES ($1, $2, $3, $4)
              RETURNING *
            `;

            const result = await client.queryObject<Team>(
              insertQuery,
              [organizationId, name, description || null, manager_id || null]
            );

            return new Response(
              JSON.stringify({ data: result.rows[0] }),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
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
    console.error('❌ Erro no teams:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

