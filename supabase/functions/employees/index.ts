import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Employee {
  id: string;
  organization_id: string;
  user_id?: string;
  full_name: string;
  cpf: string;
  rg?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  admission_date: string;
  dismissal_date?: string;
  status: string;
  current_position_id?: string;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  account_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  ctps?: string;
  pis?: string;
  created_at: string;
  updated_at: string;
}

// Função auxiliar para validar permissões
async function validatePermissions(
  supabase: any,
  userId: string,
  organizationId: string
): Promise<{ canRead: boolean; canWrite: boolean }> {
  // Verificar se é super admin
  const { data: isAdmin } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin'
  });

  const { data: isPubdigital } = await supabase.rpc('is_pubdigital_user', {
    _user_id: userId
  });

  if (isAdmin || isPubdigital) {
    return { canRead: true, canWrite: true };
  }

  // Verificar se é owner/admin da organização
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  const isOrgAdmin = memberData?.role === 'owner' || memberData?.role === 'admin';

  return {
    canRead: !!memberData, // Qualquer membro pode ler
    canWrite: isOrgAdmin, // Apenas owners/admins podem escrever
  };
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase para validar token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter organization_id do usuário
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
        JSON.stringify({ 
          error: 'Usuário não pertence a nenhuma organização',
          data: [],
          pagination: { page: 1, limit: 35, total: 0, totalPages: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = orgMembers[0].organization_id;

    // Validar permissões
    const permissions = await validatePermissions(supabase, user.id, organizationId);
    if (!permissions.canRead) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para acessar esta organização' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          data: [],
          pagination: { page: 1, limit: 35, total: 0, totalPages: 0 }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const employeeId = url.searchParams.get('id');
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const positionId = url.searchParams.get('position_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '35');
    const offset = (page - 1) * limit;

    try {
      if (req.method === 'GET') {
        if (employeeId) {
          // Buscar funcionário específico
          const query = `
            SELECT 
              e.*,
              p.name as position_name
            FROM employees e
            LEFT JOIN positions p ON e.current_position_id = p.id
            WHERE e.id = $1 AND e.organization_id = $2
          `;
          const result = await client.queryObject<Employee & { position_name?: string }>(
            query,
            [employeeId, organizationId]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Funcionário não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Listar funcionários com filtros
          let query = `
            SELECT 
              e.*,
              p.name as position_name
            FROM employees e
            LEFT JOIN positions p ON e.current_position_id = p.id
            WHERE e.organization_id = $1
          `;
          const params: any[] = [organizationId];
          let paramCount = 1;

          if (search) {
            paramCount++;
            query += ` AND (e.full_name ILIKE $${paramCount} OR e.cpf ILIKE $${paramCount} OR e.email ILIKE $${paramCount})`;
            params.push(`%${search}%`);
          }

          if (status) {
            paramCount++;
            query += ` AND e.status = $${paramCount}`;
            params.push(status);
          }

          if (positionId) {
            paramCount++;
            query += ` AND e.current_position_id = $${paramCount}`;
            params.push(positionId);
          }

          // Contar total - construir query de contagem separadamente
          let countQuery = `
            SELECT COUNT(*) as total
            FROM employees e
            WHERE e.organization_id = $1
          `;
          const countParams: any[] = [organizationId];
          let countParamCount = 1;

          if (search) {
            countParamCount++;
            countQuery += ` AND (e.full_name ILIKE $${countParamCount} OR e.cpf ILIKE $${countParamCount} OR e.email ILIKE $${countParamCount})`;
            countParams.push(`%${search}%`);
          }

          if (status) {
            countParamCount++;
            countQuery += ` AND e.status = $${countParamCount}`;
            countParams.push(status);
          }

          if (positionId) {
            countParamCount++;
            countQuery += ` AND e.current_position_id = $${countParamCount}`;
            countParams.push(positionId);
          }

          const countResult = await client.queryObject<{ total: number }>(countQuery, countParams);
          const total = parseInt(countResult.rows[0]?.total?.toString() || '0');

          // Adicionar paginação
          query += ` ORDER BY e.full_name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
          params.push(limit, offset);

          const result = await client.queryObject<Employee & { position_name?: string }>(query, params);

          return new Response(
            JSON.stringify({
              data: result.rows,
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (req.method === 'POST') {
        if (!permissions.canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para criar funcionários' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const {
          full_name,
          cpf,
          rg,
          birth_date,
          phone,
          email,
          address,
          city,
          state,
          zip_code,
          admission_date,
          dismissal_date,
          status: empStatus,
          current_position_id,
          bank_name,
          bank_agency,
          bank_account,
          account_type,
          emergency_contact_name,
          emergency_contact_phone,
          ctps,
          pis,
          user_id,
        } = body;

        if (!full_name || !cpf || !admission_date) {
          return new Response(
            JSON.stringify({ error: 'Nome, CPF e data de admissão são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const insertQuery = `
          INSERT INTO employees (
            organization_id, user_id, full_name, cpf, rg, birth_date, phone, email,
            address, city, state, zip_code, admission_date, dismissal_date, status,
            current_position_id, bank_name, bank_agency, bank_account, account_type,
            emergency_contact_name, emergency_contact_phone, ctps, pis
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          RETURNING *
        `;

        const result = await client.queryObject<Employee>(
          insertQuery,
          [
            organizationId,
            user_id || null,
            full_name,
            cpf,
            rg || null,
            birth_date || null,
            phone || null,
            email || null,
            address || null,
            city || null,
            state || null,
            zip_code || null,
            admission_date,
            dismissal_date || null,
            empStatus || 'ativo',
            current_position_id || null,
            bank_name || null,
            bank_agency || null,
            bank_account || null,
            account_type || null,
            emergency_contact_name || null,
            emergency_contact_phone || null,
            ctps || null,
            pis || null,
          ]
        );

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'PUT') {
        if (!permissions.canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para editar funcionários' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { id, ...updateData } = body;

        if (!id) {
          return new Response(
            JSON.stringify({ error: 'ID do funcionário é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateFields: string[] = [];
        const params: any[] = [];
        let paramCount = 1;

        const allowedFields = [
          'full_name', 'cpf', 'rg', 'birth_date', 'phone', 'email',
          'address', 'city', 'state', 'zip_code', 'admission_date',
          'dismissal_date', 'status', 'current_position_id',
          'bank_name', 'bank_agency', 'bank_account', 'account_type',
          'emergency_contact_name', 'emergency_contact_phone', 'ctps', 'pis', 'user_id'
        ];

        for (const [key, value] of Object.entries(updateData)) {
          if (allowedFields.includes(key)) {
            updateFields.push(`${key} = $${paramCount}`);
            params.push(value);
            paramCount++;
          }
        }

        if (updateFields.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Nenhum campo válido para atualizar' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        params.push(id, organizationId);
        const updateQuery = `
          UPDATE employees
          SET ${updateFields.join(', ')}, updated_at = now()
          WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
          RETURNING *
        `;

        const result = await client.queryObject<Employee>(updateQuery, params);

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Funcionário não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'DELETE') {
        if (!permissions.canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para inativar funcionários' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const employeeId = url.searchParams.get('id');
        if (!employeeId) {
          return new Response(
            JSON.stringify({ error: 'ID do funcionário é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Soft delete: atualizar status para inativo
        const updateQuery = `
          UPDATE employees
          SET status = 'inativo', updated_at = now()
          WHERE id = $1 AND organization_id = $2
          RETURNING *
        `;

        const result = await client.queryObject<Employee>(updateQuery, [employeeId, organizationId]);

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Funcionário não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error('❌ Erro no employees (dentro do try):', error);
      return new Response(
        JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido',
          data: [],
          pagination: { page: 1, limit: 35, total: 0, totalPages: 0 }
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
    console.error('❌ Erro no employees (fora do try):', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
        data: [],
        pagination: { page: 1, limit: 35, total: 0, totalPages: 0 }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

