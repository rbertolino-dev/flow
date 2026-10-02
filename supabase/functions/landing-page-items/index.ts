import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-organization-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPostgresClient() {
  const postgresHost = Deno.env.get("POSTGRES_HOST") || "localhost";
  const postgresPort = parseInt(Deno.env.get("POSTGRES_PORT") || "5432");
  const postgresDb = Deno.env.get("POSTGRES_DB") || "budget_services";
  const postgresUser = Deno.env.get("POSTGRES_USER") || "budget_user";
  const postgresPassword = Deno.env.get("POSTGRES_PASSWORD");
  if (!postgresPassword) throw new Error("POSTGRES_PASSWORD não configurada");

  let finalHost = postgresHost;
  if (postgresHost === "localhost" || postgresHost === "127.0.0.1") {
    finalHost = Deno.env.get("POSTGRES_SERVER_IP") || "95.217.2.116";
  }

  const client = new Client({
    hostname: finalHost,
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autenticado" }, 401);

  let pg: Client | null = null;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const landingPageId = String(body.landing_page_id || "").trim();
    const productId = String(body.product_id || "").trim();
    if (!landingPageId || !productId) return json({ error: "landing_page_id e product_id são obrigatórios" }, 400);

    const { data: page, error: pageError } = await supabase
      .from("landing_pages")
      .select("id, organization_id")
      .eq("id", landingPageId)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page) return json({ error: "Landing page não encontrada" }, 404);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isPubdigital } = await supabase.rpc("is_pubdigital_user", { _user_id: userId });
    if (!isAdmin && !isPubdigital) {
      const { data: member } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("user_id", userId)
        .eq("organization_id", page.organization_id)
        .maybeSingle();
      if (!member) return json({ error: "Sem permissão nesta organização" }, 403);
    }

    pg = await getPostgresClient();
    let product: { id: string; is_active: boolean; is_supply: boolean } | null = null;
    try {
      const result = await pg.queryObject<{ id: string; is_active: boolean; is_supply: boolean }>(
        `SELECT id, is_active, COALESCE(is_supply, false) AS is_supply FROM products WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [productId, page.organization_id],
      );
      product = result.rows[0] ?? null;
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      if (!/is_supply/i.test(message)) throw error;
      const result = await pg.queryObject<{ id: string; is_active: boolean }>(
        `SELECT id, is_active FROM products WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [productId, page.organization_id],
      );
      const row = result.rows[0];
      product = row ? { ...row, is_supply: false } : null;
    }

    if (!product) return json({ error: "Produto não encontrado nesta organização" }, 400);
    if (!product.is_active || product.is_supply) {
      return json({ error: "Só é possível publicar produtos ativos que não sejam insumos" }, 400);
    }

    const { data: last } = await supabase
      .from("landing_page_items")
      .select("display_order")
      .eq("landing_page_id", landingPageId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error: insertError } = await supabase
      .from("landing_page_items")
      .insert({
        landing_page_id: landingPageId,
        product_id: productId,
        display_order: (last?.display_order ?? -1) + 1,
      })
      .select()
      .single();

    if (insertError) {
      const duplicate = /duplicate|unique|23505/i.test(insertError.message);
      return json(
        { error: duplicate ? "Este produto já está na landing page" : insertError.message },
        duplicate ? 409 : 400,
      );
    }

    return json({ data: inserted });
  } catch (error) {
    console.error("landing-page-items:", error);
    return json({ error: (error as Error)?.message || "Erro ao adicionar produto" }, 500);
  } finally {
    try { await pg?.end(); } catch { /* conexão já encerrada */ }
  }
});
