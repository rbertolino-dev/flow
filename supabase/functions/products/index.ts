import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Product {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  price: number;
  cost?: number | null;
  category?: string | null;
  is_active: boolean;
  stock_quantity?: number | null;
  min_stock?: number | null;
  unit?: string | null;
  image_url?: string | null;
  commission_percentage?: number | null;
  commission_fixed?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
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

  // Verificar se é membro da organização
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  const isOrgAdmin = memberData?.role === 'owner' || memberData?.role === 'admin';

  return {
    canRead: !!memberData, // Qualquer membro pode ler
    canWrite: !!memberData, // Qualquer membro pode escrever (produtos)
  };
}

// Função auxiliar para validar que organization_id existe
async function validateOrganizationExists(
  supabase: any,
  organizationId: string
): Promise<{ exists: boolean; name?: string }> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .maybeSingle();

  if (error || !org) {
    return { exists: false };
  }

  return { exists: true, name: org.name };
}

// Função auxiliar para buscar nome do usuário
async function getUserName(
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return profile.full_name || null;
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

  try {
    await client.connect();
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

    // Obter organization_id do usuário (da primeira organização)
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
          data: []
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

    // Validar que organização existe e buscar nome
    const orgValidation = await validateOrganizationExists(supabase, organizationId);
    if (!orgValidation.exists) {
      return new Response(
        JSON.stringify({ error: 'Organização não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationName = orgValidation.name || 'Organização sem nome';

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

    const url = new URL(req.url);
    const productId = url.pathname.split('/').pop();
    const search = url.searchParams.get('search');
    const category = url.searchParams.get('category');
    const isActive = url.searchParams.get('is_active');

    try {
      if (req.method === 'GET') {
        if (productId && productId !== 'products') {
          // Buscar produto específico
          const query = `
            SELECT * FROM products
            WHERE id = $1 AND organization_id = $2
          `;
          const result = await client.queryObject<Product>(
            query,
            [productId, organizationId]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Produto não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const product = result.rows[0];
          
          // Double-check: garantir que produto pertence à organização
          if (product.organization_id !== organizationId) {
            return new Response(
              JSON.stringify({ error: 'Produto não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: product }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Listar produtos com filtros
          let query = `
            SELECT * FROM products
            WHERE organization_id = $1
          `;
          const params: any[] = [organizationId];
          let paramCount = 1;

          if (search) {
            paramCount++;
            query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount} OR sku ILIKE $${paramCount})`;
            params.push(`%${search}%`);
          }

          if (category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            params.push(category);
          }

          if (isActive !== null && isActive !== undefined) {
            paramCount++;
            query += ` AND is_active = $${paramCount}`;
            params.push(isActive === 'true');
          }

          query += ` ORDER BY category ASC, name ASC`;

          const result = await client.queryObject<Product>(query, params);

          // Double-check: garantir que todos os produtos pertencem à organização
          const filteredProducts = result.rows.filter(p => p.organization_id === organizationId);

          return new Response(
            JSON.stringify({ data: filteredProducts }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (req.method === 'POST') {
        if (!permissions.canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para criar produtos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const {
          name,
          description,
          sku,
          price,
          cost,
          category,
          is_active,
          stock_quantity,
          min_stock,
          unit,
          image_url,
          commission_percentage,
          commission_fixed,
        } = body;

        // Validações obrigatórias
        if (!name || !price) {
          return new Response(
            JSON.stringify({ error: 'Nome e preço são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validar que organization_id do body (se fornecido) é o mesmo do usuário
        if (body.organization_id && body.organization_id !== organizationId) {
          return new Response(
            JSON.stringify({ error: 'Não é possível criar produto para outra organização' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Buscar nome do usuário para rastreamento
        const userName = await getUserName(supabase, user.id);

        // Verificar se SKU já existe para esta organização
        if (sku) {
          const checkSku = await client.queryObject<{ id: string }>(
            'SELECT id FROM products WHERE organization_id = $1 AND sku = $2',
            [organizationId, sku]
          );

          if (checkSku.rows.length > 0) {
            return new Response(
              JSON.stringify({ error: 'SKU já existe para esta organização' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Inserir produto
        const insertQuery = `
          INSERT INTO products (
            organization_id,
            organization_name,
            name,
            description,
            sku,
            price,
            cost,
            category,
            is_active,
            stock_quantity,
            min_stock,
            unit,
            image_url,
            commission_percentage,
            commission_fixed,
            created_by,
            created_by_name
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          ) RETURNING *
        `;

        const insertParams = [
          organizationId,
          organizationName,
          name,
          description || null,
          sku || null,
          price,
          cost || null,
          category || null,
          is_active !== undefined ? is_active : true,
          stock_quantity || null,
          min_stock || null,
          unit || 'un',
          image_url || null,
          commission_percentage || null,
          commission_fixed || null,
          user.id,
          userName,
        ];

        const result = await client.queryObject<Product>(insertQuery, insertParams);

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'PUT') {
        if (!permissions.canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para atualizar produtos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!productId || productId === 'products') {
          return new Response(
            JSON.stringify({ error: 'ID do produto é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar que produto existe e pertence à organização
        const checkProduct = await client.queryObject<{ organization_id: string }>(
          'SELECT organization_id FROM products WHERE id = $1',
          [productId]
        );

        if (checkProduct.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Produto não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (checkProduct.rows[0].organization_id !== organizationId) {
          return new Response(
            JSON.stringify({ error: 'Produto não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();

        // NUNCA permitir alterar organization_id
        if (body.organization_id && body.organization_id !== organizationId) {
          return new Response(
            JSON.stringify({ error: 'Não é possível alterar a organização do produto' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Buscar nome do usuário para rastreamento
        const userName = await getUserName(supabase, user.id);

        // Verificar se SKU já existe para outra organização (se alterado)
        if (body.sku) {
          const checkSku = await client.queryObject<{ id: string }>(
            'SELECT id FROM products WHERE organization_id = $1 AND sku = $2 AND id != $3',
            [organizationId, body.sku, productId]
          );

          if (checkSku.rows.length > 0) {
            return new Response(
              JSON.stringify({ error: 'SKU já existe para esta organização' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Atualizar produto
        const updateFields: string[] = [];
        const updateParams: any[] = [];
        let paramCount = 0;

        const allowedFields = [
          'name', 'description', 'sku', 'price', 'cost', 'category',
          'is_active', 'stock_quantity', 'min_stock', 'unit', 'image_url',
          'commission_percentage', 'commission_fixed'
        ];

        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            paramCount++;
            updateFields.push(`${field} = $${paramCount}`);
            updateParams.push(body[field]);
          }
        }

        // Sempre atualizar updated_by e updated_by_name
        paramCount++;
        updateFields.push(`updated_by = $${paramCount}`);
        updateParams.push(user.id);
        paramCount++;
        updateFields.push(`updated_by_name = $${paramCount}`);
        updateParams.push(userName);

        if (updateFields.length === 2) {
          return new Response(
            JSON.stringify({ error: 'Nenhum campo para atualizar' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        paramCount++;
        updateParams.push(productId);
        paramCount++;
        updateParams.push(organizationId);

        const updateQuery = `
          UPDATE products
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount - 1} AND organization_id = $${paramCount}
          RETURNING *
        `;

        const result = await client.queryObject<Product>(updateQuery, updateParams);

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'DELETE') {
        if (!permissions.canWrite) {
          return new Response(
            JSON.stringify({ error: 'Sem permissão para deletar produtos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!productId || productId === 'products') {
          return new Response(
            JSON.stringify({ error: 'ID do produto é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar que produto existe e pertence à organização
        const checkProduct = await client.queryObject<{ organization_id: string }>(
          'SELECT organization_id FROM products WHERE id = $1',
          [productId]
        );

        if (checkProduct.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Produto não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (checkProduct.rows[0].organization_id !== organizationId) {
          return new Response(
            JSON.stringify({ error: 'Produto não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Deletar produto
        const deleteQuery = `
          DELETE FROM products
          WHERE id = $1 AND organization_id = $2
          RETURNING id
        `;

        const result = await client.queryObject<{ id: string }>(deleteQuery, [productId, organizationId]);

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Erro ao deletar produto' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ message: 'Produto deletado com sucesso' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

