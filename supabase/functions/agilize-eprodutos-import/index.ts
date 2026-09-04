import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_FIELDS = [
  "nome",
  "medida",
  "origem_produto",
  "categoria_nome",
  "preço",
  "preço_atacado",
  "produto_filho",
  "desativado",
  "qnt_ideal",
  "qntd",
  "qntd_baixa",
  "status",
  "total_custo",
  "total_venda",
  "codigo_produto",
  "custo_unit",
  "codigo_ncm",
  "descricao_anp",
  "descricao",
  "marca",
  "cod_interno",
  "codigo_barras",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];
type ProductRow = Partial<Record<AllowedField, unknown>> & { _row?: number };

const MAX_BATCH = 50;
const DEFAULT_BATCH = 25;
const DRY_RUN_TTL_MS = 60 * 60 * 1000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAgilizeConfig() {
  const url = (
    Deno.env.get("AGILIZE_TOTAL_URL") ||
    "https://svyglaxdnibamkpklwvs.supabase.co"
  ).replace(/\/$/, "");
  const key = Deno.env.get("AGILIZE_TOTAL_SERVICE_KEY");
  if (!key) {
    throw new Error(
      "AGILIZE_TOTAL_SERVICE_KEY não configurada nos secrets da Edge Function"
    );
  }
  return { url, key };
}

async function agilizeFetch(
  path: string,
  options: RequestInit & { prefer?: string } = {}
) {
  const { url, key } = getAgilizeConfig();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.prefer) headers.Prefer = options.prefer;

  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers,
  });
  return res;
}

async function assertSuperAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
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

function normalizeLookupName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

type NamedRef = { id: string; nome: string };

async function loadCategoriaEstoqueMap(
  empresaId: string
): Promise<Map<string, NamedRef>> {
  const map = new Map<string, NamedRef>();
  const pageSize = 1000;
  for (let page = 0; page < 10; page++) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const res = await agilizeFetch(
      `categoria_estoque?empresa=eq.${encodeURIComponent(
        empresaId
      )}&select=id,nome&order=id.asc`,
      {
        headers: { Range: `${start}-${end}`, Prefer: "count=exact" },
      }
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{ id: number; nome: string }>;
    if (!rows.length) break;
    for (const row of rows) {
      const key = normalizeLookupName(row.nome);
      if (!key) continue;
      // primeira ocorrência ganha (nomes duplicados)
      if (!map.has(key)) {
        map.set(key, { id: String(row.id), nome: String(row.nome).trim() });
      }
    }
    if (rows.length < pageSize) break;
  }
  return map;
}

async function loadMarcaMaps(empresaId: string): Promise<{
  byName: Map<string, NamedRef>;
  byId: Map<string, NamedRef>;
}> {
  const byName = new Map<string, NamedRef>();
  const byId = new Map<string, NamedRef>();
  const pageSize = 1000;
  for (let page = 0; page < 10; page++) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    // Coluna no banco: EMPREESA (typo legado Bubble)
    const res = await agilizeFetch(
      `marca?EMPREESA=eq.${encodeURIComponent(
        empresaId
      )}&select=id,nome&order=id.asc`,
      {
        headers: { Range: `${start}-${end}`, Prefer: "count=exact" },
      }
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{ id: number; nome: string }>;
    if (!rows.length) break;
    for (const row of rows) {
      const ref = { id: String(row.id), nome: String(row.nome ?? "").trim() };
      byId.set(ref.id, ref);
      const key = normalizeLookupName(ref.nome);
      if (key && !byName.has(key)) byName.set(key, ref);
    }
    if (rows.length < pageSize) break;
  }
  return { byName, byId };
}

/**
 * Bubble mostra categoria/marca pelo ID do checklist (relação),
 * não só pelo texto *_nome. Resolve nome → id.
 */
function enrichBubbleRelations(
  data: Record<string, unknown>,
  catMap: Map<string, NamedRef>,
  marcaByName: Map<string, NamedRef>,
  marcaById: Map<string, NamedRef>,
  rowNum: number,
  warnings: Array<{ row: number; warning: string }>
) {
  const catNome = data.categoria_nome;
  if (catNome != null && String(catNome).trim() !== "") {
    const key = normalizeLookupName(catNome);
    const hit = catMap.get(key);
    if (hit) {
      data.categoria = hit.id;
      data.categoria_nome = hit.nome;
    } else {
      // Sem ID o seletor do Bubble fica vazio mesmo com categoria_nome preenchido
      delete data.categoria;
      warnings.push({
        row: rowNum,
        warning: `Categoria "${String(catNome).trim()}" não existe no checklist desta empresa (tabela categoria_estoque). Cadastre no Bubble com o mesmo nome para aparecer no produto.`,
      });
    }
  }

  const marcaVal = data.marca;
  if (marcaVal != null && String(marcaVal).trim() !== "") {
    const raw = String(marcaVal).trim();
    if (/^\d+$/.test(raw) && marcaById.has(raw)) {
      const hit = marcaById.get(raw)!;
      data.marca = hit.id;
      data.marca_nome = hit.nome;
    } else {
      const hit = marcaByName.get(normalizeLookupName(raw));
      if (hit) {
        data.marca = hit.id;
        data.marca_nome = hit.nome;
      } else {
        // Não gravar texto no campo marca (ID) — Bubble não seleciona
        delete data.marca;
        data.marca_nome = raw;
        warnings.push({
          row: rowNum,
          warning: `Marca "${raw}" não existe no checklist desta empresa (tabela marca). Cadastre no Bubble com o mesmo nome para aparecer no produto.`,
        });
      }
    }
  }
}

function generateBubbleUniqueId(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e18);
  return `${ts}x${rand}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).trim().replace(/\./g, "").replace(",", ".");
  // Try BR format first if has comma; else plain
  const plain = String(value).trim().replace(",", ".");
  const n = Number(plain);
  if (!Number.isNaN(n)) return n;
  const n2 = Number(s);
  return Number.isNaN(n2) ? null : n2;
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "sim" || s === "yes";
  }
  return false;
}

/** Visível no Bubble: desativado ≠ true E produto_filho ≠ true */
function isBubbleVisible(row: {
  desativado?: unknown;
  produto_filho?: unknown;
}): boolean {
  return !isTruthyFlag(row.desativado) && !isTruthyFlag(row.produto_filho);
}

function countBubbleVisibility(
  rows: Array<{ desativado?: unknown; produto_filho?: unknown }>
) {
  let visibleToUser = 0;
  let hiddenDesativado = 0;
  let hiddenProdutoFilho = 0;
  let hiddenBoth = 0;
  for (const r of rows) {
    const des = isTruthyFlag(r.desativado);
    const filho = isTruthyFlag(r.produto_filho);
    if (des && filho) {
      hiddenBoth += 1;
      hiddenDesativado += 1;
    } else if (des) {
      hiddenDesativado += 1;
    } else if (filho) {
      hiddenProdutoFilho += 1;
    } else {
      visibleToUser += 1;
    }
  }
  return {
    total: rows.length,
    visibleToUser,
    hiddenDesativado,
    hiddenProdutoFilho,
    hiddenBoth,
  };
}

function normalizeKey(key: string): string {
  const fixed = (() => {
    if (!key || !/[ÃÂ]/.test(key)) return key;
    try {
      const bytes = Uint8Array.from(key, (c) => c.charCodeAt(0) & 0xff);
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (!decoded || decoded.includes("\uFFFD")) return key;
      return decoded;
    } catch {
      return key;
    }
  })();
  return fixed
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Aceita chaves sem acento / aliases / encoding quebrado do CSV */
function pickRawField(raw: ProductRow, field: AllowedField): unknown {
  const record = raw as Record<string, unknown>;
  if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
    return record[field];
  }

  const aliases: Record<string, string[]> = {
    preço: ["preco", "preÃ§o", "price", "valor", "valor_unitario"],
    preço_atacado: ["preco_atacado", "preÃ§o_atacado", "valor_atacado"],
    nome: ["name", "produto", "nome_produto"],
    medida: ["unidade", "und", "un"],
    origem_produto: ["origem"],
    categoria_nome: ["categoria"],
    produto_filho: ["filho"],
    desativado: ["inativo"],
    qntd: ["qtd", "qtde", "quantidade", "estoque"],
    qnt_ideal: ["qtd_ideal", "quantidade_ideal"],
    qntd_baixa: ["qtd_baixa", "quantidade_baixa"],
    codigo_produto: ["codigo", "sku", "cod_produto", "codigo_do_produto", "codigodoproduto"],
    codigo_ncm: ["ncm"],
    codigo_barras: ["ean", "barcode", "barras", "cod_barras"],
    cod_interno: ["codigo_interno"],
    custo_unit: ["custo", "custo_unitario"],
    descricao: ["desc", "description"],
    descricao_anp: ["desc_anp"],
    marca: ["brand"],
  };

  for (const alt of aliases[field] || []) {
    const v = record[alt];
    if (v !== undefined && v !== null && v !== "") return v;
  }

  // Fallback: qualquer chave cujo nome normalizado bata com o campo
  const target = normalizeKey(field);
  for (const [k, v] of Object.entries(record)) {
    if (k.startsWith("_")) continue;
    if (normalizeKey(k) === target && v !== undefined && v !== null && v !== "") {
      return v;
    }
  }

  return record[field];
}

const STATUS_OPTIONS = ["Ideal", "Em falta", "Baixa"] as const;
const MEDIDA_OPTIONS = [
  "Un",
  "Kg",
  "Gramas",
  "Litros",
  "ml",
  "Metros",
  "Latas",
  "Pacotes",
  "Caixas",
  "Scs",
  "M2",
  "M3",
  "Fardo",
] as const;
const ORIGEM_OPTIONS = [
  "0 – Nacional;",
  "1 – Estrangeira (importação direta);",
  "2 – Estrangeira (adquirida no mercado interno);",
  "3 – Nacional com mais de 40% de conteúdo estrangeiro;",
  "4 – Nacional produzida através de processos produtivos básicos;",
  "5 – Nacional com menos de 40% de conteúdo estrangeiro;",
  "6 – Estrangeira (importação direta) sem produto nacional similar;",
  "7 – Estrangeira (adquirida no mercado interno) sem produto nacional similar;",
  "8 – Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%;",
] as const;

function resolveStatus(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  const raw = String(value).trim();
  const hit = STATUS_OPTIONS.find((o) => o.toLowerCase() === raw.toLowerCase());
  if (hit) return { ok: true, value: hit };
  return {
    ok: false,
    error: `Campo 'status' inválido: "${raw}". Opções: ${STATUS_OPTIONS.join(" | ")}`,
  };
}

function resolveMedida(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  const raw = String(value).trim();
  const hit = MEDIDA_OPTIONS.find((o) => o === raw);
  if (hit) return { ok: true, value: hit };
  // Case-insensitive (ex.: "UN" → "Un", "KG" → "Kg") — mantém a forma canônica da lista
  const ci = MEDIDA_OPTIONS.find((o) => o.toLowerCase() === raw.toLowerCase());
  if (ci) return { ok: true, value: ci };
  return {
    ok: false,
    error: `Campo 'medida' inválido: "${raw}". Opções: ${MEDIDA_OPTIONS.join(" | ")}`,
  };
}

function resolveOrigem(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  const raw = String(value).trim();
  const exact = ORIGEM_OPTIONS.find((o) => o === raw || o.toLowerCase() === raw.toLowerCase());
  if (exact) return { ok: true, value: exact };
  const digit = raw.match(/^([0-8])\b/);
  if (digit) {
    const code = digit[1];
    const byCode = ORIGEM_OPTIONS.find(
      (o) =>
        o.startsWith(`${code} `) ||
        o.startsWith(`${code} –`) ||
        o.startsWith(`${code} -`)
    );
    if (byCode) return { ok: true, value: byCode };
  }
  return {
    ok: false,
    error: `Campo 'origem_produto' inválido: "${raw}". Use o seletor 0–8 (texto fiscal, não número solto fora da lista).`,
  };
}

function resolveBooleanStrict(
  value: unknown,
  field: string
): { ok: true; value: boolean | null } | { ok: false; error: string } {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  if (typeof value === "boolean") return { ok: true, value };
  if (value === 1 || value === 0) return { ok: true, value: value === 1 };
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "s", "verdadeiro"].includes(s)) {
    return { ok: true, value: true };
  }
  if (["false", "0", "nao", "não", "no", "n", "falso"].includes(s)) {
    return { ok: true, value: false };
  }
  return {
    ok: false,
    error: `Campo '${field}' inválido: "${value}". Use true ou false`,
  };
}

/** Excel costuma mandar código como número (298 → "298.0"). Normaliza para texto limpo. */
function normalizeCodigoValue(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "number" && Number.isFinite(val)) {
    // EAN longos: evitar notação científica
    if (Number.isInteger(val) || Math.abs(val % 1) < 1e-9) {
      return String(Math.trunc(val));
    }
    return String(val);
  }
  let s = String(val).trim();
  if (!s) return "";
  // "298.0" / "298.000" vindos do Excel
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, "");
  }
  // Notação científica ocasional do Excel ("7.89026919115e+12")
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && (Number.isInteger(n) || Math.abs(n % 1) < 1e-9)) {
      return String(Math.trunc(n));
    }
  }
  return s;
}

function sanitizeRow(
  raw: ProductRow,
  empresaId: string
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const nome = raw.nome != null ? String(raw.nome).trim() : "";
  if (!nome) {
    return { ok: false, error: "Campo 'nome' é obrigatório" };
  }

  const out: Record<string, unknown> = {
    nome,
    empresa: empresaId,
    uniqueid: generateBubbleUniqueId(),
    creation_date: new Date().toISOString(),
    creator: "(CRM Import)",
    // Defaults para aparecer na lista do Bubble (usuário)
    desativado: false,
    produto_filho: false,
  };

  // origem_produto NÃO é numérico — é select de texto fiscal
  const numericFields: AllowedField[] = [
    "preço",
    "preço_atacado",
    "qnt_ideal",
    "qntd",
    "qntd_baixa",
    "total_custo",
    "total_venda",
    "custo_unit",
  ];

  const textFields: AllowedField[] = [
    "categoria_nome",
    "codigo_ncm",
    "descricao_anp",
    "descricao",
    "marca",
    "cod_interno",
  ];

  for (const field of ALLOWED_FIELDS) {
    if (field === "nome") continue;
    const val = pickRawField(raw, field);
    if (val === undefined || val === null) continue;
    // Células vazias / só espaço no Excel → ignorar (não invalidar)
    if (typeof val === "string" && val.trim() === "") continue;

    if (field === "codigo_produto" || field === "codigo_barras") {
      const codigo = normalizeCodigoValue(val);
      if (codigo) out[field] = codigo;
      continue;
    }

    if (field === "status") {
      const r = resolveStatus(val);
      if (!r.ok) return r;
      if (r.value != null) out.status = r.value;
      continue;
    }

    if (field === "medida") {
      const r = resolveMedida(val);
      if (!r.ok) return r;
      if (r.value != null) out.medida = r.value;
      continue;
    }

    if (field === "origem_produto") {
      const r = resolveOrigem(val);
      if (!r.ok) return r;
      if (r.value != null) out.origem_produto = r.value;
      continue;
    }

    if (field === "produto_filho" || field === "desativado") {
      const r = resolveBooleanStrict(val, field);
      if (!r.ok) return r;
      if (r.value != null) out[field] = r.value;
      continue;
    }

    if (numericFields.includes(field)) {
      const n = toNumber(val);
      if (n === null) {
        return {
          ok: false,
          error: `Campo '${field}' inválido: "${val}" (precisa ser número ou ficar em branco)`,
        };
      }
      out[field] = n;
    } else if (textFields.includes(field)) {
      out[field] = String(val).trim();
    } else {
      out[field] = String(val).trim();
    }
  }

  if (!out.status) out.status = "Em falta";

  return { ok: true, row: out };
}

function fingerprintRows(empresaId: string, rows: ProductRow[]): string {
  const parts = rows.map((r) =>
    `${r.nome ?? ""}|${r.codigo_produto ?? ""}|${r.cod_interno ?? ""}`
  );
  return `${empresaId}::${rows.length}::${parts.join(";;").slice(0, 4000)}`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createSessionToken(
  empresaId: string,
  rows: ProductRow[]
): Promise<string> {
  const exp = Date.now() + DRY_RUN_TTL_MS;
  const hash = await sha256Hex(fingerprintRows(empresaId, rows));
  const payload = JSON.stringify({ empresaId, exp, hash, n: rows.length });
  const { key } = getAgilizeConfig();
  const sig = await sha256Hex(`${payload}|${key}`);
  return btoa(JSON.stringify({ payload, sig }));
}

async function verifySessionToken(
  token: string,
  empresaId: string,
  rows: ProductRow[]
): Promise<boolean> {
  try {
    const parsed = JSON.parse(atob(token));
    const { payload, sig } = parsed;
    const { key } = getAgilizeConfig();
    const expectedSig = await sha256Hex(`${payload}|${key}`);
    if (sig !== expectedSig) return false;
    const data = JSON.parse(payload);
    if (data.empresaId !== empresaId) return false;
    if (Date.now() > data.exp) return false;
    const hash = await sha256Hex(fingerprintRows(empresaId, rows));
    // Allow import_batch of subsets: hash of full set was at dry_run.
    // For batch we only check empresaId + exp + signature of the dry-run payload stored in token.
    // Re-verify stored hash matches if full set length equals; otherwise trust token empresaId/exp.
    if (rows.length === data.n) {
      return hash === data.hash;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchExistingCodigoIds(
  empresaId: string,
  codigos: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Set(codigos.filter(Boolean))];
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const filter = chunk.map((c) => `"${String(c).replace(/"/g, "")}"`).join(",");
    const res = await agilizeFetch(
      `eprodutos?select=id,codigo_produto&empresa=eq.${encodeURIComponent(empresaId)}&codigo_produto=in.(${filter})`,
      { method: "GET" }
    );
    if (!res.ok) continue;
    const data = await res.json();
    for (const item of data || []) {
      if (item.codigo_produto != null && item.id != null) {
        map.set(String(item.codigo_produto), Number(item.id));
      }
    }
  }
  return map;
}

async function fetchExistingCodigos(
  empresaId: string,
  codigos: string[]
): Promise<Set<string>> {
  const map = await fetchExistingCodigoIds(empresaId, codigos);
  return new Set(map.keys());
}

async function countEmpresaVisibility(empresaId: string) {
  const rows: Array<{ desativado?: unknown; produto_filho?: unknown }> = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const res = await agilizeFetch(
      `eprodutos?select=desativado,produto_filho&empresa=eq.${encodeURIComponent(empresaId)}&limit=${page}&offset=${offset}`,
      {
        method: "GET",
        headers: { Range: `${offset}-${offset + page - 1}` },
      }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < page) break;
    offset += page;
    if (offset > 500000) break;
  }
  return countBubbleVisibility(rows);
}

async function validateEmpresa(empresaId: string, empresaNome?: string) {
  if (!empresaId?.trim()) {
    throw new Error("Unique ID da empresa é obrigatório");
  }
  const id = empresaId.trim();

  const visibility = await countEmpresaVisibility(id);
  const productCount = visibility.total;

  const sampleRes = await agilizeFetch(
    `eprodutos?select=id,nome,codigo_produto,status,desativado,produto_filho&empresa=eq.${encodeURIComponent(id)}&limit=3&order=id.asc`,
    { method: "GET" }
  );
  const sample = sampleRes.ok ? await sampleRes.json() : [];

  // Try empresas table (may not have this unique id)
  let empresaCadastro: { nome?: string; found: boolean } = { found: false };
  try {
    const empRes = await agilizeFetch(
      `empresas?select=id,nome%20da%20empresa,unique%20id%20empresa&unique%20id%20empresa=eq.${encodeURIComponent(id)}&limit=1`,
      { method: "GET" }
    );
    if (empRes.ok) {
      const empData = await empRes.json();
      if (empData?.[0]) {
        empresaCadastro = {
          found: true,
          nome: empData[0]["nome da empresa"],
        };
      }
    }
  } catch {
    // ignore
  }

  const nameHint = empresaNome?.trim() || null;
  let nameWarning: string | null = null;
  if (
    nameHint &&
    empresaCadastro.found &&
    empresaCadastro.nome &&
    !String(empresaCadastro.nome)
      .toLowerCase()
      .includes(nameHint.toLowerCase()) &&
    !nameHint.toLowerCase().includes(String(empresaCadastro.nome).toLowerCase())
  ) {
    nameWarning = `Nome informado ("${nameHint}") difere do cadastro ("${empresaCadastro.nome}")`;
  }

  return {
    ok: true,
    empresaId: id,
    empresaNomeInformado: nameHint,
    empresaCadastro,
    productCount,
    /** Quantidade que o usuário vê no Bubble */
    visibleToUser: visibility.visibleToUser,
    hiddenDesativado: visibility.hiddenDesativado,
    hiddenProdutoFilho: visibility.hiddenProdutoFilho,
    visibility,
    bubbleRule:
      "Visível no Bubble = desativado ≠ true E produto_filho ≠ true",
    sample,
    nameWarning,
    existsInProducts: productCount > 0 || sample.length > 0,
  };
}

async function dryRun(
  empresaId: string,
  rows: ProductRow[],
  duplicateMode: "skip" | "overwrite" = "skip"
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Nenhuma linha para validar");
  }
  if (rows.length > 5000) {
    throw new Error("Máximo de 5000 linhas por dry-run");
  }

  const valid: Array<{ row: number; data: Record<string, unknown> }> = [];
  const invalid: Array<{ row: number; error: string }> = [];
  const duplicates: Array<{ row: number; codigo_produto: string }> = [];
  const willUpdate: Array<{ row: number; codigo_produto: string }> = [];
  const warnings: Array<{ row: number; warning: string }> = [];

  const sanitized: Array<{ rowNum: number; data: Record<string, unknown> }> =
    [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = rows[i]._row ?? i + 1;
    const result = sanitizeRow(rows[i], empresaId);
    if (!result.ok) {
      invalid.push({ row: rowNum, error: result.error });
      continue;
    }
    sanitized.push({ rowNum, data: result.row });
  }

  const catMap = await loadCategoriaEstoqueMap(empresaId);
  const { byName: marcaByName, byId: marcaById } = await loadMarcaMaps(
    empresaId
  );
  for (const item of sanitized) {
    enrichBubbleRelations(
      item.data,
      catMap,
      marcaByName,
      marcaById,
      item.rowNum,
      warnings
    );
  }

  const codigos = sanitized
    .map((s) =>
      s.data.codigo_produto != null ? String(s.data.codigo_produto) : ""
    )
    .filter(Boolean);
  const existing = await fetchExistingCodigos(empresaId, codigos);

  let insertCount = 0;
  for (const item of sanitized) {
    const codigo =
      item.data.codigo_produto != null
        ? String(item.data.codigo_produto)
        : "";
    if (codigo && existing.has(codigo)) {
      if (duplicateMode === "overwrite") {
        willUpdate.push({ row: item.rowNum, codigo_produto: codigo });
        warnings.push({
          row: item.rowNum,
          warning: `Será SOBRESCRITO (codigo_produto=${codigo})`,
        });
        if (!isBubbleVisible(item.data)) {
          const reasons: string[] = [];
          if (isTruthyFlag(item.data.desativado)) reasons.push("desativado=true");
          if (isTruthyFlag(item.data.produto_filho))
            reasons.push("produto_filho=true");
          warnings.push({
            row: item.rowNum,
            warning: `Não aparece na lista do Bubble (${reasons.join(", ")})`,
          });
        }
        valid.push({ row: item.rowNum, data: item.data });
      } else {
        duplicates.push({ row: item.rowNum, codigo_produto: codigo });
      }
      continue;
    }
    if (!codigo) {
      warnings.push({
        row: item.rowNum,
        warning: "Sem codigo_produto — não será checado como duplicata",
      });
    }
    if (!isBubbleVisible(item.data)) {
      const reasons: string[] = [];
      if (isTruthyFlag(item.data.desativado)) reasons.push("desativado=true");
      if (isTruthyFlag(item.data.produto_filho))
        reasons.push("produto_filho=true");
      warnings.push({
        row: item.rowNum,
        warning: `Não aparece na lista do Bubble (${reasons.join(", ")})`,
      });
    }
    insertCount += 1;
    valid.push({ row: item.rowNum, data: item.data });
  }

  const sessionToken = await createSessionToken(empresaId, rows);
  const bubbleImport = countBubbleVisibility(valid.map((v) => v.data));
  const empresaAtual = await countEmpresaVisibility(empresaId);

  return {
    ok: true,
    empresaId,
    duplicateMode,
    totals: {
      total: rows.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      willUpdate: willUpdate.length,
      warnings: warnings.length,
      /** Destes válidos, quantos o usuário verá no Bubble */
      visibleToUser: bubbleImport.visibleToUser,
      hiddenDesativado: bubbleImport.hiddenDesativado,
      hiddenProdutoFilho: bubbleImport.hiddenProdutoFilho,
    },
    bubbleRule:
      "Visível no Bubble = desativado ≠ true E produto_filho ≠ true",
    empresaAtual,
    afterImportEstimate: {
      total: empresaAtual.total + insertCount,
      visibleToUser:
        empresaAtual.visibleToUser + bubbleImport.visibleToUser,
    },
    preview: valid.slice(0, 20).map((v) => v.data),
    invalid: invalid.slice(0, 100),
    duplicates: duplicates.slice(0, 100),
    willUpdate: willUpdate.slice(0, 100),
    warnings: warnings.slice(0, 100),
    sessionToken,
  };
}

function buildUpdatePayload(data: Record<string, unknown>): Record<string, unknown> {
  const omit = new Set(["uniqueid", "empresa", "creation_date", "creator", "id"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (omit.has(k)) continue;
    out[k] = v;
  }
  return out;
}

async function importBatch(
  empresaId: string,
  rows: ProductRow[],
  sessionToken: string,
  duplicateMode: "skip" | "overwrite" = "skip"
) {
  if (!sessionToken) {
    throw new Error("sessionToken obrigatório — execute dry-run antes");
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Lote vazio");
  }
  if (rows.length > MAX_BATCH) {
    throw new Error(`Máximo de ${MAX_BATCH} linhas por lote`);
  }

  const tokenOk = await verifySessionToken(sessionToken, empresaId, rows);
  if (!tokenOk) {
    // Soft check: still verify empresa + exp from token even if subset hash differs
    try {
      const parsed = JSON.parse(atob(sessionToken));
      const data = JSON.parse(parsed.payload);
      const { key } = getAgilizeConfig();
      const expectedSig = await sha256Hex(`${parsed.payload}|${key}`);
      if (
        parsed.sig !== expectedSig ||
        data.empresaId !== empresaId ||
        Date.now() > data.exp
      ) {
        throw new Error(
          "Sessão de dry-run inválida ou expirada. Execute o dry-run novamente."
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("dry-run")) throw e;
      throw new Error(
        "Sessão de dry-run inválida ou expirada. Execute o dry-run novamente."
      );
    }
  }

  const inserted: Array<{ row: number; id?: number; nome: string }> = [];
  const updated: Array<{ row: number; id?: number; nome: string }> = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  const errors: Array<{ row: number; error: string }> = [];

  const prepared: Array<{ rowNum: number; data: Record<string, unknown> }> =
    [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = rows[i]._row ?? i + 1;
    const result = sanitizeRow(rows[i], empresaId);
    if (!result.ok) {
      errors.push({ row: rowNum, error: result.error });
      continue;
    }
    prepared.push({ rowNum, data: result.row });
  }

  const catMap = await loadCategoriaEstoqueMap(empresaId);
  const { byName: marcaByName, byId: marcaById } = await loadMarcaMaps(
    empresaId
  );
  for (const item of prepared) {
    enrichBubbleRelations(
      item.data,
      catMap,
      marcaByName,
      marcaById,
      item.rowNum,
      []
    );
  }

  const codigos = prepared
    .map((p) =>
      p.data.codigo_produto != null ? String(p.data.codigo_produto) : ""
    )
    .filter(Boolean);
  const existingIds = await fetchExistingCodigoIds(empresaId, codigos);

  const toInsert: Array<{ rowNum: number; data: Record<string, unknown> }> =
    [];
  const toUpdate: Array<{
    rowNum: number;
    id: number;
    data: Record<string, unknown>;
  }> = [];

  for (const item of prepared) {
    const codigo =
      item.data.codigo_produto != null
        ? String(item.data.codigo_produto)
        : "";
    const existingId = codigo ? existingIds.get(codigo) : undefined;
    if (existingId != null) {
      if (duplicateMode === "overwrite") {
        toUpdate.push({ rowNum: item.rowNum, id: existingId, data: item.data });
      } else {
        skipped.push({
          row: item.rowNum,
          reason: `Duplicata codigo_produto=${codigo}`,
        });
      }
      continue;
    }
    toInsert.push(item);
  }

  if (toInsert.length > 0) {
    const res = await agilizeFetch("eprodutos", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify(toInsert.map((t) => t.data)),
    });

    if (!res.ok) {
      const errText = await res.text();
      // NÃO fazer fallback 1-a-1: estoura timeout do nginx (504).
      // O front faz retry do lote inteiro.
      throw new Error(
        `Insert em lote falhou (HTTP ${res.status}): ${errText.slice(0, 400)}`
      );
    }

    const created = await res.json();
    for (let i = 0; i < toInsert.length; i++) {
      inserted.push({
        row: toInsert[i].rowNum,
        id: created?.[i]?.id,
        nome: String(toInsert[i].data.nome),
      });
    }
  }

  // Updates em chunks pequenos (paralelo limitado) para evitar 504
  const UPDATE_CHUNK = 5;
  for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
    const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map(async (item) => {
        const res = await agilizeFetch(`eprodutos?id=eq.${item.id}`, {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify(buildUpdatePayload(item.data)),
        });
        if (!res.ok) {
          const errText = await res.text();
          errors.push({
            row: item.rowNum,
            error: `Update falhou (HTTP ${res.status}): ${errText.slice(0, 200)}`,
          });
          return;
        }
        updated.push({
          row: item.rowNum,
          id: item.id,
          nome: String(item.data.nome),
        });
      })
    );
  }

  return {
    ok: true,
    empresaId,
    duplicateMode,
    inserted: inserted.length,
    updated: updated.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { inserted, updated, skipped, errors },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization obrigatório" }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return jsonResponse({ error: "Authorization obrigatório" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Passar o JWT explicitamente — evita falso 401 com proxy/domínio customizado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("getUser failed:", userError?.message);
      return jsonResponse(
        {
          error:
            "Não autenticado. Faça login novamente e tente validar a empresa.",
          detail: userError?.message || null,
        },
        401
      );
    }

    // Preferir service role para checagem de roles (RLS não bloqueia RPC)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      const adminClient = createClient(supabaseUrl, serviceKey);
      await assertSuperAdmin(adminClient, user.id);
    } else {
      await assertSuperAdmin(supabase, user.id);
    }

    const body = await req.json();
    const action = body?.action as string;
    const empresaId = String(body?.empresaId || "").trim();
    const empresaNome = body?.empresaNome
      ? String(body.empresaNome)
      : undefined;
    const rows = (body?.rows || []) as ProductRow[];
    const sessionToken = body?.sessionToken
      ? String(body.sessionToken)
      : "";
    const duplicateMode =
      body?.duplicateMode === "overwrite" ? "overwrite" : "skip";

    if (action === "validate_empresa") {
      const result = await validateEmpresa(empresaId, empresaNome);
      return jsonResponse(result);
    }

    if (action === "dry_run") {
      if (!empresaId) {
        return jsonResponse({ error: "empresaId obrigatório" }, 400);
      }
      const result = await dryRun(empresaId, rows, duplicateMode);
      return jsonResponse(result);
    }

    if (action === "import_batch") {
      if (!empresaId) {
        return jsonResponse({ error: "empresaId obrigatório" }, 400);
      }
      const result = await importBatch(
        empresaId,
        rows,
        sessionToken,
        duplicateMode
      );
      return jsonResponse(result);
    }

    return jsonResponse(
      {
        error:
          "action inválida. Use: validate_empresa | dry_run | import_batch",
      },
      400
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("agilize-eprodutos-import:", message);
    const status = message.includes("Acesso negado")
      ? 403
      : message.includes("não configurada")
      ? 500
      : 400;
    return jsonResponse({ error: message }, status);
  }
});
