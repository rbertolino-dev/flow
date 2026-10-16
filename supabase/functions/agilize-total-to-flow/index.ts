import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DRY_RUN_TTL_MS = 60 * 60 * 1000;
const BATCH_SIZE = 40;
const BUBBLE_PAGE = 100;
const BUBBLE_MAX_PAGES = 200;
const MARKER_PREFIX = "[agilize_total_id:";

type EntityKey = "clientes" | "produtos" | "servicos" | "contas";
type FieldMap = Record<string, string>;

type SessionPayload = {
  organizationId: string;
  empresaId: string;
  bubbleEnv: string;
  entities: EntityKey[];
  fieldMaps: Partial<Record<EntityKey, FieldMap>>;
  exp: number;
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sessionSecret() {
  return (
    Deno.env.get("AGILIZE_TOTAL_SERVICE_KEY") ||
    Deno.env.get("BUBBLE_AGILIZE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "agilize-total-to-flow"
  );
}

async function createSession(payload: Omit<SessionPayload, "exp">) {
  const body: SessionPayload = { ...payload, exp: Date.now() + DRY_RUN_TTL_MS };
  const raw = JSON.stringify(body);
  const sig = await sha256Hex(`${raw}|${sessionSecret()}`);
  return btoa(JSON.stringify({ payload: raw, sig }));
}

async function verifySession(token: string, organizationId: string, empresaId: string) {
  try {
    const parsed = JSON.parse(atob(token));
    const expected = await sha256Hex(`${parsed.payload}|${sessionSecret()}`);
    if (parsed.sig !== expected) throw new Error("Sessão inválida");
    const data = JSON.parse(parsed.payload) as SessionPayload;
    if (Date.now() > data.exp) {
      throw new Error("Sessão de dry-run expirada. Rode o dry-run de novo.");
    }
    if (data.organizationId !== organizationId || data.empresaId !== empresaId) {
      throw new Error("Sessão inválida para esta organização/empresa");
    }
    return data;
  } catch (e) {
    if (e instanceof Error && e.message.includes("Sessão")) throw e;
    throw new Error("Sessão de dry-run inválida. Rode o dry-run de novo.");
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function field(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (key in row && row[key] != null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(row)) {
    if (lowerKeys.includes(k.toLowerCase()) && v != null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function pickMapped(
  row: Record<string, unknown>,
  map: FieldMap | undefined,
  flowField: string,
  ...fallbacks: string[]
): string {
  const src = map?.[flowField];
  if (src && src !== "__skip__") {
    const v = field(row, src);
    if (v) return v;
  }
  return field(row, ...fallbacks);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let s = String(value).trim().replace(/\s/g, "").replace(/^R\$\s?/i, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function digitsPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) d = `55${d}`;
  return d;
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "sim", "yes", "s"].includes(s)) return true;
  if (["false", "0", "nao", "não", "no", "n"].includes(s)) return false;
  return false;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return null;
}

function linkedId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    return String(row._id || row.id || "");
  }
  return "";
}

function bubbleBase(env: string) {
  return env === "test"
    ? "https://app.agilizetotal.com.br/version-test/api/1.1/obj"
    : "https://app.agilizetotal.com.br/api/1.1/obj";
}

function bubbleToken() {
  const token = Deno.env.get("BUBBLE_AGILIZE_KEY");
  if (!token) throw new Error("BUBBLE_AGILIZE_KEY não configurada");
  return token;
}

async function bubbleGet(env: string, path: string) {
  const res = await fetch(`${bubbleBase(env)}/${path}`, {
    headers: { Authorization: `Bearer ${bubbleToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.body?.message || data?.error || `Agilize Total respondeu ${res.status}`
    );
  }
  return data;
}

async function bubbleList(
  env: string,
  type: string,
  empresaId: string,
  cursor?: number,
  limit = BUBBLE_PAGE
): Promise<{ results: Record<string, unknown>[]; remaining: number; cursor: number }> {
  const constraints = JSON.stringify([
    { key: "empresa", constraint_type: "equals", value: empresaId },
  ]);
  const params = new URLSearchParams({
    limit: String(limit),
    cursor: String(cursor ?? 0),
    constraints,
  });
  const data = await bubbleGet(env, `${encodeURIComponent(type)}?${params}`);
  const results = (data?.response?.results || data?.results || []) as Record<
    string,
    unknown
  >[];
  const remaining = Number(data?.response?.remaining ?? data?.remaining ?? 0);
  return {
    results: Array.isArray(results) ? results : [],
    remaining: Number.isFinite(remaining) ? remaining : 0,
    cursor: (cursor ?? 0) + (Array.isArray(results) ? results.length : 0),
  };
}

async function bubbleListAll(
  env: string,
  type: string,
  empresaId: string,
  maxPages = BUBBLE_MAX_PAGES
) {
  const all: Record<string, unknown>[] = [];
  let cursor = 0;
  for (let page = 0; page < maxPages; page++) {
    const chunk = await bubbleList(env, type, empresaId, cursor);
    all.push(...chunk.results);
    if (chunk.remaining <= 0 || chunk.results.length === 0) break;
    cursor = chunk.cursor;
  }
  return all;
}

function getAgilizeConfig() {
  const url = (
    Deno.env.get("AGILIZE_TOTAL_URL") ||
    "https://svyglaxdnibamkpklwvs.supabase.co"
  ).replace(/\/$/, "");
  const key = Deno.env.get("AGILIZE_TOTAL_SERVICE_KEY");
  if (!key) {
    throw new Error("AGILIZE_TOTAL_SERVICE_KEY não configurada nos secrets da Edge Function");
  }
  return { url, key };
}

async function agilizeFetch(path: string, options: RequestInit = {}) {
  const { url, key } = getAgilizeConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

async function listEprodutos(empresaId: string, offset = 0, limit = 200) {
  const select = [
    "id",
    "nome",
    "medida",
    "origem_produto",
    "categoria_nome",
    "preço",
    "preço_atacado",
    "desativado",
    "qnt_ideal",
    "qntd",
    "qntd_baixa",
    "codigo_produto",
    "custo_unit",
    "codigo_ncm",
    "descricao",
    "marca",
    "cod_interno",
    "codigo_barras",
    "produto_filho",
  ].join(",");
  const path =
    `eprodutos?select=${encodeURIComponent(select)}` +
    `&empresa=eq.${encodeURIComponent(empresaId)}` +
    `&or=(produto_filho.is.null,produto_filho.eq.false)` +
    `&order=id.asc&limit=${limit}&offset=${offset}`;
  const res = await agilizeFetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao ler eprodutos: ${res.status} ${text}`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows : [];
}

async function countEprodutos(empresaId: string) {
  const path =
    `eprodutos?select=id&empresa=eq.${encodeURIComponent(empresaId)}` +
    `&or=(produto_filho.is.null,produto_filho.eq.false)`;
  const res = await agilizeFetch(path, {
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("content-range") || "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
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
  });
  await client.connect();
  return client;
}

async function assertSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  const { data: isPubdigital } = await supabase.rpc("is_pubdigital_user", {
    _user_id: userId,
  });
  if (!isAdmin && !isPubdigital) {
    throw new Error("Acesso negado: apenas Super Admin");
  }
}

async function loadEmpresa(env: string, empresaId: string) {
  const id = empresaId.trim();
  if (!id) throw new Error("ID da empresa no Agilize Total é obrigatório");
  const data = await bubbleGet(env, `empresa_principal/${encodeURIComponent(id)}`);
  const row = (data.response || data) as Record<string, unknown>;
  if (!row || (!row._id && !Object.keys(row).length)) {
    throw new Error("Empresa não encontrada no Agilize Total");
  }
  const nome =
    field(row, "cad_nome da empresa", "nome", "Name") || id;
  return { id: String(row._id || id), nome, row };
}

const DEFAULT_MAPS: Record<EntityKey, FieldMap> = {
  clientes: {
    name: "nome",
    phone: "telefone",
    email: "Email",
    company: "empresa do contato",
    notes: "observações",
  },
  produtos: {
    name: "nome",
    price: "preço",
    cost: "custo_unit",
    sku: "codigo_produto",
    barcode: "codigo_barras",
    unit: "medida",
    category: "categoria_nome",
    stock_quantity: "qntd",
    min_stock: "qntd_baixa",
    ideal_stock: "qnt_ideal",
    ncm: "codigo_ncm",
    brand: "marca",
    description: "descricao",
    wholesale_price: "preço_atacado",
  },
  servicos: {
    name: "nome",
    price: "preço",
    description: "descricao",
    category: "categoria",
  },
  contas: {
    amount: "valor",
    due_date: "vencimento",
    description: "descrição",
    contact_name: "contato",
    category: "categoria",
    account: "conta",
    direction: "tipo",
    status: "status",
  },
};

type StatsBucket = {
  create: number;
  update: number;
  skip: number;
  error: number;
  errors: Array<{ id: string; name: string; reason: string }>;
};

function emptyStats(): StatsBucket {
  return { create: 0, update: 0, skip: 0, error: 0, errors: [] };
}

async function mapGet(
  supabase: SupabaseClient,
  organizationId: string,
  entityType: string,
  bubbleId: string
) {
  const { data } = await supabase
    .from("agilize_migration_id_map")
    .select("flow_id")
    .eq("organization_id", organizationId)
    .eq("entity_type", entityType)
    .eq("bubble_id", bubbleId)
    .maybeSingle();
  return data?.flow_id as string | undefined;
}

async function mapSet(
  supabase: SupabaseClient,
  organizationId: string,
  entityType: string,
  bubbleId: string,
  flowId: string
) {
  await supabase.from("agilize_migration_id_map").upsert(
    {
      organization_id: organizationId,
      entity_type: entityType,
      bubble_id: bubbleId,
      flow_id: flowId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,entity_type,bubble_id" }
  );
}

function withMarker(notes: string, bubbleId: string) {
  const marker = `${MARKER_PREFIX}${bubbleId}]`;
  if (notes.includes(marker)) return notes;
  return notes ? `${notes}\n${marker}` : marker;
}

async function previewEntity(
  env: string,
  empresaId: string,
  entity: EntityKey
) {
  if (entity === "produtos") {
    const total = await countEprodutos(empresaId);
    const sample = await listEprodutos(empresaId, 0, 20);
    return {
      entity,
      total,
      sample: sample.map((r) => ({
        id: String(r.id ?? ""),
        nome: field(r, "nome"),
        keys: Object.keys(r).slice(0, 30),
      })),
      sourceFields: sample[0] ? Object.keys(sample[0]) : Object.keys(DEFAULT_MAPS.produtos),
      defaultMap: DEFAULT_MAPS.produtos,
    };
  }

  const typeMap: Record<Exclude<EntityKey, "produtos">, string[]> = {
    clientes: ["contato", "empresadocontato"],
    servicos: ["serviço", "servico"],
    contas: ["fim_lançamento", "fim_lancamento", "fin_lancamento"],
  };

  if (entity === "clientes") {
    let contatos: Record<string, unknown>[] = [];
    let empresas: Record<string, unknown>[] = [];
    try {
      contatos = await bubbleListAll(env, "contato", empresaId, 3);
    } catch {
      contatos = [];
    }
    try {
      empresas = await bubbleListAll(env, "empresadocontato", empresaId, 3);
    } catch {
      empresas = [];
    }
    const sample = [...contatos.slice(0, 10), ...empresas.slice(0, 10)];
    const fields = new Set<string>();
    for (const r of sample) Object.keys(r).forEach((k) => fields.add(k));
    return {
      entity,
      total: contatos.length + empresas.length,
      totals: { contatos: contatos.length, empresas: empresas.length },
      sample: sample.slice(0, 20).map((r) => ({
        id: String(r._id || ""),
        nome: field(r, "nome", "Name"),
        tipo: field(r, "cnpj") || field(r, "cnpj ou cpf") ? "empresa_ou_doc" : "contato",
        keys: Object.keys(r).slice(0, 30),
      })),
      sourceFields: [...fields],
      defaultMap: DEFAULT_MAPS.clientes,
    };
  }

  const types = typeMap[entity];
  let results: Record<string, unknown>[] = [];
  let usedType = types[0];
  let lastErr = "";
  for (const t of types) {
    try {
      const page = await bubbleList(env, t, empresaId, 0, 20);
      results = page.results;
      usedType = t;
      // estimate total: fetch more pages lightly for count
      const all = await bubbleListAll(env, t, empresaId, entity === "contas" ? 5 : 10);
      results = all;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!results.length && lastErr && entity !== "contas") {
    throw new Error(lastErr);
  }
  const fields = new Set<string>();
  for (const r of results.slice(0, 20)) Object.keys(r).forEach((k) => fields.add(k));
  return {
    entity,
    total: results.length,
    bubbleType: usedType,
    sample: results.slice(0, 20).map((r) => ({
      id: String(r._id || ""),
      nome: field(r, "nome", "descrição", "descricao", "Name"),
      raw: Object.fromEntries(
        Object.entries(r).filter(([k]) => !k.startsWith("Created") && !k.startsWith("Modified")).slice(0, 25)
      ),
      keys: Object.keys(r).slice(0, 40),
    })),
    sourceFields: [...fields],
    defaultMap: DEFAULT_MAPS[entity],
    warning: results.length === 0 && lastErr ? lastErr : null,
  };
}

function mapClienteRow(row: Record<string, unknown>, map: FieldMap) {
  const name = pickMapped(row, map, "name", "nome", "Name");
  const phone = digitsPhone(pickMapped(row, map, "phone", "telefone", "phone", "celular"));
  const email = pickMapped(row, map, "email", "Email", "email", "e-mail");
  const company = pickMapped(
    row,
    map,
    "company",
    "empresa do contato",
    "nome",
    "company"
  );
  const notesBase = pickMapped(row, map, "notes", "observações", "observacoes");
  const doc = field(row, "cnpj", "cnpj ou cpf", "cpf");
  const addr = [
    field(row, "endereço", "endereco", "rua", "logradouro"),
    field(row, "n do endereço", "numero"),
    field(row, "bairro"),
    field(row, "cidade"),
    field(row, "estado"),
    field(row, "CEP", "cep"),
  ]
    .filter(Boolean)
    .join(", ");
  const notes = [notesBase, doc ? `Doc: ${doc}` : "", addr ? `Endereço: ${addr}` : ""]
    .filter(Boolean)
    .join("\n");
  return { name, phone, email, company, notes, bubbleId: String(row._id || "") };
}

function mapProdutoRow(row: Record<string, unknown>, map: FieldMap) {
  const name = pickMapped(row, map, "name", "nome");
  const price = toNumber(pickMapped(row, map, "price", "preço", "preco")) ?? 0;
  const cost = toNumber(pickMapped(row, map, "cost", "custo_unit"));
  const sku =
    pickMapped(row, map, "sku", "codigo_produto", "cod_interno") || null;
  const barcode = pickMapped(row, map, "barcode", "codigo_barras") || null;
  const unit = pickMapped(row, map, "unit", "medida") || null;
  const category = pickMapped(row, map, "category", "categoria_nome") || null;
  const stock_quantity = toNumber(pickMapped(row, map, "stock_quantity", "qntd")) ?? 0;
  const min_stock = toNumber(pickMapped(row, map, "min_stock", "qntd_baixa"));
  const ideal_stock = toNumber(pickMapped(row, map, "ideal_stock", "qnt_ideal"));
  const ncm = pickMapped(row, map, "ncm", "codigo_ncm") || null;
  const brand = pickMapped(row, map, "brand", "marca") || null;
  const description = pickMapped(row, map, "description", "descricao") || null;
  const wholesale_price = toNumber(
    pickMapped(row, map, "wholesale_price", "preço_atacado", "preco_atacado")
  );
  const desativado = parseBool(row.desativado);
  const bubbleId = String(row.id ?? row._id ?? "");
  return {
    name,
    price,
    cost,
    sku,
    barcode,
    unit,
    category,
    stock_quantity,
    min_stock,
    ideal_stock,
    ncm,
    brand,
    description,
    wholesale_price,
    is_active: !desativado,
    bubbleId,
  };
}

function mapServicoRow(row: Record<string, unknown>, map: FieldMap) {
  const name = pickMapped(row, map, "name", "nome", "Name");
  const price = toNumber(pickMapped(row, map, "price", "preço", "preco")) ?? 0;
  const description = pickMapped(row, map, "description", "descricao", "descrição");
  const category = pickMapped(row, map, "category", "categoria");
  const codigo = field(row, "codigo", "código", "code");
  const custo = field(row, "custo unit", "custo");
  const notes = [
    description,
    codigo ? `Código: ${codigo}` : "",
    custo ? `Custo: ${custo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    name,
    price,
    description: notes || null,
    category: category || null,
    is_active: true,
    bubbleId: String(row._id || ""),
  };
}

function detectDirection(row: Record<string, unknown>, mapped: string): "receber" | "pagar" | null {
  const raw = (mapped || field(row, "tipo", "direção", "direcao", "tipo lançamento", "entrada_saida")).toLowerCase();
  if (/receber|receita|entrada|crédito|credito|a receber/.test(raw)) return "receber";
  if (/pagar|despesa|saída|saida|débito|debito|a pagar/.test(raw)) return "pagar";
  if (parseBool(row["é despesa"]) || parseBool(row["e despesa"]) || parseBool(row.despesa)) {
    return "pagar";
  }
  if (parseBool(row["é receita"]) || parseBool(row.receita)) return "receber";
  return null;
}

function detectStatus(row: Record<string, unknown>, mapped: string): "open" | "paid" {
  const raw = (mapped || field(row, "status", "situação", "situacao", "pago")).toLowerCase();
  if (/pago|paid|quitado|baixado|liquidado|recebido/.test(raw)) return "paid";
  if (parseBool(row.pago) || parseBool(row.quitado)) return "paid";
  return "open";
}

function mapContaRow(row: Record<string, unknown>, map: FieldMap) {
  const amount =
    toNumber(pickMapped(row, map, "amount", "valor", "value", "montante")) ?? 0;
  const due_date =
    parseDate(
      pickMapped(row, map, "due_date", "vencimento", "data de vencimento", "due date", "Created Date")
    ) || new Date().toISOString().slice(0, 10);
  const description = pickMapped(
    row,
    map,
    "description",
    "descrição",
    "descricao",
    "histórico",
    "historico",
    "nome"
  );
  const contact_name = pickMapped(
    row,
    map,
    "contact_name",
    "contato",
    "cliente",
    "fornecedor",
    "nome contato"
  );
  const category = pickMapped(row, map, "category", "categoria", "fin_categoria");
  const account = pickMapped(row, map, "account", "conta", "fin_contas");
  const directionMapped = pickMapped(row, map, "direction", "tipo", "direção");
  const statusMapped = pickMapped(row, map, "status", "status", "pago");
  const direction = detectDirection(row, directionMapped);
  const status = detectStatus(row, statusMapped);
  const contactLink =
    linkedId(row.contato) ||
    linkedId(row.cliente) ||
    linkedId(row["empresa do contato"]) ||
    "";
  return {
    amount,
    due_date,
    description,
    contact_name,
    category,
    account,
    direction,
    status,
    bubbleId: String(row._id || ""),
    contactLink,
  };
}

async function processClientes(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  rows: Record<string, unknown>[],
  map: FieldMap,
  dryRun: boolean,
  stats: StatsBucket
) {
  for (const row of rows) {
    const mapped = mapClienteRow(row, map);
    try {
      if (!mapped.name) {
        stats.skip++;
        stats.errors.push({ id: mapped.bubbleId, name: "", reason: "Sem nome" });
        continue;
      }
      if (!mapped.phone || mapped.phone.length < 12) {
        stats.skip++;
        stats.errors.push({
          id: mapped.bubbleId,
          name: mapped.name,
          reason: "Telefone inválido ou ausente",
        });
        continue;
      }

      let flowId = mapped.bubbleId
        ? await mapGet(supabase, organizationId, "lead", mapped.bubbleId)
        : undefined;

      if (!flowId) {
        const { data: byPhone } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("phone", mapped.phone)
          .is("deleted_at", null)
          .maybeSingle();
        flowId = byPhone?.id;
      }

      const notes = withMarker(mapped.notes, mapped.bubbleId);
      if (dryRun) {
        if (flowId) stats.update++;
        else stats.create++;
        continue;
      }

      if (flowId) {
        const { error } = await supabase
          .from("leads")
          .update({
            name: mapped.name,
            phone: mapped.phone,
            email: mapped.email || null,
            company: mapped.company || null,
            notes,
            source: "agilize_total",
          })
          .eq("id", flowId)
          .eq("organization_id", organizationId);
        if (error) throw error;
        stats.update++;
      } else {
        const { data, error } = await supabase
          .from("leads")
          .insert({
            organization_id: organizationId,
            user_id: userId,
            name: mapped.name,
            phone: mapped.phone,
            email: mapped.email || null,
            company: mapped.company || null,
            notes,
            source: "agilize_total",
          })
          .select("id")
          .single();
        if (error) throw error;
        flowId = data.id;
        stats.create++;
      }
      if (mapped.bubbleId && flowId) {
        await mapSet(supabase, organizationId, "lead", mapped.bubbleId, flowId);
      }
    } catch (e) {
      stats.error++;
      stats.errors.push({
        id: String(row._id || ""),
        name: field(row, "nome"),
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

async function processProdutos(
  supabase: SupabaseClient,
  organizationId: string,
  organizationName: string,
  userId: string,
  rows: Record<string, unknown>[],
  map: FieldMap,
  dryRun: boolean,
  stats: StatsBucket
) {
  const pg = dryRun ? null : await getPostgresClient();
  try {
    for (const row of rows) {
      const mapped = mapProdutoRow(row, map);
      try {
        if (!mapped.name || mapped.price <= 0) {
          stats.skip++;
          stats.errors.push({
            id: mapped.bubbleId,
            name: mapped.name || "",
            reason: "Nome ou preço inválido",
          });
          continue;
        }

        let flowId = mapped.bubbleId
          ? await mapGet(supabase, organizationId, "product", mapped.bubbleId)
          : undefined;

        if (!flowId && mapped.sku && pg) {
          const found = await pg.queryObject<{ id: string }>(
            "SELECT id FROM products WHERE organization_id = $1 AND sku = $2 LIMIT 1",
            [organizationId, mapped.sku]
          );
          flowId = found.rows[0]?.id;
        } else if (!flowId && mapped.sku && dryRun) {
          // dry-run without pg: skip sku lookup beyond map
        }

        if (dryRun) {
          if (flowId) stats.update++;
          else stats.create++;
          continue;
        }
        if (!pg) throw new Error("Postgres indisponível");

        if (flowId) {
          await pg.queryObject(
            `UPDATE products SET
              name=$1, description=$2, sku=$3, barcode=$4, price=$5, wholesale_price=$6,
              cost=$7, category=$8, is_active=$9, stock_quantity=$10, min_stock=$11,
              ideal_stock=$12, brand=$13, unit=$14, ncm=$15, updated_at=now()
             WHERE id=$16 AND organization_id=$17`,
            [
              mapped.name,
              mapped.description,
              mapped.sku,
              mapped.barcode,
              mapped.price,
              mapped.wholesale_price,
              mapped.cost,
              mapped.category,
              mapped.is_active,
              mapped.stock_quantity,
              mapped.min_stock,
              mapped.ideal_stock,
              mapped.brand,
              mapped.unit,
              mapped.ncm,
              flowId,
              organizationId,
            ]
          );
          stats.update++;
        } else {
          const inserted = await pg.queryObject<{ id: string }>(
            `INSERT INTO products (
              organization_id, organization_name, name, description, sku, barcode,
              price, wholesale_price, cost, category, is_active, stock_quantity,
              min_stock, ideal_stock, brand, unit, ncm, created_by
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
            ) RETURNING id`,
            [
              organizationId,
              organizationName,
              mapped.name,
              mapped.description,
              mapped.sku,
              mapped.barcode,
              mapped.price,
              mapped.wholesale_price,
              mapped.cost,
              mapped.category,
              mapped.is_active,
              mapped.stock_quantity,
              mapped.min_stock,
              mapped.ideal_stock,
              mapped.brand,
              mapped.unit,
              mapped.ncm,
              userId,
            ]
          );
          flowId = inserted.rows[0]?.id;
          stats.create++;
        }
        if (mapped.bubbleId && flowId) {
          await mapSet(supabase, organizationId, "product", mapped.bubbleId, flowId);
        }
      } catch (e) {
        stats.error++;
        stats.errors.push({
          id: String(row.id ?? row._id ?? ""),
          name: field(row, "nome"),
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    if (pg) {
      try {
        await pg.end();
      } catch {
        /* ignore */
      }
    }
  }
}

async function processServicos(
  supabase: SupabaseClient,
  organizationId: string,
  rows: Record<string, unknown>[],
  map: FieldMap,
  dryRun: boolean,
  stats: StatsBucket
) {
  const pg = dryRun ? null : await getPostgresClient();
  try {
    for (const row of rows) {
      const mapped = mapServicoRow(row, map);
      try {
        if (!mapped.name || mapped.price < 0) {
          stats.skip++;
          stats.errors.push({
            id: mapped.bubbleId,
            name: mapped.name || "",
            reason: "Nome ou preço inválido",
          });
          continue;
        }

        let flowId = mapped.bubbleId
          ? await mapGet(supabase, organizationId, "service", mapped.bubbleId)
          : undefined;

        if (!flowId && pg) {
          const found = await pg.queryObject<{ id: string }>(
            "SELECT id FROM services WHERE organization_id = $1 AND lower(name) = lower($2) LIMIT 1",
            [organizationId, mapped.name]
          );
          flowId = found.rows[0]?.id;
        }

        if (dryRun) {
          if (flowId) stats.update++;
          else stats.create++;
          continue;
        }
        if (!pg) throw new Error("Postgres indisponível");

        if (flowId) {
          await pg.queryObject(
            `UPDATE services SET name=$1, description=$2, price=$3, category=$4, is_active=$5
             WHERE id=$6 AND organization_id=$7`,
            [
              mapped.name,
              mapped.description,
              mapped.price,
              mapped.category,
              mapped.is_active,
              flowId,
              organizationId,
            ]
          );
          stats.update++;
        } else {
          const inserted = await pg.queryObject<{ id: string }>(
            `INSERT INTO services (organization_id, name, description, price, category, is_active)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [
              organizationId,
              mapped.name,
              mapped.description,
              mapped.price,
              mapped.category,
              mapped.is_active,
            ]
          );
          flowId = inserted.rows[0]?.id;
          stats.create++;
        }
        if (mapped.bubbleId && flowId) {
          await mapSet(supabase, organizationId, "service", mapped.bubbleId, flowId);
        }
      } catch (e) {
        stats.error++;
        stats.errors.push({
          id: String(row._id || ""),
          name: field(row, "nome"),
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    if (pg) {
      try {
        await pg.end();
      } catch {
        /* ignore */
      }
    }
  }
}

async function ensureFinanceMeta(
  supabase: SupabaseClient,
  organizationId: string,
  category: string | null,
  account: string | null,
  direction: "receber" | "pagar"
) {
  let categoryId: string | null = null;
  if (category) {
    const { data: existing } = await supabase
      .from("financial_categories")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", category)
      .maybeSingle();
    if (existing?.id) categoryId = existing.id;
    else {
      const { data } = await supabase
        .from("financial_categories")
        .insert({
          organization_id: organizationId,
          name: category,
          direction: "ambos",
        })
        .select("id")
        .maybeSingle();
      categoryId = data?.id ?? null;
    }
  }
  if (account) {
    const { data: existing } = await supabase
      .from("financial_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", account)
      .maybeSingle();
    if (!existing?.id) {
      await supabase.from("financial_accounts").insert({
        organization_id: organizationId,
        name: account,
      });
    }
  }
  return { categoryId, direction };
}

async function processContas(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  rows: Record<string, unknown>[],
  map: FieldMap,
  dryRun: boolean,
  stats: StatsBucket
) {
  for (const row of rows) {
    const mapped = mapContaRow(row, map);
    try {
      if (!mapped.bubbleId) {
        stats.skip++;
        continue;
      }
      if (mapped.amount <= 0) {
        stats.skip++;
        stats.errors.push({
          id: mapped.bubbleId,
          name: mapped.description || "",
          reason: "Valor inválido",
        });
        continue;
      }
      if (!mapped.direction) {
        stats.skip++;
        stats.errors.push({
          id: mapped.bubbleId,
          name: mapped.description || "",
          reason: "Não foi possível detectar se é pagar ou receber",
        });
        continue;
      }

      const existingMap = await mapGet(
        supabase,
        organizationId,
        "finance",
        mapped.bubbleId
      );
      const { data: existingEntry } = await supabase
        .from("financial_entries")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("source_type", "agilize_total")
        .eq("source_id", mapped.bubbleId)
        .neq("status", "cancelled")
        .maybeSingle();

      if (dryRun) {
        if (existingMap || existingEntry?.id) stats.update++;
        else stats.create++;
        continue;
      }

      let leadId: string | null = null;
      if (mapped.contactLink) {
        leadId =
          (await mapGet(supabase, organizationId, "lead", mapped.contactLink)) ||
          null;
      }
      if (!leadId && mapped.contact_name) {
        const { data: byName } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("name", mapped.contact_name)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        leadId = byName?.id ?? null;
      }

      await ensureFinanceMeta(
        supabase,
        organizationId,
        mapped.category || null,
        mapped.account || null,
        mapped.direction
      );

      const { data: entryId, error } = await supabase.rpc("upsert_financial_entry", {
        p_organization_id: organizationId,
        p_direction: mapped.direction,
        p_amount: mapped.amount,
        p_due_date: mapped.due_date,
        p_source_type: "agilize_total",
        p_source_id: mapped.bubbleId,
        p_status: mapped.status,
        p_settlement_status: mapped.status === "paid" ? "confirmado" : "confirmado",
        p_lead_id: leadId,
        p_description: mapped.description || null,
        p_contact_name: mapped.contact_name || null,
        p_billing_name: mapped.contact_name || "Sem contato",
        p_category: mapped.category || null,
        p_account: mapped.account || null,
        p_origin_label: "Agilize Total",
        p_created_by: userId,
        p_paid_at: mapped.status === "paid" ? new Date().toISOString() : null,
      });
      if (error) throw error;
      if (!entryId) {
        stats.skip++;
        continue;
      }
      if (existingMap || existingEntry?.id) stats.update++;
      else stats.create++;
      await mapSet(supabase, organizationId, "finance", mapped.bubbleId, entryId);
    } catch (e) {
      stats.error++;
      stats.errors.push({
        id: String(row._id || ""),
        name: field(row, "descrição", "descricao", "nome"),
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

async function fetchEntityRows(
  env: string,
  empresaId: string,
  entity: EntityKey
): Promise<Record<string, unknown>[]> {
  if (entity === "produtos") {
    const all: Record<string, unknown>[] = [];
    let offset = 0;
    for (;;) {
      const page = await listEprodutos(empresaId, offset, 200);
      all.push(...page);
      if (page.length < 200) break;
      offset += 200;
      if (offset > 50000) break;
    }
    return all;
  }
  if (entity === "clientes") {
    let contatos: Record<string, unknown>[] = [];
    let empresas: Record<string, unknown>[] = [];
    try {
      contatos = await bubbleListAll(env, "contato", empresaId);
    } catch {
      contatos = [];
    }
    try {
      empresas = await bubbleListAll(env, "empresadocontato", empresaId);
    } catch {
      empresas = [];
    }
    return [
      ...contatos.map((r) => ({ ...r, __tipo: "contato" })),
      ...empresas.map((r) => ({ ...r, __tipo: "empresa" })),
    ];
  }
  if (entity === "servicos") {
    for (const t of ["serviço", "servico"]) {
      try {
        return await bubbleListAll(env, t, empresaId);
      } catch {
        /* try next */
      }
    }
    return [];
  }
  // contas
  for (const t of ["fim_lançamento", "fim_lancamento", "fin_lancamento"]) {
    try {
      return await bubbleListAll(env, t, empresaId);
    } catch {
      /* try next */
    }
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Usuário não autenticado" }, 401);
    await assertSuperAdmin(supabase, user.id);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list_orgs") {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      const orgIds = (data || []).map((o) => o.id);
      const links: Record<string, { empresa_id: string; bubble_env: string }> = {};
      if (orgIds.length) {
        const { data: linkRows } = await supabase
          .from("agilize_total_links")
          .select("organization_id, empresa_id, bubble_env")
          .in("organization_id", orgIds);
        for (const l of linkRows || []) {
          links[l.organization_id] = {
            empresa_id: l.empresa_id,
            bubble_env: l.bubble_env,
          };
        }
      }
      const fiscal: Record<string, string> = {};
      try {
        const { data: fisc } = await supabase
          .from("fiscal_settings")
          .select("organization_id, empresa_id")
          .in("organization_id", orgIds);
        for (const f of fisc || []) {
          if (f.empresa_id) fiscal[f.organization_id] = f.empresa_id;
        }
      } catch {
        /* fiscal_settings pode não existir em todos ambientes */
      }
      return json({
        organizations: (data || []).map((o) => ({
          id: o.id,
          name: o.name,
          link: links[o.id] || null,
          fiscalEmpresaId: fiscal[o.id] || null,
        })),
      });
    }

    if (action === "validate_link") {
      const organizationId = String(body.organizationId || "").trim();
      const empresaId = String(body.empresaId || "").trim();
      const bubbleEnv = body.bubbleEnv === "test" ? "test" : "live";
      if (!organizationId) return json({ error: "organizationId obrigatório" }, 400);
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle();
      if (!org) return json({ error: "Organização não encontrada" }, 404);
      const empresa = await loadEmpresa(bubbleEnv, empresaId);
      const { error } = await supabase.from("agilize_total_links").upsert(
        {
          organization_id: organizationId,
          empresa_id: empresa.id,
          bubble_env: bubbleEnv,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "organization_id" }
      );
      if (error) throw error;
      return json({
        ok: true,
        organization: org,
        empresa: { id: empresa.id, nome: empresa.nome },
        bubbleEnv,
      });
    }

    if (action === "preview") {
      const organizationId = String(body.organizationId || "").trim();
      const entities = (body.entities || []) as EntityKey[];
      if (!organizationId || !entities.length) {
        return json({ error: "organizationId e entities obrigatórios" }, 400);
      }
      const { data: link } = await supabase
        .from("agilize_total_links")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!link) return json({ error: "Valide o vínculo org↔empresa antes" }, 400);
      const previews: unknown[] = [];
      for (const entity of entities) {
        previews.push(await previewEntity(link.bubble_env, link.empresa_id, entity));
      }
      return json({
        ok: true,
        organizationId,
        empresaId: link.empresa_id,
        bubbleEnv: link.bubble_env,
        previews,
        defaultMaps: DEFAULT_MAPS,
      });
    }

    if (action === "dry_run" || action === "import") {
      const organizationId = String(body.organizationId || "").trim();
      const entities = (body.entities || []) as EntityKey[];
      const fieldMaps = (body.fieldMaps || {}) as Partial<Record<EntityKey, FieldMap>>;
      const dryRun = action === "dry_run";
      const sessionToken = String(body.sessionToken || "");
      const cursorEntity = body.cursorEntity as EntityKey | undefined;
      const cursorOffset = Number(body.cursorOffset || 0);

      if (!organizationId || !entities.length) {
        return json({ error: "organizationId e entities obrigatórios" }, 400);
      }

      const { data: link } = await supabase
        .from("agilize_total_links")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!link) return json({ error: "Valide o vínculo org↔empresa antes" }, 400);

      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle();
      if (!org) return json({ error: "Organização não encontrada" }, 404);

      if (!dryRun) {
        await verifySession(sessionToken, organizationId, link.empresa_id);
      }

      const order: EntityKey[] = ["clientes", "produtos", "servicos", "contas"];
      const selected = order.filter((e) => entities.includes(e));
      const statsAll: Record<string, StatsBucket> = {};

      let runId: string | null = null;
      if (!dryRun && cursorOffset === 0 && (!cursorEntity || cursorEntity === selected[0])) {
        const { data: run } = await supabase
          .from("agilize_migration_runs")
          .insert({
            organization_id: organizationId,
            empresa_id: link.empresa_id,
            entities: selected,
            stats: {},
            created_by: user.id,
          })
          .select("id")
          .single();
        runId = run?.id ?? null;
      }

      // Process one entity batch for import streaming; dry_run processes all (capped sample for huge sets uses all rows but reports)
      const startIdx = cursorEntity ? selected.indexOf(cursorEntity) : 0;
      const entity = selected[Math.max(0, startIdx)];
      if (!entity) return json({ error: "Nenhuma entidade selecionada" }, 400);

      const map = { ...DEFAULT_MAPS[entity], ...(fieldMaps[entity] || {}) };
      const rows = await fetchEntityRows(link.bubble_env, link.empresa_id, entity);
      const stats = emptyStats();

      if (dryRun) {
        // process all entities in dry_run
        for (const ent of selected) {
          const entMap = { ...DEFAULT_MAPS[ent], ...(fieldMaps[ent] || {}) };
          const entRows = ent === entity ? rows : await fetchEntityRows(link.bubble_env, link.empresa_id, ent);
          const entStats = emptyStats();
          if (ent === "clientes") {
            await processClientes(supabase, organizationId, user.id, entRows, entMap, true, entStats);
          } else if (ent === "produtos") {
            await processProdutos(
              supabase,
              organizationId,
              org.name || "",
              user.id,
              entRows,
              entMap,
              true,
              entStats
            );
          } else if (ent === "servicos") {
            await processServicos(supabase, organizationId, entRows, entMap, true, entStats);
          } else {
            await processContas(supabase, organizationId, user.id, entRows, entMap, true, entStats);
          }
          entStats.errors = entStats.errors.slice(0, 100);
          statsAll[ent] = entStats;
        }
        const tokenOut = await createSession({
          organizationId,
          empresaId: link.empresa_id,
          bubbleEnv: link.bubble_env,
          entities: selected,
          fieldMaps,
        });
        return json({
          ok: true,
          dryRun: true,
          sessionToken: tokenOut,
          stats: statsAll,
          totals: Object.fromEntries(
            Object.entries(statsAll).map(([k, v]) => [
              k,
              {
                create: v.create,
                update: v.update,
                skip: v.skip,
                error: v.error,
              },
            ])
          ),
        });
      }

      // import batch
      const slice = rows.slice(cursorOffset, cursorOffset + BATCH_SIZE);
      if (entity === "clientes") {
        await processClientes(supabase, organizationId, user.id, slice, map, false, stats);
      } else if (entity === "produtos") {
        await processProdutos(
          supabase,
          organizationId,
          org.name || "",
          user.id,
          slice,
          map,
          false,
          stats
        );
      } else if (entity === "servicos") {
        await processServicos(supabase, organizationId, slice, map, false, stats);
      } else {
        await processContas(supabase, organizationId, user.id, slice, map, false, stats);
      }

      const nextOffset = cursorOffset + slice.length;
      const entityDone = nextOffset >= rows.length;
      let nextEntity: EntityKey | null = null;
      let nextCursor = 0;
      if (!entityDone) {
        nextEntity = entity;
        nextCursor = nextOffset;
      } else {
        const ni = selected.indexOf(entity) + 1;
        nextEntity = ni < selected.length ? selected[ni] : null;
        nextCursor = 0;
      }

      if (runId) {
        await supabase
          .from("agilize_migration_runs")
          .update({
            stats: { [entity]: stats, cursor: { entity, offset: nextOffset } },
            finished_at: nextEntity ? null : new Date().toISOString(),
          })
          .eq("id", runId);
      }

      return json({
        ok: true,
        dryRun: false,
        entity,
        processed: slice.length,
        entityTotal: rows.length,
        cursorOffset: nextOffset,
        stats: { [entity]: { ...stats, errors: stats.errors.slice(0, 50) } },
        done: !nextEntity,
        nextEntity,
        nextCursor,
        runId,
      });
    }

    return json({ error: `Action desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error("agilize-total-to-flow:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500
    );
  }
});
