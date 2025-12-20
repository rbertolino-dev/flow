import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Position {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  base_salary: number;
  is_active: boolean;
  hierarchical_level?: string;
  department?: string;
  requirements?: string;
  salary_min?: number;
  salary_max?: number;
  created_at: string;
  updated_at: string;
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

  console.log('🔍 Configuração PostgreSQL:', {
    host: postgresHost,
    port: postgresPort,
    db: postgresDb,
    user: postgresUser,
    hasPassword: !!postgresPassword,
  });

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

  try {
    console.log('🔌 Tentando conectar ao PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso');
    return client;
  } catch (error: any) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error);
    throw new Error(`Erro ao conectar ao banco de dados: ${error.message || error}`);
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
    
    // Conectar ao PostgreSQL
    let client;
    try {
      client = await getPostgresClient();
    } catch (pgError: any) {
      console.error('❌ Erro ao conectar ao PostgreSQL:', pgError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao conectar ao banco de dados',
          details: pgError.message || 'Verifique as configurações de conexão',
          data: []
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const url = new URL(req.url);
      
      if (req.method === 'GET') {
        const activeOnly = url.searchParams.get('active_only') !== 'false';

        let query = `
          SELECT * FROM positions
          WHERE organization_id = $1
        `;
        const params: any[] = [organizationId];

        if (activeOnly) {
          query += ' AND is_active = true';
        }

        query += ' ORDER BY name ASC';

        const result = await client.queryObject<Position>(query, params);

        return new Response(
          JSON.stringify({ data: result.rows }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'DELETE') {
        const canWrite = await validatePermissions(supabase, user.id, organizationId);
        if (!canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para excluir cargos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const positionId = url.searchParams.get('id');
        if (!positionId) {
          return new Response(
            JSON.stringify({ error: 'ID do cargo é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se há funcionários usando este cargo
        const checkEmployeesQuery = `
          SELECT COUNT(*)::int as count
          FROM employees
          WHERE current_position_id = $1 AND organization_id = $2
        `;
        const checkResult = await client.queryObject<{ count: number }>(
          checkEmployeesQuery,
          [positionId, organizationId]
        );

        if (checkResult.rows[0]?.count > 0) {
          return new Response(
            JSON.stringify({ error: 'Não é possível excluir cargo que está sendo usado por funcionários' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Soft delete: marcar como inativo
        const deleteQuery = `
          UPDATE positions
          SET is_active = false, updated_at = now()
          WHERE id = $1 AND organization_id = $2
          RETURNING *
        `;

        const result = await client.queryObject<Position>(deleteQuery, [positionId, organizationId]);

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Cargo não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'POST') {
        const canWrite = await validatePermissions(supabase, user.id, organizationId);
        if (!canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para gerenciar cargos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { 
          id, 
          name, 
          description, 
          base_salary, 
          is_active,
          hierarchical_level,
          department,
          requirements,
          salary_min,
          salary_max
        } = body;

        if (!name) {
          return new Response(
            JSON.stringify({ error: 'Nome do cargo é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (id) {
          // Atualizar cargo existente
          const updateQuery = `
            UPDATE positions
            SET 
              name = $1,
              description = $2,
              base_salary = $3,
              is_active = $4,
              hierarchical_level = $5,
              department = $6,
              requirements = $7,
              salary_min = $8,
              salary_max = $9,
              updated_at = now()
            WHERE id = $10 AND organization_id = $11
            RETURNING *
          `;

          const result = await client.queryObject<Position>(
            updateQuery,
            [
              name, 
              description || null, 
              base_salary || 0, 
              is_active !== false,
              hierarchical_level || null,
              department || null,
              requirements || null,
              salary_min || null,
              salary_max || null,
              id, 
              organizationId
            ]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Cargo não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Criar novo cargo
          const insertQuery = `
            INSERT INTO positions (
              organization_id, name, description, base_salary, is_active,
              hierarchical_level, department, requirements, salary_min, salary_max
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `;

          const result = await client.queryObject<Position>(
            insertQuery,
            [
              organizationId, 
              name, 
              description || null, 
              base_salary || 0, 
              is_active !== false,
              hierarchical_level || null,
              department || null,
              requirements || null,
              salary_min || null,
              salary_max || null
            ]
          );

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error('❌ Erro no positions (dentro do try):', error);
      return new Response(
        JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido',
          data: []
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (endError) {
          console.error('Erro ao fechar conexão:', endError);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Erro no positions (fora do try):', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
        data: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

