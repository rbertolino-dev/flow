import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PUBLIC_PAGE_COLUMNS = [
  "id", "organization_id", "is_active", "slug", "template",
  "cover_image_url", "logo_url", "logo_position", "primary_color", "secondary_color",
  "title", "subtitle", "about_text", "show_all_items", "item_order", "show_price", "show_out_of_stock",
  "whatsapp_enabled", "whatsapp_number", "whatsapp_message_template", "whatsapp_button_text", "whatsapp_floating_button",
  "form_enabled", "form_title", "form_position", "form_fields",
  "video_enabled", "video_url", "seo_title", "seo_description", "seo_og_image_url",
  "highlights", "testimonials", "social_proof",
  "map_enabled", "map_embed_url", "call_enabled", "call_number",
  "business_hours_enabled", "business_hours_text",
  "footer_enabled", "footer_text", "footer_links", "created_at", "updated_at",
].join(", ");

interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  image_url: string | null;
  category: string | null;
  unit: string | null;
  is_active: boolean;
  stock_quantity: number | string | null;
  created_at: string;
}

interface PageItem {
  id: string;
  landing_page_id: string;
  product_id: string;
  display_order: number | null;
  custom_title: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  custom_price: number | string | null;
  is_visible: boolean | null;
}

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

function inStock(quantity: number | string | null | undefined): boolean {
  if (quantity === null || quantity === undefined || quantity === "") return false;
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0;
}

async function loadProducts(client: Client, organizationId: string, productIds: string[] | null): Promise<CatalogProduct[]> {
  const baseColumns = "id, name, description, price, image_url, category, unit, is_active, stock_quantity, created_at";
  const supplyFilter = "AND COALESCE(is_supply, false) = false";
  const run = async (withSupply: boolean) => {
    if (productIds && productIds.length === 0) return [] as CatalogProduct[];
    if (productIds) {
      const placeholders = productIds.map((_, index) => `$${index + 2}`).join(", ");
      const sql = `SELECT ${baseColumns} FROM products WHERE organization_id = $1 AND is_active = true ${withSupply ? supplyFilter : ""} AND id IN (${placeholders})`;
      const result = await client.queryObject<CatalogProduct>(sql, [organizationId, ...productIds]);
      return result.rows;
    }
    const sql = `SELECT ${baseColumns} FROM products WHERE organization_id = $1 AND is_active = true ${withSupply ? supplyFilter : ""} ORDER BY created_at DESC`;
    const result = await client.queryObject<CatalogProduct>(sql, [organizationId]);
    return result.rows;
  };
  try {
    return await run(true);
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (!/is_supply/i.test(message)) throw error;
    return await run(false);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Método não permitido" }, 405);

  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return json({ error: "Slug obrigatório" }, 400);

  let pg: Client | null = null;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: page, error: pageError } = await supabase
      .from("landing_pages")
      .select(PUBLIC_PAGE_COLUMNS)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page) return json({ error: "Landing page não encontrada ou desativada" }, 404);

    const { data: organization } = await supabase.from("organizations").select("id, name").eq("id", page.organization_id).maybeSingle();

    const showAll = page.show_all_items !== false;
    let storedItems: PageItem[] = [];
    if (!showAll) {
      const { data: items, error: itemsError } = await supabase
        .from("landing_page_items")
        .select("id, landing_page_id, product_id, display_order, custom_title, custom_description, custom_image_url, custom_price, is_visible")
        .eq("landing_page_id", page.id)
        .eq("is_visible", true)
        .order("display_order", { ascending: true });
      if (itemsError) throw itemsError;
      storedItems = (items || []) as PageItem[];
    }

    pg = await getPostgresClient();
    const products = await loadProducts(pg, page.organization_id, showAll ? null : storedItems.map((item) => item.product_id));
    const byId = new Map(products.map((product) => [product.id, product]));
    const itemOrder = page.item_order || "recent";

    let ordered: Array<{ product: CatalogProduct; item: PageItem | null }> = [];
    if (showAll) {
      ordered = products.map((product) => ({ product, item: null }));
      if (itemOrder === "category") {
        ordered.sort((a, b) => (a.product.category || "").localeCompare(b.product.category || "", "pt-BR"));
      }
    } else {
      ordered = storedItems
        .map((item) => {
          const product = byId.get(item.product_id);
          return product ? { product, item } : null;
        })
        .filter((row): row is { product: CatalogProduct; item: PageItem } => !!row);
      if (itemOrder === "category") {
        ordered.sort((a, b) => (a.product.category || "").localeCompare(b.product.category || "", "pt-BR"));
      } else if (itemOrder !== "manual") {
        ordered.sort((a, b) => String(b.product.created_at).localeCompare(String(a.product.created_at)));
      }
    }

    if (page.show_out_of_stock === false) {
      ordered = ordered.filter(({ product }) => inStock(product.stock_quantity));
    }

    const items = ordered.map(({ product, item }, index) => ({
      id: item?.id || `auto-${product.id}`,
      landing_page_id: page.id,
      product_id: product.id,
      display_order: item?.display_order ?? index,
      custom_title: showAll ? null : item?.custom_title ?? null,
      custom_description: showAll ? null : item?.custom_description ?? null,
      custom_image_url: showAll ? null : item?.custom_image_url ?? null,
      custom_price: showAll || item?.custom_price == null ? null : Number(item.custom_price),
      is_visible: true,
      created_at: product.created_at,
      updated_at: product.created_at,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price ?? 0),
        category: product.category || "",
        unit: product.unit,
        image_url: product.image_url,
        is_active: true,
        in_stock: inStock(product.stock_quantity),
      },
    }));

    return json({
      ...page,
      organization: organization ? { id: organization.id, name: organization.name } : undefined,
      items,
    });
  } catch (error) {
    console.error("public-landing-page:", error);
    return json({ error: (error as Error)?.message || "Erro ao carregar landing page" }, 500);
  } finally {
    try { await pg?.end(); } catch { /* conexão já encerrada */ }
  }
});
