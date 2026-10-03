import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-organization-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

interface Product {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ncm?: string | null;
  fiscal_origin?: string | null;
  cest?: string | null;
  tax_class_ref?: string | null;
  price: number;
  wholesale_price?: number | null;
  cost?: number | null;
  category?: string | null;
  is_active: boolean;
  stock_quantity?: number | null;
  min_stock?: number | null;
  ideal_stock?: number | null;
  brand?: string | null;
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

  // Se host for 'localhost', tentar usar IP do servidor Hetzner
  // (Edge Functions do Supabase não conseguem acessar localhost do servidor)
  let finalHost = postgresHost;
  if (postgresHost === 'localhost' || postgresHost === '127.0.0.1') {
    // Tentar usar IP do servidor Hetzner (se configurado)
    const serverIp = Deno.env.get('POSTGRES_SERVER_IP') || '95.217.2.116';
    finalHost = serverIp;
    console.log(`⚠️  Host 'localhost' detectado. Usando IP do servidor: ${finalHost}`);
  }

  const client = new Client({
    hostname: finalHost,
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
      connectTimeout: 10000, // 10 segundos
    },
  });

  try {
    console.log('🔌 Tentando conectar ao PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso');
    return client;
  } catch (error: any) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error);
    console.error('   Host tentado:', finalHost);
    console.error('   Porta:', postgresPort);
    console.error('   Database:', postgresDb);
    console.error('   User:', postgresUser);
    throw new Error(`Erro ao conectar ao banco de dados: ${error.message || error}`);
  }
}

async function ensureStockSchema(client: any) {
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ideal_stock NUMERIC(12,3)`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT`);
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (organization_id, name)
    )
  `);
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS product_brands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (organization_id, name)
    )
  `);
  await client.queryArray(`ALTER TABLE pos_stock_movements DROP CONSTRAINT IF EXISTS pos_stock_movements_movement_type_check`);
  await client.queryArray(`
    ALTER TABLE pos_stock_movements
    ADD CONSTRAINT pos_stock_movements_movement_type_check
    CHECK (movement_type IN ('sale', 'sale_cancel', 'adjustment', 'in', 'out', 'adjust', 'return'))
  `);
  await client.queryArray(`ALTER TABLE pos_stock_movements ADD COLUMN IF NOT EXISTS source TEXT`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_supply BOOLEAN NOT NULL DEFAULT false`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2)`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm TEXT`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS fiscal_origin TEXT`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cest TEXT`);
  await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_class_ref TEXT`);
  await client.queryArray(`ALTER TABLE pos_stock_movements ADD COLUMN IF NOT EXISTS budget_id UUID`);
  await client.queryArray(`ALTER TABLE pos_stock_movements ADD COLUMN IF NOT EXISTS service_order_id UUID`);
  await client.queryArray(`ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS client_request_id TEXT`);
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS budget_stock_posts (
      organization_id UUID NOT NULL,
      budget_id UUID NOT NULL,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, budget_id)
    )
  `);
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS product_change_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      product_id UUID,
      user_id UUID,
      action TEXT NOT NULL,
      before JSONB,
      after JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.queryArray(`
    CREATE INDEX IF NOT EXISTS idx_product_change_log_org
    ON product_change_log (organization_id, created_at DESC)
  `);
  await client.queryArray(`
    CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_budget
    ON pos_stock_movements (organization_id, budget_id)
    WHERE budget_id IS NOT NULL
  `);
  await client.queryArray(`
    CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_service_order
    ON pos_stock_movements (organization_id, service_order_id)
    WHERE service_order_id IS NOT NULL
  `);
}

const CATALOG_FIELDS = [
  'name', 'description', 'sku', 'barcode', 'price', 'wholesale_price', 'cost', 'category',
  'brand', 'unit', 'min_stock', 'ideal_stock', 'is_active', 'is_supply',
];

function catalogSnapshot(row: Record<string, unknown> | null) {
  if (!row) return null;
  const snapshot: Record<string, unknown> = {};
  for (const field of CATALOG_FIELDS) snapshot[field] = row[field] ?? null;
  return snapshot;
}

function inferMovementSource(kind: string, notes: string | null, explicit?: string | null) {
  if (explicit) return explicit;
  const text = (notes || '').toLowerCase();
  if (text.includes('nf ') || text.startsWith('nf')) return 'xml';
  if (text.includes('compra')) return 'purchase';
  if (kind === 'adjust') return 'adjustment';
  return 'manual';
}

async function writeProductAudit(
  client: any,
  params: {
    organizationId: string;
    productId: string | null;
    userId: string;
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }
) {
  await client.queryArray(
    `INSERT INTO product_change_log (organization_id, product_id, user_id, action, before, after)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      params.organizationId,
      params.productId,
      params.userId,
      params.action,
      params.before ? JSON.stringify(catalogSnapshot(params.before)) : null,
      params.after ? JSON.stringify(catalogSnapshot(params.after)) : null,
    ]
  );
}

async function applyStockChange(
  client: any,
  params: {
    organizationId: string;
    productId: string;
    kind: 'in' | 'out' | 'adjust';
    quantity: number;
    notes: string | null;
    userId: string;
    source?: string | null;
    budgetId?: string | null;
  }
) {
  const { organizationId, productId, kind, quantity, notes, userId } = params;
  const source = inferMovementSource(kind, notes, params.source);
  await client.queryArray('BEGIN');
  try {
    const stockRow = await client.queryObject<{ stock_quantity: number | null; name: string }>(
      `SELECT stock_quantity, name FROM products WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [productId, organizationId]
    );
    if (!stockRow.rows.length) {
      await client.queryArray('ROLLBACK');
      return { error: 'Produto não encontrado', status: 404 };
    }
    const before = Number(stockRow.rows[0].stock_quantity ?? 0);
    let after = before;
    let delta = 0;
    if (kind === 'in') {
      delta = quantity;
      after = before + quantity;
    } else if (kind === 'out') {
      delta = -quantity;
      after = before - quantity;
    } else {
      after = quantity;
      delta = quantity - before;
    }
    if (delta === 0) {
      await client.queryArray('COMMIT');
      return { data: { product_id: productId, product_name: stockRow.rows[0].name, stock_before: before, stock_after: after, quantity_delta: 0, unchanged: true } };
    }
    await client.queryArray(
      `UPDATE products SET stock_quantity = $1, updated_at = now() WHERE id = $2 AND organization_id = $3`,
      [after, productId, organizationId]
    );
    await client.queryArray(
      `INSERT INTO pos_stock_movements (
         organization_id, product_id, movement_type, source, budget_id, quantity_delta,
         stock_before, stock_after, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [organizationId, productId, kind, source, params.budgetId || null, delta, before, after, notes, userId]
    );
    await client.queryArray('COMMIT');
    return { data: { product_id: productId, product_name: stockRow.rows[0].name, stock_before: before, stock_after: after, quantity_delta: delta } };
  } catch (error) {
    try { await client.queryArray('ROLLBACK'); } catch (_rollbackError) { /* já revertido */ }
    throw error;
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

    // Obter organization_id: priorizar header X-Organization-Id (organização ativa do frontend)
    // Se não fornecido, usar primeira organização do usuário (fallback)
    const requestedOrgId = req.headers.get('X-Organization-Id');
    let organizationId: string | null = null;

    const { data: orgMembers, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

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

    const userOrgIds = orgMembers.map((m: { organization_id: string }) => m.organization_id);

    if (requestedOrgId && !userOrgIds.includes(requestedOrgId)) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para acessar esta organização' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!requestedOrgId && userOrgIds.length > 1) {
      return new Response(
        JSON.stringify({ error: 'Informe a organização ativa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    organizationId = requestedOrgId && userOrgIds.includes(requestedOrgId)
      ? requestedOrgId
      : userOrgIds[0];

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
    const pathParts = url.pathname.split('/').filter(p => p);
    const productId = pathParts[pathParts.length - 1];
    const isBulkEndpoint = pathParts[pathParts.length - 1] === 'bulk';
    const lastPart = pathParts[pathParts.length - 1];
    const isMovementsEndpoint = lastPart === 'movements';
    const isCategoriesEndpoint = lastPart === 'categories';
    const isBrandsEndpoint = lastPart === 'brands';
    const isBudgetStockEndpoint = lastPart === 'budget-stock';
    const isServiceOrderStockEndpoint = lastPart === 'service-order-stock';
    const isAuditEndpoint = lastPart === 'audit';

    try {
      await ensureStockSchema(client);
    } catch (alterError) {
      console.warn('Schema de estoque não ajustado:', alterError);
    }

    const jsonResponse = (status: number, body: unknown) =>
      new Response(JSON.stringify(body, (_key, value) =>
        typeof value === 'bigint' ? Number(value) : value
      ), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    if (isAuditEndpoint && req.method === 'GET') {
      try {
        const productFilter = url.searchParams.get('product_id');
        const params: unknown[] = [organizationId];
        let query = `SELECT id, product_id, user_id, action, before, after, created_at
          FROM product_change_log WHERE organization_id = $1`;
        if (productFilter) {
          params.push(productFilter);
          query += ` AND product_id = $2`;
        }
        query += ` ORDER BY created_at DESC LIMIT 100`;
        const listed = await client.queryObject(query, params);
        return jsonResponse(200, { data: listed.rows });
      } catch (auditError: any) {
        return jsonResponse(500, { error: auditError?.message || 'Não foi possível ler a auditoria' });
      } finally {
        await client.end();
      }
    }

    // PATCH /products/bulk — ativar/inativar vários produtos de uma vez
    if (isBulkEndpoint && req.method === 'PATCH') {
      if (!permissions.canWrite) {
        await client.end();
        return jsonResponse(403, { error: 'Sem permissão para atualizar produtos' });
      }
      try {
        const body = await req.json();
        const ids = Array.isArray(body.ids)
          ? [...new Set(body.ids.map((id: unknown) => String(id || '').trim()).filter(Boolean))]
          : [];
        if (!ids.length) {
          return jsonResponse(400, { error: 'Informe ao menos um produto (ids)' });
        }
        if (ids.length > 500) {
          return jsonResponse(400, { error: 'Máximo de 500 produtos por operação' });
        }
        if (typeof body.is_active !== 'boolean') {
          return jsonResponse(400, { error: 'is_active (boolean) é obrigatório' });
        }
        const nextActive = body.is_active === true;
        const userName = await getUserName(supabase, user.id);

        await client.queryArray('BEGIN');
        const beforeRows = await client.queryObject<Product>(
          `SELECT * FROM products WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
          [organizationId, ids]
        );
        if (!beforeRows.rows.length) {
          await client.queryArray('ROLLBACK');
          return jsonResponse(404, { error: 'Nenhum produto encontrado' });
        }
        const foundIds = beforeRows.rows.map((row) => row.id);
        await client.queryArray(
          `UPDATE products
           SET is_active = $1, updated_at = now(), updated_by = $2, updated_by_name = $3
           WHERE organization_id = $4 AND id = ANY($5::uuid[])`,
          [nextActive, user.id, userName, organizationId, foundIds]
        );
        const afterRows = await client.queryObject<Product>(
          `SELECT * FROM products WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
          [organizationId, foundIds]
        );
        const afterById = new Map(afterRows.rows.map((row) => [row.id, row]));
        const actionName = nextActive ? 'activate' : 'inactivate';
        for (const before of beforeRows.rows) {
          const after = afterById.get(before.id);
          if (!after) continue;
          const wasActive = before.is_active !== false;
          if (wasActive === nextActive) continue;
          await writeProductAudit(client, {
            organizationId,
            productId: before.id,
            userId: user.id,
            action: actionName,
            before: before as unknown as Record<string, unknown>,
            after: after as unknown as Record<string, unknown>,
          });
        }
        await client.queryArray('COMMIT');
        return jsonResponse(200, {
          data: afterRows.rows,
          updated: afterRows.rows.length,
          is_active: nextActive,
        });
      } catch (bulkError: any) {
        try { await client.queryArray('ROLLBACK'); } catch (_rollbackError) { /* sem transação */ }
        return jsonResponse(500, { error: bulkError?.message || 'Erro ao atualizar produtos em lote' });
      } finally {
        await client.end();
      }
    }

    if (isBulkEndpoint) {
      await client.end();
      return jsonResponse(405, { error: 'Método não permitido. Use PATCH em /products/bulk' });
    }

    if (isBudgetStockEndpoint && req.method === 'POST') {
      if (!permissions.canWrite) {
        await client.end();
        return jsonResponse(403, { error: 'Sem permissão para lançar estoque' });
      }
      try {
        const body = await req.json();
        const budgetId = String(body.budget_id || '');
        const actionName = body.action === 'reverse' ? 'reverse' : body.action === 'status' ? 'status' : 'apply';
        if (!budgetId) return jsonResponse(400, { error: 'budget_id obrigatório' });

        if (actionName === 'status') {
          const posted = await client.queryObject(
            `SELECT budget_id FROM budget_stock_posts WHERE organization_id = $1 AND budget_id = $2`,
            [organizationId, budgetId]
          );
          return jsonResponse(200, { posted: posted.rows.length > 0 });
        }

        const policy = await client.queryObject<{ block_out_of_stock: boolean | null }>(
          `SELECT block_out_of_stock FROM pos_settings WHERE organization_id = $1 LIMIT 1`,
          [organizationId]
        );
        const blockStock = Boolean(policy.rows[0]?.block_out_of_stock);

        if (actionName === 'reverse') {
          await client.queryArray('BEGIN');
          const nets = await client.queryObject<{ product_id: string; net: number }>(
            `SELECT product_id, COALESCE(SUM(quantity_delta), 0)::float8 AS net
             FROM pos_stock_movements
             WHERE organization_id = $1 AND budget_id = $2
             GROUP BY product_id`,
            [organizationId, budgetId]
          );
          for (const row of nets.rows) {
            const net = Number(row.net);
            if (!net) continue;
            const delta = -net;
            const stockRow = await client.queryObject<{ stock_quantity: number | null }>(
              `SELECT stock_quantity FROM products WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
              [row.product_id, organizationId]
            );
            if (!stockRow.rows.length) continue;
            const before = Number(stockRow.rows[0].stock_quantity ?? 0);
            const after = before + delta;
            const movementType = delta < 0 ? 'out' : 'in';
            await client.queryArray(
              `UPDATE products SET stock_quantity = $1, updated_at = now() WHERE id = $2 AND organization_id = $3`,
              [after, row.product_id, organizationId]
            );
            await client.queryArray(
              `INSERT INTO pos_stock_movements (
                 organization_id, product_id, movement_type, source, budget_id,
                 quantity_delta, stock_before, stock_after, notes, created_by
               ) VALUES ($1, $2, $3, 'budget', $4, $5, $6, $7, 'Orçamento rejeitado', $8)`,
              [organizationId, row.product_id, movementType, budgetId, delta, before, after, user.id]
            );
          }
          await client.queryArray(
            `DELETE FROM budget_stock_posts WHERE organization_id = $1 AND budget_id = $2`,
            [organizationId, budgetId]
          );
          await client.queryArray('COMMIT');
          return jsonResponse(200, { reversed: true });
        }

        const already = await client.queryObject(
          `SELECT budget_id FROM budget_stock_posts WHERE organization_id = $1 AND budget_id = $2`,
          [organizationId, budgetId]
        );
        if (already.rows.length) return jsonResponse(200, { posted: true, already: true });

        const items = Array.isArray(body.items) ? body.items : [];
        await client.queryArray('BEGIN');
        const reserved = await client.queryObject(
          `INSERT INTO budget_stock_posts (organization_id, budget_id, created_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, budget_id) DO NOTHING
           RETURNING budget_id`,
          [organizationId, budgetId, user.id]
        );
        if (!reserved.rows.length) {
          await client.queryArray('ROLLBACK');
          return jsonResponse(200, { posted: true, already: true });
        }
        for (const item of items) {
          if (item?.isManual || !item?.id) continue;
          const quantity = Number(item.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;
          const stockRow = await client.queryObject<{ stock_quantity: number | null; name: string }>(
            `SELECT stock_quantity, name FROM products WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
            [item.id, organizationId]
          );
          if (!stockRow.rows.length) {
            await client.queryArray('ROLLBACK');
            return jsonResponse(400, { error: 'Produto do orçamento não encontrado nesta empresa' });
          }
          const before = Number(stockRow.rows[0].stock_quantity ?? 0);
          const after = before - quantity;
          if (blockStock && after < 0) {
            await client.queryArray('ROLLBACK');
            return jsonResponse(400, { error: `Estoque insuficiente para ${stockRow.rows[0].name}` });
          }
          await client.queryArray(
            `UPDATE products SET stock_quantity = $1, updated_at = now() WHERE id = $2 AND organization_id = $3`,
            [after, item.id, organizationId]
          );
          await client.queryArray(
            `INSERT INTO pos_stock_movements (
               organization_id, product_id, movement_type, source, budget_id,
               quantity_delta, stock_before, stock_after, notes, created_by
             ) VALUES ($1, $2, 'out', 'budget', $3, $4, $5, $6, 'Orçamento aprovado', $7)`,
            [organizationId, item.id, budgetId, -quantity, before, after, user.id]
          );
        }
        await client.queryArray('COMMIT');
        return jsonResponse(200, { posted: true });
      } catch (budgetError: any) {
        try { await client.queryArray('ROLLBACK'); } catch (_rollbackError) { /* já revertido */ }
        return jsonResponse(500, { error: budgetError?.message || 'Não foi possível lançar o estoque do orçamento' });
      } finally {
        await client.end();
      }
    }

    if (isServiceOrderStockEndpoint && req.method === 'POST') {
      if (!permissions.canWrite) {
        await client.end();
        return jsonResponse(403, { error: 'Sem permissão para lançar estoque' });
      }
      try {
        const body = await req.json();
        if (body.organization_id && body.organization_id !== organizationId) {
          return jsonResponse(403, { error: 'Não é possível operar outra organização' });
        }
        const serviceOrderId = String(body.service_order_id || '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serviceOrderId)) {
          return jsonResponse(400, { error: 'service_order_id obrigatório' });
        }
        const code = String(body.code || '').replace(/\s+/g, ' ').trim().slice(0, 40) || serviceOrderId;
        const items = Array.isArray(body.items) ? body.items : [];
        const desired = new Map<string, number>();
        for (const item of items) {
          const productId = String(item?.product_id || '');
          const quantity = Math.round(Number(item?.quantity) * 100) / 100;
          if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
            return jsonResponse(400, { error: 'Informe o produto e uma quantidade válida' });
          }
          desired.set(productId, (desired.get(productId) || 0) + quantity);
        }
        const policy = await client.queryObject<{ block_out_of_stock: boolean | null }>(
          `SELECT block_out_of_stock FROM pos_settings WHERE organization_id = $1 LIMIT 1`,
          [organizationId]
        );
        const blockStock = Boolean(policy.rows[0]?.block_out_of_stock);
        const note = `OS ${code}`;
        await client.queryArray('BEGIN');
        const nets = await client.queryObject<{ product_id: string; net: number }>(
          `SELECT product_id::text AS product_id, COALESCE(SUM(quantity_delta), 0)::float8 AS net
           FROM pos_stock_movements
           WHERE organization_id = $1 AND service_order_id = $2
           GROUP BY product_id`,
          [organizationId, serviceOrderId]
        );
        const netByProduct = new Map(nets.rows.map((row) => [String(row.product_id), Number(row.net)]));
        const productIds = [...new Set([...desired.keys(), ...netByProduct.keys()])].sort();
        for (const productId of productIds) {
          const stockRow = await client.queryObject<{ stock_quantity: number | null; name: string; is_supply: boolean }>(
            `SELECT stock_quantity, name, is_supply FROM products WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
            [productId, organizationId]
          );
          if (!stockRow.rows.length) {
            await client.queryArray('ROLLBACK');
            return jsonResponse(400, { error: 'Produto não encontrado nesta empresa' });
          }
          const product = stockRow.rows[0];
          if (desired.has(productId) && product.is_supply !== true) {
            await client.queryArray('ROLLBACK');
            return jsonResponse(400, { error: 'Produto não está marcado como insumo nesta empresa' });
          }
          const target = desired.has(productId) ? -Number(desired.get(productId)) : 0;
          const current = netByProduct.get(productId) || 0;
          const diff = Math.round((target - current) * 100) / 100;
          if (!diff) continue;
          const before = Math.round(Number(product.stock_quantity ?? 0) * 100) / 100;
          const after = Math.round((before + diff) * 100) / 100;
          if (blockStock && after < 0) {
            await client.queryArray('ROLLBACK');
            return jsonResponse(400, { error: `Estoque insuficiente para ${product.name}` });
          }
          const movementType = diff < 0 ? 'out' : 'in';
          await client.queryArray(
            `UPDATE products SET stock_quantity = $1, updated_at = now() WHERE id = $2 AND organization_id = $3`,
            [after, productId, organizationId]
          );
          await client.queryArray(
            `INSERT INTO pos_stock_movements (
               organization_id, product_id, movement_type, source, service_order_id,
               quantity_delta, stock_before, stock_after, notes, created_by
             ) VALUES ($1, $2, $3, 'service_order', $4, $5, $6, $7, $8, $9)`,
            [organizationId, productId, movementType, serviceOrderId, diff, before, after, note, user.id]
          );
        }
        await client.queryArray('COMMIT');
        return jsonResponse(200, { synced: true });
      } catch (supplyError: any) {
        try { await client.queryArray('ROLLBACK'); } catch (_rollbackError) { /* já revertido */ }
        return jsonResponse(500, { error: supplyError?.message || 'Não foi possível lançar o insumo da ordem' });
      } finally {
        await client.end();
      }
    }

    if (isMovementsEndpoint && req.method === 'GET') {
      try {
        const requestedLimit = Number(url.searchParams.get('limit') || 30);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 30;
        const requestedOffset = Number(url.searchParams.get('offset') || 0);
        const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const fromDate = url.searchParams.get('from') || '';
        const toDate = url.searchParams.get('to') || '';
        const productFilter = url.searchParams.get('product_id') || '';
        const categoryFilter = (url.searchParams.get('category') || '').trim().slice(0, 120);
        const userFilter = url.searchParams.get('created_by') || '';
        const conditions = ['m.organization_id = $1'];
        const filterParams: unknown[] = [organizationId];
        if (datePattern.test(fromDate)) {
          filterParams.push(fromDate);
          conditions.push(`m.created_at >= ($${filterParams.length}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
        }
        if (datePattern.test(toDate)) {
          filterParams.push(toDate);
          conditions.push(`m.created_at < (($${filterParams.length}::date + interval '1 day')::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
        }
        if (uuidPattern.test(productFilter)) {
          filterParams.push(productFilter);
          conditions.push(`m.product_id = $${filterParams.length}::uuid`);
        }
        if (categoryFilter && categoryFilter !== 'all') {
          filterParams.push(categoryFilter);
          conditions.push(`COALESCE(NULLIF(btrim(p.category), ''), 'Sem categoria') = $${filterParams.length}`);
        }
        if (uuidPattern.test(userFilter)) {
          filterParams.push(userFilter);
          conditions.push(`m.created_by = $${filterParams.length}::uuid`);
        }
        const whereSql = conditions.join(' AND ');
        const countResult = await client.queryObject<{ total: number }>(
          `SELECT COUNT(*)::float8 AS total
           FROM pos_stock_movements m
           LEFT JOIN products p ON p.id = m.product_id
           WHERE ${whereSql}`,
          filterParams
        );
        const total = Number(countResult.rows[0]?.total || 0);
        const listParams = [...filterParams, limit, offset];
        const result = await client.queryObject(`
          SELECT m.id::text AS id,
                 m.product_id::text AS product_id,
                 m.organization_id::text AS organization_id,
                 m.sale_id::text AS sale_id,
                 m.budget_id::text AS budget_id,
                 m.movement_type,
                 m.source,
                 m.service_order_id::text AS service_order_id,
                 m.quantity_delta::float8 AS quantity_delta,
                 m.stock_before::float8 AS stock_before,
                 m.stock_after::float8 AS stock_after,
                 m.notes,
                 m.created_by::text AS created_by,
                 m.created_at,
                 p.name AS product_name,
                 p.category AS product_category,
                 s.sale_number::text AS sale_number
          FROM pos_stock_movements m
          LEFT JOIN products p ON p.id = m.product_id
          LEFT JOIN pos_sales s ON s.id = m.sale_id
          WHERE ${whereSql}
          ORDER BY m.created_at DESC
          LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
        `, listParams);
        const rows = result.rows as Array<Record<string, unknown>>;
        const userIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean).map((id) => String(id)))];
        const names = new Map<string, string>();
        if (userIds.length) {
          try {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
            for (const profile of profiles || []) {
              if (profile.full_name) names.set(profile.id, profile.full_name);
            }
          } catch (profileError) {
            console.warn('Nomes dos responsáveis indisponíveis:', profileError);
          }
        }
        return jsonResponse(200, {
          total,
          data: rows.map((row) => {
            const safe: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
              if (typeof value === 'bigint') safe[key] = Number(value);
              else if (value instanceof Date) safe[key] = value.toISOString();
              else safe[key] = value;
            }
            return {
              ...safe,
              created_by_name: row.created_by ? names.get(String(row.created_by)) || null : null,
            };
          }),
        });
      } catch (movementError: any) {
        console.warn('Movimentações indisponíveis:', movementError);
        return new Response(
          JSON.stringify({ data: [], warning: movementError?.message || 'Movimentações indisponíveis' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        await client.end();
      }
    }

    if (isMovementsEndpoint && req.method === 'POST') {
      if (!permissions.canWrite) {
        await client.end();
        return new Response(
          JSON.stringify({ error: 'Sem permissão para lançar estoque' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const body = await req.json();
        const productIdBody = String(body.product_id || '');
        const kind = body.kind === 'out' || body.kind === 'adjust' ? body.kind : 'in';
        const amount = Number(body.quantity);
        if (!productIdBody || !Number.isFinite(amount) || amount < 0 || (kind !== 'adjust' && amount === 0)) {
          return jsonResponse(400, { error: 'Informe o produto e uma quantidade válida' });
        }
        const notePrefix = kind === 'in' ? 'Entrada' : kind === 'out' ? 'Saída' : 'Ajuste';
        const notes = [notePrefix, body.notes].filter(Boolean).join(' — ') || null;
        const result = await applyStockChange(client, {
          organizationId,
          productId: productIdBody,
          kind,
          quantity: amount,
          notes,
          userId: user.id,
        });
        if (result.error) return jsonResponse(result.status || 400, { error: result.error });
        return jsonResponse(200, { data: result.data });
      } catch (movementError: any) {
        return jsonResponse(500, { error: movementError?.message || 'Não foi possível lançar o estoque' });
      } finally {
        await client.end();
      }
    }

    if (isCategoriesEndpoint || isBrandsEndpoint) {
      const table = isCategoriesEndpoint ? 'product_categories' : 'product_brands';
      const column = isCategoriesEndpoint ? 'category' : 'brand';
      try {
        if (req.method === 'GET') {
          await client.queryArray(
            `INSERT INTO ${table} (organization_id, name)
             SELECT DISTINCT $1::uuid, btrim(${column}) FROM products
             WHERE organization_id = $1::uuid AND ${column} IS NOT NULL AND btrim(${column}) <> ''
             ON CONFLICT (organization_id, name) DO NOTHING`,
            [organizationId]
          );
          const listed = await client.queryObject(
            `SELECT id, name, created_by, created_at FROM ${table} WHERE organization_id = $1 ORDER BY name ASC`,
            [organizationId]
          );
          return jsonResponse(200, { data: listed.rows });
        }
        if (!permissions.canWrite) return jsonResponse(403, { error: 'Sem permissão para alterar o catálogo' });
        const body = await req.json().catch(() => ({}));
        if (req.method === 'POST') {
          const name = String(body.name || '').trim();
          if (!name) return jsonResponse(400, { error: 'Informe o nome' });
          const inserted = await client.queryObject(
            `INSERT INTO ${table} (organization_id, name, created_by) VALUES ($1, $2, $3)
             ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id, name, created_by, created_at`,
            [organizationId, name, user.id]
          );
          return jsonResponse(201, { data: inserted.rows[0] });
        }
        if (req.method === 'PUT') {
          const from = String(body.from || '').trim();
          const to = String(body.to || '').trim();
          if (!from || !to) return jsonResponse(400, { error: 'Informe o nome atual e o novo nome' });
          await client.queryArray('BEGIN');
          await client.queryArray(
            `UPDATE products SET ${column} = $1, updated_at = now() WHERE organization_id = $2 AND ${column} = $3`,
            [to, organizationId, from]
          );
          await client.queryArray(`DELETE FROM ${table} WHERE organization_id = $1 AND name = $2`, [organizationId, from]);
          await client.queryArray(
            `INSERT INTO ${table} (organization_id, name, created_by) VALUES ($1, $2, $3)
             ON CONFLICT (organization_id, name) DO NOTHING`,
            [organizationId, to, user.id]
          );
          await client.queryArray('COMMIT');
          return jsonResponse(200, { data: { name: to } });
        }
        if (req.method === 'DELETE') {
          const name = String(body.name || '').trim();
          if (!name) return jsonResponse(400, { error: 'Informe o nome' });
          await client.queryArray('BEGIN');
          await client.queryArray(
            `UPDATE products SET ${column} = NULL, updated_at = now() WHERE organization_id = $1 AND ${column} = $2`,
            [organizationId, name]
          );
          await client.queryArray(`DELETE FROM ${table} WHERE organization_id = $1 AND name = $2`, [organizationId, name]);
          await client.queryArray('COMMIT');
          return jsonResponse(200, { data: { name } });
        }
        return jsonResponse(405, { error: 'Método não permitido' });
      } catch (catalogError: any) {
        try { await client.queryArray('ROLLBACK'); } catch (_rollbackError) { /* sem transação */ }
        return jsonResponse(500, { error: catalogError?.message || 'Erro no catálogo' });
      } finally {
        await client.end();
      }
    }

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
            query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount} OR sku ILIKE $${paramCount} OR COALESCE(barcode,'') ILIKE $${paramCount})`;
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
          barcode,
          price,
          cost,
          category,
          is_active,
          stock_quantity,
          min_stock,
          ideal_stock,
          brand,
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
            barcode,
            price,
            wholesale_price,
            cost,
            category,
            is_active,
            stock_quantity,
            min_stock,
            ideal_stock,
            brand,
            unit,
            image_url,
            commission_percentage,
            commission_fixed,
            created_by,
            created_by_name,
            is_supply
          ) VALUES (
            $1, $2, $3, $4, $5, $20, $6, $22, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $21
          ) RETURNING *
        `;

        const wholesaleRaw = body.wholesale_price;
        const wholesalePrice =
          wholesaleRaw === undefined || wholesaleRaw === null || wholesaleRaw === ''
            ? null
            : Number(wholesaleRaw);
        if (wholesalePrice !== null && (!Number.isFinite(wholesalePrice) || wholesalePrice < 0)) {
          return new Response(
            JSON.stringify({ error: 'Preço de atacado inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
          0,
          min_stock || null,
          ideal_stock ?? null,
          brand || null,
          unit || null,
          image_url || null,
          commission_percentage || null,
          commission_fixed || null,
          user.id,
          userName,
          barcode || null,
          body.is_supply === true,
          wholesalePrice,
        ];

        const result = await client.queryObject<Product>(insertQuery, insertParams);
        const created = result.rows[0];
        await client.queryArray(
          `UPDATE products SET ncm = $1, fiscal_origin = $2, cest = $3, tax_class_ref = $4 WHERE id = $5 AND organization_id = $6`,
          [body.ncm ? String(body.ncm) : null, body.fiscal_origin ? String(body.fiscal_origin) : null, body.cest ? String(body.cest) : null, body.tax_class_ref ? String(body.tax_class_ref) : null, created.id, organizationId]
        );
        created.ncm = body.ncm ? String(body.ncm) : null;
        created.fiscal_origin = body.fiscal_origin ? String(body.fiscal_origin) : null;
        created.cest = body.cest ? String(body.cest) : null;
        created.tax_class_ref = body.tax_class_ref ? String(body.tax_class_ref) : null;
        await writeProductAudit(client, {
          organizationId,
          productId: created.id,
          userId: user.id,
          action: 'create',
          before: null,
          after: created as unknown as Record<string, unknown>,
        });
        const initialQty = Number(stock_quantity ?? 0);
        if (Number.isFinite(initialQty) && initialQty !== 0) {
          const change = await applyStockChange(client, {
            organizationId,
            productId: created.id,
            kind: initialQty > 0 ? 'in' : 'adjust',
            quantity: initialQty,
            notes: 'Saldo inicial',
            userId: user.id,
          });
          if (change.error) {
            await client.queryArray('DELETE FROM products WHERE id = $1 AND organization_id = $2', [created.id, organizationId]);
            return new Response(JSON.stringify({ error: change.error }), { status: change.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          created.stock_quantity = change.data?.stock_after ?? initialQty;
        }
        if (category && String(category).trim()) {
          await client.queryArray(
            `INSERT INTO product_categories (organization_id, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (organization_id, name) DO NOTHING`,
            [organizationId, String(category).trim(), user.id]
          );
        }
        if (brand && String(brand).trim()) {
          await client.queryArray(
            `INSERT INTO product_brands (organization_id, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (organization_id, name) DO NOTHING`,
            [organizationId, String(brand).trim(), user.id]
          );
        }
        return new Response(JSON.stringify({ data: created }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

        const stockRequested = body.stock_quantity !== undefined && body.stock_quantity !== null && body.stock_quantity !== ''
          ? Number(body.stock_quantity)
          : null;
        if (stockRequested !== null && !Number.isFinite(stockRequested)) {
          return new Response(JSON.stringify({ error: 'Quantidade de estoque inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const allowedFields = [
          'name', 'description', 'sku', 'barcode', 'price', 'wholesale_price', 'cost', 'category',
          'is_active', 'min_stock', 'ideal_stock', 'brand', 'unit', 'image_url',
          'commission_percentage', 'commission_fixed',
          'ncm', 'fiscal_origin', 'cest', 'tax_class_ref'
        ];

        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            let value = body[field];
            if (field === 'wholesale_price') {
              if (value === '' || value === null) {
                value = null;
              } else {
                value = Number(value);
                if (!Number.isFinite(value) || value < 0) {
                  return new Response(
                    JSON.stringify({ error: 'Preço de atacado inválido' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  );
                }
              }
            }
            paramCount++;
            updateFields.push(`${field} = $${paramCount}`);
            updateParams.push(value);
          }
        }
        if (body.is_supply !== undefined) {
          paramCount++;
          updateFields.push(`is_supply = $${paramCount}`);
          updateParams.push(body.is_supply === true);
        }

        // Sempre atualizar updated_by e updated_by_name
        paramCount++;
        updateFields.push(`updated_by = $${paramCount}`);
        updateParams.push(user.id);
        paramCount++;
        updateFields.push(`updated_by_name = $${paramCount}`);
        updateParams.push(userName);

        if (updateFields.length === 2 && stockRequested === null) {
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

        let updatedRow: Product | null = null;
        const beforeUpdate = updateFields.length > 2
          ? await client.queryObject<Product>('SELECT * FROM products WHERE id = $1 AND organization_id = $2', [productId, organizationId])
          : null;
        if (updateFields.length > 2) {
          const result = await client.queryObject<Product>(updateQuery, updateParams);
          updatedRow = result.rows[0];
        }
        if (stockRequested !== null && Number.isFinite(stockRequested)) {
          const change = await applyStockChange(client, {
            organizationId,
            productId,
            kind: 'adjust',
            quantity: stockRequested,
            notes: 'Ajuste no cadastro',
            userId: user.id,
          });
          if (change.error) {
            return new Response(JSON.stringify({ error: change.error }), { status: change.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const refreshed = await client.queryObject<Product>('SELECT * FROM products WHERE id = $1 AND organization_id = $2', [productId, organizationId]);
          updatedRow = refreshed.rows[0] || updatedRow;
        }
        if (body.category && String(body.category).trim()) {
          await client.queryArray(
            `INSERT INTO product_categories (organization_id, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (organization_id, name) DO NOTHING`,
            [organizationId, String(body.category).trim(), user.id]
          );
        }
        if (body.brand && String(body.brand).trim()) {
          await client.queryArray(
            `INSERT INTO product_brands (organization_id, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (organization_id, name) DO NOTHING`,
            [organizationId, String(body.brand).trim(), user.id]
          );
        }
        if (beforeUpdate?.rows[0] && updatedRow) {
          const wasActive = beforeUpdate.rows[0].is_active !== false;
          const action = wasActive && updatedRow.is_active === false ? 'inactivate' : 'update';
          await writeProductAudit(client, {
            organizationId,
            productId,
            userId: user.id,
            action,
            before: beforeUpdate.rows[0] as unknown as Record<string, unknown>,
            after: updatedRow as unknown as Record<string, unknown>,
          });
        }
        return new Response(JSON.stringify({ data: updatedRow }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

        const history = await client.queryObject(
          `SELECT 1 FROM pos_stock_movements WHERE product_id = $1 AND organization_id = $2
           UNION ALL
           SELECT 1 FROM pos_sale_items WHERE item_id = $1 AND organization_id = $2 AND item_type = 'product'
           LIMIT 1`,
          [productId, organizationId]
        );
        if (history.rows.length) {
          return new Response(
            JSON.stringify({ error: 'Este produto já tem histórico de estoque ou vendas. Inative-o em vez de excluir.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const beforeDelete = await client.queryObject<Product>(
          'SELECT * FROM products WHERE id = $1 AND organization_id = $2',
          [productId, organizationId]
        );
        if (beforeDelete.rows[0]) {
          await writeProductAudit(client, {
            organizationId,
            productId,
            userId: user.id,
            action: 'delete',
            before: beforeDelete.rows[0] as unknown as Record<string, unknown>,
            after: null,
          });
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

