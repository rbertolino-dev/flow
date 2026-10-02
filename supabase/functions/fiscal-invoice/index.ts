import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-organization-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const BUBBLE_LIVE = "https://app.agilizetotal.com.br/api/1.1/obj";
const BUBBLE_TEST = "https://app.agilizetotal.com.br/version-test/api/1.1/obj";

function bubbleBase(env: string) {
  return env === "test" ? BUBBLE_TEST : BUBBLE_LIVE;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function money(value: unknown) {
  const n = Number(value || 0);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function field(row: Record<string, unknown>, caption: string) {
  if (row[caption] != null && String(row[caption]).trim()) return String(row[caption]).trim();
  const lower = caption.toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    if (key.toLowerCase() === lower && value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function findCnpj(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (/cnpj/i.test(key) && !/token|secret|key/i.test(key) && value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

async function postgres() {
  const hostEnv = Deno.env.get("POSTGRES_HOST") || "localhost";
  const host = hostEnv === "localhost" || hostEnv === "127.0.0.1"
    ? (Deno.env.get("POSTGRES_SERVER_IP") || "95.217.2.116")
    : hostEnv;
  const password = Deno.env.get("POSTGRES_PASSWORD");
  if (!password) throw new Error("POSTGRES_PASSWORD não configurada");
  const client = new Client({
    hostname: host,
    port: parseInt(Deno.env.get("POSTGRES_PORT") || "5432"),
    database: Deno.env.get("POSTGRES_DB") || "budget_services",
    user: Deno.env.get("POSTGRES_USER") || "budget_user",
    password,
    tls: { enforce: false, caCertificates: [] },
  });
  await client.connect();
  return client;
}

async function ensureSchema(client: Client) {
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS fiscal_settings (
      organization_id UUID PRIMARY KEY,
      empresa_id TEXT NOT NULL,
      ambiente INT NOT NULL DEFAULT 2,
      modelo TEXT NOT NULL DEFAULT 'nfe',
      natureza TEXT NOT NULL DEFAULT 'Venda de Mercadoria',
      bubble_env TEXT NOT NULL DEFAULT 'live',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await client.queryArray(`ALTER TABLE fiscal_settings ADD COLUMN IF NOT EXISTS bubble_env TEXT NOT NULL DEFAULT 'live'`);
  await client.queryArray(`ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS bubble_env TEXT`);
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS fiscal_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      source TEXT,
      source_id TEXT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processando',
      webmania_uuid TEXT,
      number TEXT,
      access_key TEXT,
      pdf_url TEXT,
      xml_url TEXT,
      verification_code TEXT,
      amount NUMERIC(14,2),
      customer_name TEXT,
      request_payload JSONB,
      response_payload JSONB,
      bubble_nota_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_org ON fiscal_invoices (organization_id, created_at DESC)`);
  await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_uuid ON fiscal_invoices (webmania_uuid)`);
  for (const col of ["ncm", "fiscal_origin", "cest", "tax_class_ref"]) {
    await client.queryArray(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col} TEXT`);
  }
  await client.queryArray(`ALTER TABLE services ADD COLUMN IF NOT EXISTS tax_class_ref TEXT`);
  await client.queryArray(`ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS invoice_number TEXT`);
  await client.queryArray(`ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ`);
}

function bubbleToken() {
  const token = Deno.env.get("BUBBLE_AGILIZE_KEY");
  if (!token) throw new Error("BUBBLE_AGILIZE_KEY não configurada");
  return token;
}

async function bubbleGet(env: string, path: string) {
  const res = await fetch(`${bubbleBase(env)}/${path}`, { headers: { Authorization: `Bearer ${bubbleToken()}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.body?.message || data?.error || `Agilize Total respondeu ${res.status}`);
  return data;
}

async function loadEmpresa(empresaId: string, preferred = "live") {
  const order = preferred === "test" ? ["test", "live"] : ["live", "test"];
  let lastMessage = "Empresa não encontrada no Agilize Total";
  for (const env of order) {
    const res = await fetch(`${bubbleBase(env)}/empresa_principal/${encodeURIComponent(empresaId)}`, {
      headers: { Authorization: `Bearer ${bubbleToken()}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastMessage = data?.body?.message || data?.error || `Agilize Total respondeu ${res.status}`;
      continue;
    }
    const row = (data.response || data) as Record<string, unknown>;
    if (row && !row.error) return { row, env };
  }
  throw new Error(lastMessage.includes("does not exist")
    ? "Esse ID não existe no Agilize Total publicado nem na versão de desenvolvimento."
    : lastMessage);
}

function publicCompany(row: Record<string, unknown>, settings: Record<string, unknown> | null) {
  const auth = field(row, "webmania Authorization");
  return {
    name: field(row, "cad_nome da empresa"),
    cnpj: findCnpj(row),
    limit: Number(field(row, "limite nota fiscal") || 50),
    lastEmission: field(row, "NF ultima emissão nota fiscal"),
    empresaId: settings?.empresa_id || "",
    ambiente: Number(settings?.ambiente || 2),
    modelo: String(settings?.modelo || "nfe"),
    natureza: String(settings?.natureza || "Venda de Mercadoria"),
    nfseModelo: field(row, "webmania modelo nfse"),
    hasNfeCredentials: Boolean(field(row, "webmania X-Consumer-Key") && field(row, "webmania X-Access-Token")),
    hasNfseCredentials: Boolean(auth),
    bubbleEnv: String(settings?.bubble_env || "live"),
  };
}

function nfeHeaders(row: Record<string, unknown>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Consumer-Key": field(row, "webmania X-Consumer-Key"),
    "X-Consumer-Secret": field(row, "webmania X-Consumer-Secret"),
    "X-Access-Token": field(row, "webmania X-Access-Token"),
    "X-Access-Token-Secret": field(row, "webmania X-Access-Token-Secret"),
  };
  if (!headers["X-Consumer-Key"] || !headers["X-Access-Token"]) {
    throw new Error("A empresa no Agilize Total não tem as credenciais de NF-e da Webmania");
  }
  return headers;
}

function nfseHeaders(row: Record<string, unknown>) {
  const auth = field(row, "webmania Authorization");
  if (!auth) throw new Error("A empresa no Agilize Total não tem o token de NFS-e da Webmania");
  const value = auth.toLowerCase().startsWith("bearer ") ? auth : `Bearer ${auth}`;
  return { "Content-Type": "application/json", Authorization: value };
}

function webhookUrl() {
  return Deno.env.get("FISCAL_WEBHOOK_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/fiscal-webhook`;
}

const PAYMENT_CODE: Record<string, string> = {
  dinheiro: "01",
  cheque: "02",
  cartao_credito: "03",
  cartao_debito: "04",
  crediario: "05",
  boleto: "15",
  transferencia_bancaria: "16",
  transferencia: "16",
  pix: "17",
};

function paymentCode(method: string) {
  return PAYMENT_CODE[method] || "99";
}

function extractReturn(body: Record<string, unknown>) {
  const info = Array.isArray(body.info_nfse) ? body.info_nfse[0] as Record<string, unknown> : null;
  const src = info || body;
  return {
    uuid: String(body.uuid || src.uuid || ""),
    status: String(src.status || body.status || "processando"),
    number: String(src.nfe || src.numero || src.nfse || body.nfe || body.numero || ""),
    accessKey: String(src.chave || body.chave || ""),
    pdf: String(src.danfe || src.pdf_nfse || src.pdf || body.danfe || body.pdf_nfse || ""),
    xml: String(src.xml || body.xml || ""),
    verification: String(src.codigo_verificacao || body.codigo_verificacao || ""),
    motivo: String(src.motivo || body.motivo || body.error || ""),
  };
}

async function createBubbleNota(env: string, empresaId: string, payload: Record<string, unknown>) {
  const res = await fetch(`${bubbleBase(env)}/notafiscal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bubbleToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const id = data?.id || data?.response?.id || data?.response?._id || "";
  return { id: id ? String(id) : "", raw: data };
}

async function patchBubbleNota(env: string, id: string, payload: Record<string, unknown>) {
  if (!id) return;
  await fetch(`${bubbleBase(env)}/notafiscal/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${bubbleToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

type Line = {
  product_id?: string;
  service_id?: string;
  item_type?: string;
  name?: string;
  code?: string;
  ncm?: string;
  cest?: string;
  origem?: string;
  unit?: string;
  quantity?: number;
  price?: number;
  total?: number;
  tax_class_ref?: string;
  description?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let client: Client | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Token inválido" }, 401);

    const requestedOrg = req.headers.get("X-Organization-Id");
    const { data: memberships } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const allowed = new Set((memberships || []).map((row) => row.organization_id));
    const organizationId = requestedOrg && (allowed.has(requestedOrg) || isAdmin) ? requestedOrg : (memberships || [])[0]?.organization_id;
    if (!organizationId) return json({ error: "Usuário sem organização" }, 403);
    if (requestedOrg && requestedOrg !== organizationId) return json({ error: "Sem acesso a esta organização" }, 403);

    client = await postgres();
    await ensureSchema(client);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const settingsRow = await client.queryObject<Record<string, unknown>>(
      `SELECT * FROM fiscal_settings WHERE organization_id = $1`,
      [organizationId],
    );
    const settings = settingsRow.rows[0] || null;

    if (action === "settings" && req.method === "GET") {
      if (!settings?.empresa_id) return json({ settings: null, company: null, monthCount: 0 });
      const loaded = await loadEmpresa(String(settings.empresa_id), String(settings.bubble_env || "live"));
      if (loaded.env !== settings.bubble_env) {
        await client.queryArray(`UPDATE fiscal_settings SET bubble_env = $2 WHERE organization_id = $1`, [organizationId, loaded.env]);
        settings.bubble_env = loaded.env;
      }
      const count = await client.queryObject<{ n: string }>(
        `SELECT count(*)::text AS n FROM fiscal_invoices WHERE organization_id = $1 AND status <> 'excluido' AND created_at >= date_trunc('month', now())`,
        [organizationId],
      );
      return json({ settings, company: publicCompany(loaded.row, settings), monthCount: Number(count.rows[0]?.n || 0) });
    }

    if (action === "settings" && req.method === "POST") {
      const empresaId = String(body.empresa_id || "").trim();
      if (!empresaId) return json({ error: "Informe o ID da empresa no Agilize Total" }, 400);
      const loaded = await loadEmpresa(empresaId, String(settings?.bubble_env || "live"));
      const ambiente = Number(body.ambiente) === 1 ? 1 : 2;
      const modelo = body.modelo === "nfce" ? "nfce" : "nfe";
      const natureza = String(body.natureza || "Venda de Mercadoria").slice(0, 60);
      await client.queryArray(
        `INSERT INTO fiscal_settings (organization_id, empresa_id, ambiente, modelo, natureza, bubble_env, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (organization_id) DO UPDATE SET empresa_id = $2, ambiente = $3, modelo = $4, natureza = $5, bubble_env = $6, updated_at = now()`,
        [organizationId, empresaId, ambiente, modelo, natureza, loaded.env],
      );
      return json({ ok: true, company: publicCompany(loaded.row, { empresa_id: empresaId, ambiente, modelo, natureza, bubble_env: loaded.env }) });
    }

    if (!settings?.empresa_id) return json({ error: "Configure a empresa do Agilize Total antes de emitir" }, 400);
    const loadedEmpresa = await loadEmpresa(String(settings.empresa_id), String(settings.bubble_env || "live"));
    const empresa = loadedEmpresa.row;
    const bubbleEnv = loadedEmpresa.env;

    if (action === "classes") {
      const constraints = encodeURIComponent(JSON.stringify([{ key: "empresa", constraint_type: "equals", value: String(settings.empresa_id) }]));
      const data = await bubbleGet(bubbleEnv, `webmaniaclasseimposto?constraints=${constraints}&limit=100`);
      const results = (data.response?.results || data.results || []) as Record<string, unknown>[];
      const classes = [];
      for (const item of results.slice(0, 80)) {
        const rawScenarios = item["cenários"] || item["cenarios"] || item["Cenarios"] || [];
        const ids = Array.isArray(rawScenarios) ? rawScenarios.slice(0, 8).map(String) : [];
        const scenarios = [];
        for (const id of ids) {
          try {
            const scenarioData = await bubbleGet(bubbleEnv, `cenarioimposto/${encodeURIComponent(id)}`);
            const scenario = (scenarioData.response || scenarioData) as Record<string, unknown>;
            scenarios.push({
              id,
              name: field(scenario, "cenario"),
              cfop: field(scenario, "cfop"),
              tax: field(scenario, "imposto"),
              cst: field(scenario, "sit trib"),
              rate: field(scenario, "aliquota"),
              person: field(scenario, "tipo pessoa"),
            });
          } catch { /* cenário indisponível */ }
        }
        classes.push({
          id: String(item._id || item.id || ""),
          ref: field(item, "ref"),
          description: field(item, "descrição") || field(item, "descricao"),
          noteType: field(item, "tipo nota"),
          emissionType: field(item, "tipo emissão") || field(item, "tipo emissao"),
          scenarios,
        });
      }
      return json({ classes });
    }

    if (action === "invoices" || action === "export") {
      const from = url.searchParams.get("from") || "2000-01-01";
      const to = url.searchParams.get("to") || "2100-01-01";
      const q = (url.searchParams.get("q") || "").trim();
      const rows = await client.queryObject(
        `SELECT * FROM fiscal_invoices
         WHERE organization_id = $1 AND status <> 'excluido'
           AND created_at::date BETWEEN $2::date AND $3::date
           AND ($4 = '' OR customer_name ILIKE '%' || $4 || '%' OR number ILIKE '%' || $4 || '%')
         ORDER BY created_at DESC LIMIT 500`,
        [organizationId, from, to, q],
      );
      if (action === "export") {
        const header = "tipo,numero,cliente,data,valor,status,chave";
        const lines = rows.rows.map((row: Record<string, unknown>) =>
          [row.kind, row.number || "s/n", row.customer_name, row.created_at, row.amount, row.status, row.access_key]
            .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
        );
        return new Response([header, ...lines].join("\n"), {
          headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8" },
        });
      }
      const issued = rows.rows.filter((row: Record<string, unknown>) => ["aprovado", "processado"].includes(String(row.status))).length;
      return json({ invoices: rows.rows, issued });
    }

    if (action === "sales") {
      const from = url.searchParams.get("from") || "2000-01-01";
      const to = url.searchParams.get("to") || "2100-01-01";
      const q = (url.searchParams.get("q") || "").trim();
      const rows = await client.queryObject(
        `SELECT s.id, s.sale_number, s.customer_name, s.created_at, s.total,
                bool_or(i.item_type = 'product') AS has_product,
                bool_or(i.item_type = 'service') AS has_service
         FROM pos_sales s
         LEFT JOIN pos_sale_items i ON i.sale_id = s.id
         WHERE s.organization_id = $1 AND s.status = 'completed'
           AND s.created_at::date BETWEEN $2::date AND $3::date
           AND ($4 = '' OR s.customer_name ILIKE '%' || $4 || '%')
         GROUP BY s.id
         ORDER BY s.created_at DESC LIMIT 100`,
        [organizationId, from, to, q],
      );
      return json({ sales: rows.rows });
    }

    if (action === "sale") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Venda não informada" }, 400);
      const sale = await client.queryObject(`SELECT * FROM pos_sales WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
      if (!sale.rows[0]) return json({ error: "Venda não encontrada" }, 404);
      const items = await client.queryObject(
        `SELECT i.*, p.ncm, p.fiscal_origin, p.cest, p.tax_class_ref AS product_class, p.sku,
                sv.tax_class_ref AS service_class
         FROM pos_sale_items i
         LEFT JOIN products p ON i.item_type = 'product' AND p.id = i.item_id
         LEFT JOIN services sv ON i.item_type = 'service' AND sv.id = i.item_id
         WHERE i.sale_id = $1 AND i.organization_id = $2`,
        [id, organizationId],
      );
      const payments = await client.queryObject(`SELECT method, amount FROM pos_sale_payments WHERE sale_id = $1`, [id]);
      return json({ sale: sale.rows[0], items: items.rows, payments: payments.rows });
    }

    if (action === "order") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Ordem não informada" }, 400);
      const { data: order, error } = await supabase.from("service_orders").select("id, code, client_name, client_phone, service_name, total, discount").eq("id", id).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
      if (error || !order) return json({ error: "Ordem de serviço não encontrada" }, 404);
      const { data: items } = await supabase.from("service_order_items").select("item_type, item_id, name, sku, unit, quantity, unit_price, total_price").eq("service_order_id", id).eq("organization_id", organizationId);
      const serviceIds = (items || []).filter((item) => item.item_type === "service" && item.item_id).map((item) => item.item_id);
      let classById: Record<string, string> = {};
      if (serviceIds.length) {
        const classes = await client.queryObject<{ id: string; tax_class_ref: string | null }>(
          `SELECT id, tax_class_ref FROM services WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
          [organizationId, serviceIds],
        );
        classById = Object.fromEntries(classes.rows.map((row) => [row.id, row.tax_class_ref || ""]));
      }
      return json({ order, items: items || [], classById });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      const current = await client.queryObject<{ status: string }>(`SELECT status FROM fiscal_invoices WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
      const status = current.rows[0]?.status;
      if (!status) return json({ error: "Nota não encontrada" }, 404);
      if (["aprovado", "cancelado", "processado"].includes(status)) return json({ error: "Só é possível excluir rascunho ou nota ainda não autorizada" }, 400);
      await client.queryArray(`UPDATE fiscal_invoices SET status = 'excluido', updated_at = now() WHERE id = $1`, [id]);
      return json({ ok: true });
    }

    if (action === "refresh") {
      const id = String(body.id || "");
      const current = await client.queryObject<Record<string, unknown>>(`SELECT * FROM fiscal_invoices WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
      const invoice = current.rows[0];
      if (!invoice?.webmania_uuid) return json({ error: "Nota sem identificador da Webmania" }, 400);
      const uuid = String(invoice.webmania_uuid);
      const isService = invoice.kind === "nfse";
      const consult = await fetch(
        isService ? `https://api.webmania.com.br/2/nfse/consulta/${encodeURIComponent(uuid)}` : `https://webmania.com.br/api/1/nfe/consulta/?uuid=${encodeURIComponent(uuid)}`,
        { headers: isService ? nfseHeaders(empresa) : nfeHeaders(empresa) },
      );
      const remote = await consult.json().catch(() => ({}));
      if (!consult.ok) return json({ error: remote?.error || remote?.motivo || "Falha ao consultar a nota" }, 400);
      const parsed = extractReturn(remote);
      await client.queryArray(
        `UPDATE fiscal_invoices SET status = $2, number = NULLIF($3, ''), access_key = NULLIF($4, ''), pdf_url = NULLIF($5, ''), xml_url = NULLIF($6, ''), verification_code = NULLIF($7, ''), response_payload = $8::jsonb, updated_at = now() WHERE id = $1`,
        [id, parsed.status, parsed.number, parsed.accessKey, parsed.pdf, parsed.xml, parsed.verification, JSON.stringify(remote)],
      );
      await patchBubbleNota(String(invoice.bubble_env || bubbleEnv), String(invoice.bubble_nota_id || ""), {
        status: parsed.status, "n da nota": parsed.number, pdf: parsed.pdf, xml: parsed.xml, chave: parsed.accessKey, "text-retorno": parsed.motivo,
      });
      return json({ ok: true, invoice: parsed });
    }

    if (action === "emit") {
      if (body.referenciar) return json({ error: "Referenciar outra NF-e (devolução) fica para a próxima etapa" }, 400);
      const corrections = Array.isArray(body.corrections) ? body.corrections : [];
      for (const correction of corrections) {
        if (!correction?.product_id) continue;
        await client.queryArray(
          `UPDATE products SET ncm = COALESCE($1, ncm), fiscal_origin = COALESCE($2, fiscal_origin), tax_class_ref = COALESCE($3, tax_class_ref), updated_at = now() WHERE id = $4 AND organization_id = $5`,
          [correction.ncm ? digits(correction.ncm) : null, correction.fiscal_origin ?? null, correction.tax_class_ref || null, correction.product_id, organizationId],
        );
      }
      const kind = body.kind === "nfse" ? "nfse" : (body.modelo === "2" || body.modelo === "nfce" || settings.modelo === "nfce") && body.kind !== "nfe" ? "nfce" : (body.kind || (settings.modelo === "nfce" ? "nfce" : "nfe"));
      const source = String(body.source || "avulsa");
      const sourceId = body.source_id ? String(body.source_id) : null;
      if (sourceId && source !== "avulsa") {
        const existing = await client.queryObject<{ id: string; status: string }>(
          `SELECT id, status FROM fiscal_invoices WHERE organization_id = $1 AND source = $2 AND source_id = $3 AND kind = $4 AND status IN ('aprovado', 'processando', 'processamento', 'processado') LIMIT 1`,
          [organizationId, source, sourceId, kind],
        );
        if (existing.rows[0]) return json({ error: "Já existe uma nota deste tipo para esta origem", invoice: existing.rows[0] }, 409);
      }
      const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
      if (!lines.length) return json({ error: "A nota não tem itens" }, 400);
      const customer = body.customer || {};
      const document = digits(customer.document);
      const isCompany = Boolean(customer.isCompany) || document.length === 14;
      if (kind !== "nfce" && document.length !== 11 && document.length !== 14) return json({ error: "Informe o CPF ou CNPJ do cliente" }, 400);
      if (!String(customer.name || "").trim()) return json({ error: "Informe o nome do cliente" }, 400);
      if (kind === "nfe" && (!customer.street || !customer.city || !customer.uf || !digits(customer.cep))) {
        return json({ error: "NF-e precisa do endereço do cliente: logradouro, cidade, UF e CEP" }, 400);
      }

      for (const line of lines) {
        if (line.product_id) {
          const product = await client.queryObject<Record<string, unknown>>(`SELECT name, sku, ncm, fiscal_origin, cest, tax_class_ref, unit FROM products WHERE id = $1 AND organization_id = $2`, [line.product_id, organizationId]);
          const row = product.rows[0];
          if (row) {
            line.name = line.name || String(row.name || "");
            line.code = line.code || String(row.sku || "");
            line.ncm = String(row.ncm || line.ncm || "");
            line.origem = String(row.fiscal_origin || line.origem || "0");
            line.cest = String(row.cest || line.cest || "");
            line.tax_class_ref = String(row.tax_class_ref || line.tax_class_ref || "");
            line.unit = line.unit || String(row.unit || "UN");
          }
        }
        if (line.service_id && !line.tax_class_ref) {
          const service = await client.queryObject<{ tax_class_ref: string | null }>(`SELECT tax_class_ref FROM services WHERE id = $1 AND organization_id = $2`, [line.service_id, organizationId]);
          line.tax_class_ref = service.rows[0]?.tax_class_ref || "";
        }
      }

      const ambiente = Number(settings.ambiente) === 1 ? 1 : 2;
      const amount = lines.reduce((sum, line) => sum + Number(line.total ?? (Number(line.price || 0) * Number(line.quantity || 1))), 0);
      let requestPayload: Record<string, unknown> = {};
      let responsePayload: Record<string, unknown> = {};
      let remoteOk = false;

      if (kind === "nfse") {
        const serviceLines = lines.filter((line) => line.item_type !== "product");
        const used = serviceLines.length ? serviceLines : lines;
        const classes = new Set(used.map((line) => String(line.tax_class_ref || "")).filter(Boolean));
        if (classes.size === 0) return json({ error: "Informe a classe de imposto do serviço" }, 400);
        if (classes.size > 1) return json({ error: "Os serviços desta nota precisam da mesma classe de imposto" }, 400);
        const classe = [...classes][0];
        const tomador: Record<string, unknown> = isCompany
          ? { cnpj: document, razao_social: String(customer.name) }
          : document ? { cpf: document, nome_completo: String(customer.name) } : { nome_completo: String(customer.name) };
        if (customer.email) tomador.email = String(customer.email);
        if (customer.street) {
          tomador.endereco = String(customer.street);
          tomador.numero = String(customer.number || "S/N");
          tomador.bairro = String(customer.district || "");
          tomador.cidade = String(customer.city || "");
          tomador.uf = String(customer.uf || "");
          tomador.cep = digits(customer.cep);
        }
        requestPayload = {
          ambiente,
          url_notificacao: webhookUrl(),
          rps: [{
            servico: {
              valor_servicos: money(amount),
              discriminacao: used.map((line) => line.description || line.name).filter(Boolean).join("; ").slice(0, 2000) || "Prestação de serviço",
              classe_imposto: classe,
            },
            tomador,
          }],
        };
        const remote = await fetch("https://api.webmania.com.br/2/nfse/emissao", {
          method: "POST",
          headers: nfseHeaders(empresa),
          body: JSON.stringify(requestPayload),
        });
        responsePayload = await remote.json().catch(() => ({}));
        remoteOk = remote.ok;
      } else {
        for (const line of lines) {
          if (line.item_type === "service") continue;
          if (digits(line.ncm).length !== 8) return json({ error: `Informações do produto faltando: Código NCM (${line.name || "item"})` }, 400);
          if (!line.tax_class_ref) return json({ error: `Informe a classe de imposto do produto ${line.name || ""}`.trim() }, 400);
          const origin = Number(line.origem ?? 0);
          if (!Number.isInteger(origin) || origin < 0 || origin > 8) return json({ error: "Origem do produto deve ser de 0 a 8" }, 400);
        }
        const productLines = lines.filter((line) => line.item_type !== "service");
        const cliente: Record<string, unknown> = {};
        if (document.length === 14 || isCompany) {
          cliente.cnpj = document;
          cliente.razao_social = String(customer.name);
        } else if (document.length === 11) {
          cliente.cpf = document;
          cliente.nome_completo = String(customer.name);
        } else {
          cliente.nome_completo = String(customer.name);
        }
        if (customer.email) cliente.email = String(customer.email);
        if (customer.phone) cliente.telefone = String(customer.phone);
        if (customer.ie) cliente.ie = String(customer.ie);
        if (customer.street) {
          cliente.endereco = String(customer.street);
          cliente.numero = String(customer.number || "S/N");
          cliente.bairro = String(customer.district || "");
          cliente.cidade = String(customer.city || "");
          cliente.uf = String(customer.uf || "");
          cliente.cep = digits(customer.cep);
        }
        const payments = Array.isArray(body.payments) && body.payments.length ? body.payments : [{ method: "dinheiro", amount }];
        requestPayload = {
          url_notificacao: webhookUrl(),
          operacao: 1,
          natureza_operacao: String(body.natureza || settings.natureza || "Venda de Mercadoria"),
          modelo: kind === "nfce" ? "2" : "1",
          finalidade: 1,
          ambiente,
          cliente,
          produtos: productLines.map((line) => ({
            nome: String(line.name || "Produto"),
            codigo: String(line.code || line.product_id || "item"),
            ncm: digits(line.ncm),
            ...(line.cest ? { cest: String(line.cest) } : {}),
            quantidade: Number(line.quantity || 1),
            unidade: String(line.unit || "UN"),
            origem: Number(line.origem || 0),
            subtotal: money(line.price),
            total: money(line.total ?? Number(line.price || 0) * Number(line.quantity || 1)),
            classe_imposto: String(line.tax_class_ref),
          })),
          pedido: {
            presenca: Number(body.presenca ?? 1),
            modalidade_frete: Number(body.modalidade_frete ?? (Number(body.frete || 0) > 0 ? 0 : 9)),
            frete: money(body.frete || 0),
            desconto: money(body.desconto || 0),
            pagamento: Number(body.pagamento) === 1 ? 1 : 0,
            forma_pagamento: payments.map((item: { method?: string; code?: string }) => item.code || paymentCode(String(item.method || ""))),
            valor_pagamento: payments.map((item: { amount?: number }) => money(item.amount)),
            tipo_integracao: payments.map(() => 2),
          },
        };
        const remote = await fetch("https://webmania.com.br/api/1/nfe/emissao/", {
          method: "POST",
          headers: nfeHeaders(empresa),
          body: JSON.stringify(requestPayload),
        });
        responsePayload = await remote.json().catch(() => ({}));
        remoteOk = remote.ok;
      }

      const parsed = extractReturn(responsePayload);
      if (!remoteOk && !parsed.uuid) {
        return json({ error: parsed.motivo || "A Webmania recusou a emissão", detail: responsePayload }, 400);
      }
      const inserted = await client.queryObject<{ id: string }>(
        `INSERT INTO fiscal_invoices (
           organization_id, source, source_id, kind, status, webmania_uuid, number, access_key, pdf_url, xml_url, verification_code,
           amount, customer_name, request_payload, response_payload, bubble_env
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16)
         RETURNING id`,
        [organizationId, source, sourceId, kind, parsed.status || "processando", parsed.uuid || null, parsed.number || null, parsed.accessKey || null, parsed.pdf || null, parsed.xml || null, parsed.verification || null, amount, String(customer.name), JSON.stringify(requestPayload), JSON.stringify(responsePayload), bubbleEnv],
      );
      let bubbleId = "";
      try {
        const bubble = await createBubbleNota(bubbleEnv, String(settings.empresa_id), {
          empresa: String(settings.empresa_id),
          tipo: kind,
          status: parsed.status || "processando",
          "n da nota": parsed.number || "",
          "valor nota": amount,
          pdf: parsed.pdf || "",
          xml: parsed.xml || "",
          chave: parsed.accessKey || "",
          ref: parsed.uuid || "",
          "text-retorno": parsed.motivo || "",
          "data de emissão": new Date().toISOString(),
        });
        bubbleId = bubble.id;
        if (bubbleId) await client.queryArray(`UPDATE fiscal_invoices SET bubble_nota_id = $2 WHERE id = $1`, [inserted.rows[0].id, bubbleId]);
      } catch (error) {
        console.error("espelho notafiscal", error);
      }
      if (source === "pos_sale" && sourceId) {
        const label = `${kind} ${parsed.number || "s/n"}`;
        await client.queryArray(
          `UPDATE pos_sales SET invoice_number = CASE WHEN invoice_number IS NULL OR invoice_number = '' THEN $2 ELSE invoice_number || ' | ' || $2 END, invoice_issued_at = now() WHERE id = $1 AND organization_id = $3`,
          [sourceId, label, organizationId],
        );
      }
      return json({ ok: remoteOk, invoiceId: inserted.rows[0].id, ...parsed, bubbleId });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar a nota";
    console.error("fiscal-invoice", message);
    return json({ error: message }, 500);
  } finally {
    try { await client?.end(); } catch { /* ignore */ }
  }
});
