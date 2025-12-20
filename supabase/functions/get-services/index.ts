import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

interface Service {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
      console.error('❌ Erro ao buscar organização:', orgError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar organização', data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orgMembers || orgMembers.length === 0) {
      console.log('⚠️ Usuário não pertence a nenhuma organização');
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = orgMembers[0].organization_id;

    // Conectar ao PostgreSQL
    const postgresHost = Deno.env.get('POSTGRES_HOST') || 'localhost';
    const postgresPort = parseInt(Deno.env.get('POSTGRES_PORT') || '5432');
    const postgresDb = Deno.env.get('POSTGRES_DB') || 'budget_services';
    const postgresUser = Deno.env.get('POSTGRES_USER') || 'budget_user';
    const postgresPassword = Deno.env.get('POSTGRES_PASSWORD');

    if (!postgresPassword) {
      console.error('❌ POSTGRES_PASSWORD não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração do PostgreSQL não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente PostgreSQL
    const client = new Client({
      hostname: postgresHost,
      port: postgresPort,
      database: postgresDb,
      user: postgresUser,
      password: postgresPassword,
    });

    await client.connect();

    // Verificar método HTTP
    const url = new URL(req.url);
    const serviceId = url.searchParams.get('id');
    const category = url.searchParams.get('category');
    const activeOnly = url.searchParams.get('active_only') !== 'false';

    if (req.method === 'GET') {
      let query = `
        SELECT 
          id,
          organization_id,
          name,
          description,
          price,
          category,
          is_active,
          created_at,
          updated_at
        FROM services
        WHERE organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (serviceId) {
        // Buscar serviço específico
        query += ' AND id = $2';
        params.push(serviceId);
      } else {
        // Filtrar por categoria se fornecido
        if (category) {
          query += ' AND category = $2';
          params.push(category);
        }

        // Filtrar apenas ativos se solicitado
        if (activeOnly) {
          query += ` AND is_active = true`;
        }
      }

      query += ' ORDER BY name ASC';

      const result = await client.queryObject<Service>(query, params);
      await client.end();

      return new Response(
        JSON.stringify({ data: result.rows }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE para excluir serviço
    if (req.method === 'DELETE') {
      const serviceId = url.searchParams.get('id');
      
      if (!serviceId) {
        return new Response(
          JSON.stringify({ error: 'ID do serviço é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se serviço existe e pertence à organização
      const checkQuery = `
        SELECT id FROM services
        WHERE id = $1 AND organization_id = $2
      `;
      const checkResult = await client.queryObject(checkQuery, [serviceId, organizationId]);
      
      if (checkResult.rows.length === 0) {
        await client.end();
        return new Response(
          JSON.stringify({ error: 'Serviço não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Excluir serviço
      const deleteQuery = `
        DELETE FROM services
        WHERE id = $1 AND organization_id = $2
        RETURNING id
      `;
      const result = await client.queryObject(deleteQuery, [serviceId, organizationId]);
      await client.end();

      return new Response(
        JSON.stringify({ data: { id: result.rows[0].id, deleted: true } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST para criar/atualizar serviço
    if (req.method === 'POST') {
      const body = await req.json();
      const { id, name, description, price, category, is_active } = body;

      if (!name || price === undefined) {
        return new Response(
          JSON.stringify({ error: 'Nome e preço são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (id) {
        // Atualizar serviço existente
        const updateQuery = `
          UPDATE services
          SET 
            name = $1,
            description = $2,
            price = $3,
            category = $4,
            is_active = $5,
            updated_at = now()
          WHERE id = $6 AND organization_id = $7
          RETURNING *
        `;
        const result = await client.queryObject<Service>(
          updateQuery,
          [name, description || null, price, category || null, is_active !== false, id, organizationId]
        );
        await client.end();

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Serviço não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Criar novo serviço
        const insertQuery = `
          INSERT INTO services (organization_id, name, description, price, category, is_active)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        const result = await client.queryObject<Service>(
          insertQuery,
          [organizationId, name, description || null, price, category || null, is_active !== false]
        );
        await client.end();

        return new Response(
          JSON.stringify({ data: result.rows[0] }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    await client.end();

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no get-services:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


