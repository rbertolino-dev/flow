import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função auxiliar para conectar ao PostgreSQL
async function getPostgresClient() {
  const postgresHost = Deno.env.get('POSTGRES_HOST') || '95.217.2.116';
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
    tls: { enforce: false, caCertificates: [] },
    connection: { keepAlive: true, connectTimeout: 10000 },
  });

  await client.connect();
  return client;
}

serve(async (req) => {
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

    // Buscar produtos do Supabase
    const { data: supabaseProducts, error: supabaseError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (supabaseError) {
      return new Response(
        JSON.stringify({ error: supabaseError.message, data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseProducts || supabaseProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum produto encontrado no Supabase',
          data: [],
          migrated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar organizações e usuários
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id, name');

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email');

    const orgMap = new Map((organizations || []).map((o: any) => [o.id, o.name]));
    const userMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email]));

    // Conectar ao PostgreSQL
    const pgClient = await getPostgresClient();

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const product of supabaseProducts) {
      try {
        // Verificar se já existe
        const checkResult = await pgClient.queryObject<{ count: number }>(
          'SELECT COUNT(*) as count FROM products WHERE id = $1',
          [product.id]
        );

        if (parseInt(checkResult.rows[0]?.count?.toString() || '0') > 0) {
          skipped++;
          continue;
        }

        const orgName = orgMap.get(product.organization_id) || 'Organização sem nome';
        const createdByName = product.created_by ? userMap.get(product.created_by) || null : null;
        const updatedByName = product.updated_by ? userMap.get(product.updated_by) || null : null;

        await pgClient.queryObject(
          `INSERT INTO products (
            id, organization_id, organization_name, name, description, sku, price, cost,
            category, is_active, stock_quantity, min_stock, unit, image_url,
            commission_percentage, commission_fixed,
            created_at, updated_at, created_by, created_by_name, updated_by, updated_by_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO NOTHING`,
          [
            product.id,
            product.organization_id,
            orgName,
            product.name,
            product.description || null,
            product.sku || null,
            product.price || 0,
            product.cost || null,
            product.category || 'Produto',
            product.is_active ?? true,
            product.stock_quantity || 0,
            product.min_stock || 0,
            product.unit || 'un',
            product.image_url || null,
            product.commission_percentage || null,
            product.commission_fixed || null,
            product.created_at || new Date().toISOString(),
            product.updated_at || new Date().toISOString(),
            product.created_by || null,
            createdByName,
            product.updated_by || null,
            updatedByName,
          ]
        );

        migrated++;
      } catch (error: any) {
        errors.push(`${product.name}: ${error.message}`);
      }
    }

    await pgClient.end();

    return new Response(
      JSON.stringify({
        message: 'Migração concluída',
        total: supabaseProducts.length,
        migrated,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});



