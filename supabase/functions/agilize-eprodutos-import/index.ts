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

type CorrectionOptions = {
  dividePrice: boolean;
  divideCost: boolean;
  roundMoney: boolean;
  migrateBarcode: boolean;
  clearBarcode: boolean;
};

type ExistingProduct = {
  id: number;
  nome: string | null;
  preço: number | null;
  custo_unit: number | null;
  codigo_barras: string | null;
  codigo_produto: string | null;
};

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

function generateBubbleUniqueId(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e18);
  return `${ts}x${rand}`;
}

async function createCategoriaEstoque(
  empresaId: string,
  nome: string
): Promise<NamedRef> {
  const trimmed = nome.trim();
  if (!trimmed) {
    throw new Error("Nome da categoria vazio");
  }
  const body = {
    nome: trimmed,
    empresa: empresaId,
    "unique id": generateBubbleUniqueId(),
    "Creation Date": new Date().toISOString(),
    Creator: "(CRM Import)",
    "variações": [],
  };
  const res = await agilizeFetch("categoria_estoque", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Falha ao criar categoria "${trimmed}" (HTTP ${res.status}): ${errText.slice(0, 300)}`
    );
  }
  const rows = (await res.json()) as Array<{ id: number; nome: string }>;
  if (!Array.isArray(rows) || rows.length === 0 || rows[0]?.id == null) {
    throw new Error(`Categoria "${trimmed}" criada sem retorno de id`);
  }
  return {
    id: String(rows[0].id),
    nome: String(rows[0].nome ?? trimmed).trim(),
  };
}

/**
 * Garante categorias no checklist da empresa a partir dos nomes da planilha.
 * createMissing=false: só avisa o que será criado.
 * createMissing=true: cria em categoria_estoque (nome + empresa) e atualiza o mapa.
 */
async function ensureCategoriasFromRows(
  empresaId: string,
  rows: Array<{ rowNum: number; data: Record<string, unknown> }>,
  catMap: Map<string, NamedRef>,
  options: {
    createMissing: boolean;
    warnings: Array<{ row: number; warning: string }>;
  }
): Promise<{ created: string[]; pending: string[] }> {
  const created: string[] = [];
  const pending: string[] = [];
  const toCreate: Array<{ key: string; display: string; rowNum: number }> = [];
  const seen = new Set<string>();

  for (const item of rows) {
    const raw = item.data.categoria_nome;
    if (raw == null || String(raw).trim() === "") continue;
    const display = String(raw).trim();
    const key = normalizeLookupName(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (catMap.has(key)) continue;

    if (!options.createMissing) {
      pending.push(display);
      // Placeholder para o dry-run não emitir aviso de "não vinculada"
      catMap.set(key, { id: "", nome: display });
      options.warnings.push({
        row: item.rowNum,
        warning: `Categoria "${display}" será criada em categoria_estoque nesta empresa na importação.`,
      });
      continue;
    }

    toCreate.push({ key, display, rowNum: item.rowNum });
  }

  for (const item of toCreate) {
    if (catMap.has(item.key) && catMap.get(item.key)!.id) continue;

    try {
      const ref = await createCategoriaEstoque(empresaId, item.display);
      catMap.set(item.key, ref);
      created.push(ref.nome);
      options.warnings.push({
        row: item.rowNum,
        warning: `Categoria "${ref.nome}" criada (id=${ref.id}).`,
      });
    } catch (error) {
      const refreshed = await loadCategoriaEstoqueMap(empresaId);
      for (const [k, v] of refreshed) {
        if (!catMap.has(k) || !catMap.get(k)!.id) catMap.set(k, v);
      }
      if (catMap.has(item.key) && catMap.get(item.key)!.id) {
        created.push(item.display);
        continue;
      }
      options.warnings.push({
        row: item.rowNum,
        warning:
          error instanceof Error
            ? error.message
            : `Não foi possível criar a categoria "${item.display}"`,
      });
    }
  }

  return { created, pending };
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

async function createMarca(
  empresaId: string,
  nome: string
): Promise<NamedRef> {
  const trimmed = nome.trim();
  if (!trimmed) {
    throw new Error("Nome da marca vazio");
  }
  const body = {
    nome: trimmed,
    // Typo legado Bubble — coluna correta é EMPREESA
    EMPREESA: empresaId,
    "unique id": generateBubbleUniqueId(),
    "Creation Date": new Date().toISOString(),
    Creator: "(CRM Import)",
  };
  const res = await agilizeFetch("marca", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Falha ao criar marca "${trimmed}" (HTTP ${res.status}): ${errText.slice(0, 300)}`
    );
  }
  const rows = (await res.json()) as Array<{ id: number; nome: string }>;
  if (!Array.isArray(rows) || rows.length === 0 || rows[0]?.id == null) {
    throw new Error(`Marca "${trimmed}" criada sem retorno de id`);
  }
  return {
    id: String(rows[0].id),
    nome: String(rows[0].nome ?? trimmed).trim(),
  };
}

/**
 * Garante marcas no checklist da empresa a partir do texto da planilha (campo marca).
 * createMissing=false: só avisa o que será criado.
 * createMissing=true: cria em marca (nome + EMPREESA) e atualiza o mapa.
 */
async function ensureMarcasFromRows(
  empresaId: string,
  rows: Array<{ rowNum: number; data: Record<string, unknown> }>,
  marcaByName: Map<string, NamedRef>,
  marcaById: Map<string, NamedRef>,
  options: {
    createMissing: boolean;
    warnings: Array<{ row: number; warning: string }>;
  }
): Promise<{ created: string[]; pending: string[] }> {
  const created: string[] = [];
  const pending: string[] = [];
  const toCreate: Array<{ key: string; display: string; rowNum: number }> = [];
  const seen = new Set<string>();

  for (const item of rows) {
    const raw = item.data.marca;
    if (raw == null || String(raw).trim() === "") continue;
    const display = String(raw).trim();
    // Já é ID numérico existente — não criar
    if (/^\d+$/.test(display) && marcaById.has(display)) continue;

    const key = normalizeLookupName(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const existing = marcaByName.get(key);
    if (existing && existing.id) continue;

    if (!options.createMissing) {
      pending.push(display);
      marcaByName.set(key, { id: "", nome: display });
      options.warnings.push({
        row: item.rowNum,
        warning: `Marca "${display}" será criada na tabela marca (EMPREESA) nesta empresa na importação.`,
      });
      continue;
    }

    toCreate.push({ key, display, rowNum: item.rowNum });
  }

  for (const item of toCreate) {
    const current = marcaByName.get(item.key);
    if (current && current.id) continue;

    try {
      const ref = await createMarca(empresaId, item.display);
      marcaByName.set(item.key, ref);
      marcaById.set(ref.id, ref);
      created.push(ref.nome);
      options.warnings.push({
        row: item.rowNum,
        warning: `Marca "${ref.nome}" criada (id=${ref.id}).`,
      });
    } catch (error) {
      const refreshed = await loadMarcaMaps(empresaId);
      for (const [k, v] of refreshed.byName) {
        if (!marcaByName.has(k) || !marcaByName.get(k)!.id) {
          marcaByName.set(k, v);
        }
      }
      for (const [k, v] of refreshed.byId) {
        marcaById.set(k, v);
      }
      if (marcaByName.has(item.key) && marcaByName.get(item.key)!.id) {
        created.push(item.display);
        continue;
      }
      options.warnings.push({
        row: item.rowNum,
        warning:
          error instanceof Error
            ? error.message
            : `Não foi possível criar a marca "${item.display}"`,
      });
    }
  }

  return { created, pending };
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
      if (hit.id) {
        data.categoria = hit.id;
      } else {
        // Placeholder do dry-run (categoria ainda será criada na importação)
        delete data.categoria;
      }
      data.categoria_nome = hit.nome;
    } else {
      // Sem ID o seletor do Bubble fica vazio mesmo com categoria_nome preenchido
      delete data.categoria;
      warnings.push({
        row: rowNum,
        warning: `Categoria "${String(catNome).trim()}" não pôde ser vinculada (não encontrada/criada em categoria_estoque para esta empresa).`,
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
        if (hit.id) {
          data.marca = hit.id;
          data.marca_nome = hit.nome;
        } else {
          // Placeholder do dry-run
          delete data.marca;
          data.marca_nome = hit.nome;
        }
      } else {
        // Não gravar texto no campo marca (ID) — Bubble não seleciona
        delete data.marca;
        data.marca_nome = raw;
        warnings.push({
          row: rowNum,
          warning: `Marca "${raw}" não pôde ser vinculada (não encontrada/criada na tabela marca para esta empresa).`,
        });
      }
    }
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  // Número já parseado pelo Excel (valor binário correto) — manter
  if (typeof value === "number" && Number.isFinite(value)) return value;

  // Mesma lógica manual: texto → tira ponto de milhar → vírgula vira ponto decimal
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/\s/g, "").replace(/^R\$\s?/i, "");

  // Se tem vírgula, trata como pt-BR: remove todos os pontos e troca vírgula por ponto
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Só milhar sem decimais (ex.: 1.234)
    s = s.replace(/\./g, "");
  }
  // caso contrário (ex.: 10.5 já americano) mantém

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function roundMoney2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Campos derivados na importação:
 * - total_custo = custo_unit × qntd
 * - total_venda = preço × qntd
 * - margem_unit = preço − custo_unit
 * - status por faixas de estoque
 * - qntd_inicial = qntd
 */
function applyDerivedProductFields(out: Record<string, unknown>) {
  const qntd = typeof out.qntd === "number" ? out.qntd : null;
  const custo = typeof out.custo_unit === "number" ? out.custo_unit : null;
  const preco = typeof out["preço"] === "number" ? (out["preço"] as number) : null;
  const ideal = typeof out.qnt_ideal === "number" ? out.qnt_ideal : null;
  const baixa = typeof out.qntd_baixa === "number" ? out.qntd_baixa : null;

  if (qntd != null) {
    out.qntd_inicial = qntd;
  }

  if (custo != null && qntd != null) {
    out.total_custo = roundMoney2(custo * qntd);
  }

  if (preco != null && qntd != null) {
    out.total_venda = roundMoney2(preco * qntd);
  }

  if (preco != null && custo != null) {
    out.margem_unit = roundMoney2(preco - custo);
  }

  if (qntd != null && ideal != null && baixa != null) {
    if (qntd >= ideal) {
      out.status = "Ideal";
    } else if (qntd > baixa && qntd < ideal) {
      out.status = "Baixa";
    } else {
      // qntd <= qntd_baixa
      out.status = "Em falta";
    }
  }
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
    categoria_nome: ["categoria", "categorias", "categoria_nome", "category"],
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

  // Sobrescreve/completa totais, status e qntd_inicial conforme regras
  applyDerivedProductFields(out);

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

type DupFingerprint = {
  id?: number;
  nome: string;
  codigo: string;
  preco: number | null;
};

function productDupFingerprint(data: Record<string, unknown>): DupFingerprint {
  const precoRaw = data["preço"];
  return {
    nome: normalizeLookupName(data.nome),
    codigo: data.codigo_produto != null ? String(data.codigo_produto).trim() : "",
    preco:
      typeof precoRaw === "number" && Number.isFinite(precoRaw)
        ? Number(precoRaw)
        : null,
  };
}

/** Duplicata = 2 ou mais campos iguais entre nome, codigo_produto e preço. */
function countDupFieldMatches(a: DupFingerprint, b: DupFingerprint): number {
  let matches = 0;
  if (a.codigo && b.codigo && a.codigo === b.codigo) matches += 1;
  if (a.nome && b.nome && a.nome === b.nome) matches += 1;
  if (a.preco != null && b.preco != null && a.preco === b.preco) matches += 1;
  return matches;
}

function isDupMatch(a: DupFingerprint, b: DupFingerprint): boolean {
  return countDupFieldMatches(a, b) >= 2;
}

function describeDupMatch(a: DupFingerprint, b: DupFingerprint): string {
  const parts: string[] = [];
  if (a.codigo && b.codigo && a.codigo === b.codigo) parts.push("codigo_produto");
  if (a.nome && b.nome && a.nome === b.nome) parts.push("nome");
  if (a.preco != null && b.preco != null && a.preco === b.preco) parts.push("preço");
  return parts.join("+");
}

async function loadEmpresaDupIndex(
  empresaId: string
): Promise<DupFingerprint[]> {
  const all: DupFingerprint[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 500000; offset += pageSize) {
    const res = await agilizeFetch(
      `eprodutos?select=id,nome,codigo_produto,pre%C3%A7o&empresa=eq.${encodeURIComponent(
        empresaId
      )}&order=id.asc&limit=${pageSize}&offset=${offset}`,
      { method: "GET" }
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{
      id: number;
      nome: string | null;
      codigo_produto: string | null;
      preço: number | null;
    }>;
    if (!rows.length) break;
    for (const row of rows) {
      all.push({
        id: Number(row.id),
        nome: normalizeLookupName(row.nome),
        codigo:
          row.codigo_produto != null ? String(row.codigo_produto).trim() : "",
        preco:
          row.preço != null && Number.isFinite(Number(row.preço))
            ? Number(row.preço)
            : null,
      });
    }
    if (rows.length < pageSize) break;
  }
  return all;
}

function findDupInIndex(
  candidate: DupFingerprint,
  index: DupFingerprint[]
): DupFingerprint | null {
  for (const existing of index) {
    if (isDupMatch(candidate, existing)) return existing;
  }
  return null;
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
  const duplicates: Array<{
    row: number;
    codigo_produto: string;
    matchFields?: string;
    existingId?: number;
  }> = [];
  const willUpdate: Array<{
    row: number;
    codigo_produto: string;
    matchFields?: string;
    existingId?: number;
  }> = [];
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
  await ensureCategoriasFromRows(empresaId, sanitized, catMap, {
    createMissing: false,
    warnings,
  });
  await ensureMarcasFromRows(empresaId, sanitized, marcaByName, marcaById, {
    createMissing: false,
    warnings,
  });
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

  // Duplicata = 2+ campos iguais entre nome, codigo_produto e preço
  const existingIndex = await loadEmpresaDupIndex(empresaId);
  const sheetSeen: DupFingerprint[] = [];

  let insertCount = 0;
  for (const item of sanitized) {
    const fp = productDupFingerprint(item.data);
    const codigo = fp.codigo;
    const sheetHit = findDupInIndex(fp, sheetSeen);
    const dbHit = findDupInIndex(fp, existingIndex);

    if (sheetHit) {
      const matchFields = describeDupMatch(fp, sheetHit);
      duplicates.push({
        row: item.rowNum,
        codigo_produto: codigo,
        matchFields: `planilha(${matchFields})`,
      });
      warnings.push({
        row: item.rowNum,
        warning: `Duplicata na própria planilha por ${matchFields}`,
      });
      continue;
    }

    if (dbHit) {
      const matchFields = describeDupMatch(fp, dbHit);
      if (duplicateMode === "overwrite") {
        willUpdate.push({
          row: item.rowNum,
          codigo_produto: codigo,
          matchFields,
          existingId: dbHit.id,
        });
        warnings.push({
          row: item.rowNum,
          warning: `Será SOBRESCRITO (match ${matchFields}${
            dbHit.id != null ? `, id=${dbHit.id}` : ""
          })`,
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
        duplicates.push({
          row: item.rowNum,
          codigo_produto: codigo,
          matchFields,
          existingId: dbHit.id,
        });
      }
      continue;
    }

    sheetSeen.push(fp);

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

/**
 * PostgREST (PGRST102): em INSERT de array, todas as linhas precisam ter
 * exatamente as mesmas chaves. Preenche ausentes com null.
 */
function alignObjectKeys(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (rows.length <= 1) return rows;
  const keys = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) keys.add(k);
  }
  const ordered = [...keys];
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const k of ordered) {
      out[k] = row[k] !== undefined ? row[k] : null;
    }
    return out;
  });
}

function parseCorrectionOptions(value: unknown): CorrectionOptions {
  const input = (value || {}) as Record<string, unknown>;
  const migrateBarcode = input.migrateBarcode === true;
  return {
    dividePrice: input.dividePrice === true,
    divideCost: input.divideCost === true,
    roundMoney: input.roundMoney === true,
    migrateBarcode,
    clearBarcode: migrateBarcode && input.clearBarcode === true,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isFilled(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

async function loadEmpresaProducts(
  empresaId: string
): Promise<ExistingProduct[]> {
  const all: ExistingProduct[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 500000; offset += pageSize) {
    const res = await agilizeFetch(
      `eprodutos?select=id,nome,pre%C3%A7o,custo_unit,codigo_barras,codigo_produto&empresa=eq.${encodeURIComponent(
        empresaId
      )}&order=id.asc&limit=${pageSize}&offset=${offset}`,
      { method: "GET" }
    );
    if (!res.ok) {
      throw new Error(
        `Falha ao carregar produtos da empresa (HTTP ${res.status})`
      );
    }
    const rows = (await res.json()) as ExistingProduct[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

function addToIndex(
  index: Map<string, ExistingProduct[]>,
  key: string,
  product: ExistingProduct
) {
  if (!key) return;
  const current = index.get(key) || [];
  current.push(product);
  index.set(key, current);
}

function uniqueProducts(items: ExistingProduct[]): ExistingProduct[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

async function createCorrectionRowToken(
  empresaId: string,
  targetId: number,
  patch: Record<string, unknown>,
  expected: Record<string, unknown>
): Promise<string> {
  const payload = JSON.stringify({
    empresaId,
    targetId,
    patch,
    expected,
    exp: Date.now() + DRY_RUN_TTL_MS,
  });
  const { key } = getAgilizeConfig();
  const sig = await sha256Hex(`${payload}|${key}`);
  return btoa(JSON.stringify({ payload, sig }));
}

async function verifyCorrectionRowToken(token: string): Promise<{
  empresaId: string;
  targetId: number;
  patch: Record<string, unknown>;
  expected: Record<string, unknown>;
}> {
  try {
    const parsed = JSON.parse(atob(token));
    const payload = String(parsed.payload || "");
    const { key } = getAgilizeConfig();
    const expected = await sha256Hex(`${payload}|${key}`);
    if (parsed.sig !== expected) throw new Error("assinatura inválida");
    const data = JSON.parse(payload);
    if (
      !data.empresaId ||
      !Number.isFinite(Number(data.targetId)) ||
      !data.patch ||
      typeof data.patch !== "object" ||
      !data.expected ||
      typeof data.expected !== "object" ||
      Date.now() > Number(data.exp)
    ) {
      throw new Error("conteúdo inválido ou expirado");
    }
    return {
      empresaId: String(data.empresaId),
      targetId: Number(data.targetId),
      patch: data.patch as Record<string, unknown>,
      expected: data.expected as Record<string, unknown>,
    };
  } catch {
    throw new Error(
      "Autorização da prévia inválida ou expirada. Execute a prévia novamente."
    );
  }
}

async function correctionDryRun(
  empresaId: string,
  rows: ProductRow[],
  options: CorrectionOptions
) {
  if (!empresaId) throw new Error("empresaId obrigatório");
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Nenhuma linha para corrigir");
  }
  if (
    !options.dividePrice &&
    !options.divideCost &&
    !options.roundMoney &&
    !options.migrateBarcode
  ) {
    throw new Error("Selecione ao menos uma correção");
  }

  const products = await loadEmpresaProducts(empresaId);
  const byCode = new Map<string, ExistingProduct[]>();
  const byBarcode = new Map<string, ExistingProduct[]>();
  const byName = new Map<string, ExistingProduct[]>();

  for (const product of products) {
    addToIndex(
      byCode,
      normalizeCodigoValue(product.codigo_produto),
      product
    );
    addToIndex(
      byBarcode,
      normalizeCodigoValue(product.codigo_barras),
      product
    );
    addToIndex(byName, normalizeLookupName(product.nome), product);
  }

  const resolved: Array<{
    row: number;
    source: ProductRow;
    product: ExistingProduct;
    matchBy: string;
  }> = [];
  const blocked: Array<{ row: number; nome: string; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const source = rows[i];
    const rowNum = source._row ?? i + 1;
    const sourceCode = normalizeCodigoValue(source.codigo_produto);
    const sourceBarcode = normalizeCodigoValue(source.codigo_barras);
    const sourceName = normalizeLookupName(source.nome);

    let candidates: ExistingProduct[] = [];
    let matchBy = "";
    if (sourceCode) {
      candidates = byCode.get(sourceCode) || [];
      matchBy = "codigo_produto";
    }
    if (candidates.length === 0 && sourceBarcode) {
      candidates = uniqueProducts([
        ...(byBarcode.get(sourceBarcode) || []),
        ...(byCode.get(sourceBarcode) || []),
      ]);
      matchBy = "codigo_barras";
    }
    if (candidates.length === 0 && sourceName) {
      candidates = byName.get(sourceName) || [];
      matchBy = "nome exato";
    }

    if (candidates.length === 0) {
      blocked.push({
        row: rowNum,
        nome: String(source.nome || ""),
        reason: "Produto não encontrado nesta empresa",
      });
      continue;
    }
    if (candidates.length > 1) {
      blocked.push({
        row: rowNum,
        nome: String(source.nome || ""),
        reason: `Correspondência ambígua por ${matchBy}: ${candidates.length} produtos`,
      });
      continue;
    }
    resolved.push({
      row: rowNum,
      source,
      product: candidates[0],
      matchBy,
    });
  }

  const targetCounts = new Map<number, number>();
  for (const item of resolved) {
    targetCounts.set(
      item.product.id,
      (targetCounts.get(item.product.id) || 0) + 1
    );
  }

  const targets: Array<Record<string, unknown>> = [];
  let priceChanges = 0;
  let costChanges = 0;
  let barcodeChanges = 0;
  let unchanged = 0;

  for (const item of resolved) {
    if ((targetCounts.get(item.product.id) || 0) > 1) {
      blocked.push({
        row: item.row,
        nome: String(item.source.nome || item.product.nome || ""),
        reason: "Mais de uma linha da planilha aponta para o mesmo produto",
      });
      continue;
    }

    const patch: Record<string, unknown> = {};
    const changes: string[] = [];
    const current = {
      preço: item.product.preço,
      custo_unit: item.product.custo_unit,
      codigo_produto: item.product.codigo_produto,
      codigo_barras: item.product.codigo_barras,
    };

    if (
      (options.dividePrice || options.roundMoney) &&
      isFilled(item.source.preço)
    ) {
      const parsed = toNumber(item.source.preço);
      if (parsed === null) {
        blocked.push({
          row: item.row,
          nome: String(item.source.nome || item.product.nome || ""),
          reason: `Preço inválido: "${item.source.preço}"`,
        });
        continue;
      }
      if (parsed < 0) {
        blocked.push({
          row: item.row,
          nome: String(item.source.nome || item.product.nome || ""),
          reason: "Preço não pode ser negativo",
        });
        continue;
      }
      if (parsed > 0) {
        let next = parsed;
        if (options.dividePrice) {
          next = Math.max(next / 100, 0.1);
        }
        if (options.roundMoney) next = roundMoney(next);
        if (Number(item.product.preço) !== next) {
          patch["preço"] = next;
          changes.push("preço");
        }
      }
    }

    if (
      (options.divideCost || options.roundMoney) &&
      isFilled(item.source.custo_unit)
    ) {
      const parsed = toNumber(item.source.custo_unit);
      if (parsed === null) {
        blocked.push({
          row: item.row,
          nome: String(item.source.nome || item.product.nome || ""),
          reason: `Custo inválido: "${item.source.custo_unit}"`,
        });
        continue;
      }
      if (parsed < 0) {
        blocked.push({
          row: item.row,
          nome: String(item.source.nome || item.product.nome || ""),
          reason: "Custo unitário não pode ser negativo",
        });
        continue;
      }
      if (parsed > 0) {
        let next = parsed;
        if (options.divideCost) {
          next = Math.max(next / 100, 0.1);
        }
        if (options.roundMoney) next = roundMoney(next);
        if (Number(item.product.custo_unit) !== next) {
          patch.custo_unit = next;
          changes.push("custo_unit");
        }
      }
    }

    if (options.migrateBarcode) {
      const barcode =
        normalizeCodigoValue(item.source.codigo_barras) ||
        normalizeCodigoValue(item.product.codigo_barras);
      if (barcode) {
        const owners = (byCode.get(barcode) || []).filter(
          (owner) => owner.id !== item.product.id
        );
        if (owners.length > 0) {
          blocked.push({
            row: item.row,
            nome: String(item.source.nome || item.product.nome || ""),
            reason: `Código ${barcode} já pertence a outro produto desta empresa`,
          });
          continue;
        }
        if (normalizeCodigoValue(item.product.codigo_produto) !== barcode) {
          patch.codigo_produto = barcode;
          changes.push("codigo_produto");
        }
        if (options.clearBarcode && item.product.codigo_barras != null) {
          patch.codigo_barras = null;
          changes.push("codigo_barras");
        }
      }
    }

    if (changes.length === 0) {
      unchanged += 1;
      continue;
    }

    targets.push({
      row: item.row,
      targetId: item.product.id,
      nome: item.product.nome,
      matchBy: item.matchBy,
      current,
      proposed: { ...current, ...patch },
      changes,
      token: await createCorrectionRowToken(
        empresaId,
        item.product.id,
        patch,
        current
      ),
    });
    if (changes.includes("preço")) priceChanges += 1;
    if (changes.includes("custo_unit")) costChanges += 1;
    if (
      changes.includes("codigo_produto") ||
      changes.includes("codigo_barras")
    ) {
      barcodeChanges += 1;
    }
  }

  return {
    ok: true,
    empresaId,
    options,
    totals: {
      spreadsheet: rows.length,
      productsInCompany: products.length,
      ready: targets.length,
      blocked: blocked.length,
      unchanged,
      priceChanges,
      costChanges,
      barcodeChanges,
    },
    targets,
    blocked,
  };
}

async function correctionBatch(
  empresaId: string,
  targets: Array<{ row?: number; nome?: string; token?: string }>
) {
  if (!empresaId) throw new Error("empresaId obrigatório");
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("Lote de correção vazio");
  }
  if (targets.length > MAX_BATCH) {
    throw new Error(`Máximo de ${MAX_BATCH} correções por lote`);
  }

  const updated: Array<{ row: number; id: number; nome: string }> = [];
  const errors: Array<{ row: number; error: string }> = [];
  const chunkSize = 5;

  const sameValue = (field: string, left: unknown, right: unknown) => {
    if (left == null && right == null) return true;
    if (field === "preço" || field === "custo_unit") {
      return Number(left) === Number(right);
    }
    if (field === "codigo_produto" || field === "codigo_barras") {
      return normalizeCodigoValue(left) === normalizeCodigoValue(right);
    }
    return left === right;
  };

  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (target) => {
        const row = Number(target.row) || 0;
        try {
          const authorized = await verifyCorrectionRowToken(
            String(target.token || "")
          );
          if (authorized.empresaId !== empresaId) {
            throw new Error("Empresa da prévia difere da empresa selecionada");
          }
          const currentRes = await agilizeFetch(
            `eprodutos?id=eq.${authorized.targetId}&empresa=eq.${encodeURIComponent(
              empresaId
            )}&select=id,pre%C3%A7o,custo_unit,codigo_produto,codigo_barras`,
            { method: "GET" }
          );
          if (!currentRes.ok) {
            throw new Error(
              `Não foi possível reconferir o produto (HTTP ${currentRes.status})`
            );
          }
          const currentRows = await currentRes.json();
          if (!Array.isArray(currentRows) || currentRows.length !== 1) {
            throw new Error("Produto não encontrado nesta empresa");
          }
          const current = currentRows[0] as Record<string, unknown>;
          for (const field of Object.keys(authorized.patch)) {
            if (
              !sameValue(
                field,
                current[field],
                authorized.expected[field]
              )
            ) {
              throw new Error(
                `Campo ${field} foi alterado depois da prévia; gere uma nova prévia`
              );
            }
          }
          const res = await agilizeFetch(
            `eprodutos?id=eq.${authorized.targetId}&empresa=eq.${encodeURIComponent(
              empresaId
            )}`,
            {
              method: "PATCH",
              prefer: "return=representation",
              body: JSON.stringify(authorized.patch),
            }
          );
          if (!res.ok) {
            throw new Error(
              `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
            );
          }
          const data = await res.json();
          if (!Array.isArray(data) || data.length !== 1) {
            throw new Error("Produto não encontrado na empresa no momento da atualização");
          }
          updated.push({
            row,
            id: authorized.targetId,
            nome: String(target.nome || data[0]?.nome || ""),
          });
        } catch (error) {
          errors.push({
            row,
            error: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      })
    );
  }

  return {
    ok: true,
    empresaId,
    updated: updated.length,
    errors: errors.length,
    details: { updated, errors },
  };
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
  await ensureCategoriasFromRows(empresaId, prepared, catMap, {
    createMissing: true,
    warnings: [],
  });
  await ensureMarcasFromRows(empresaId, prepared, marcaByName, marcaById, {
    createMissing: true,
    warnings: [],
  });
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

  const existingIndex = await loadEmpresaDupIndex(empresaId);

  const toInsert: Array<{ rowNum: number; data: Record<string, unknown> }> =
    [];
  const toUpdate: Array<{
    rowNum: number;
    id: number;
    data: Record<string, unknown>;
  }> = [];

  for (const item of prepared) {
    const fp = productDupFingerprint(item.data);
    const hit = findDupInIndex(fp, existingIndex);
    if (hit && hit.id != null) {
      if (duplicateMode === "overwrite") {
        toUpdate.push({ rowNum: item.rowNum, id: hit.id, data: item.data });
      } else {
        skipped.push({
          row: item.rowNum,
          reason: `Duplicata por ${describeDupMatch(fp, hit)} (id=${hit.id})`,
        });
      }
      continue;
    }
    toInsert.push(item);
  }

  if (toInsert.length > 0) {
    // Alinha chaves do lote — evita PGRST102 "All object keys must match"
    const payload = alignObjectKeys(toInsert.map((t) => t.data));
    const res = await agilizeFetch("eprodutos", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify(payload),
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
    const correctionOptions = parseCorrectionOptions(body?.correctionOptions);
    const correctionTargets = Array.isArray(body?.targets)
      ? body.targets
      : [];

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

    if (action === "correction_dry_run") {
      const result = await correctionDryRun(
        empresaId,
        rows,
        correctionOptions
      );
      return jsonResponse(result);
    }

    if (action === "correction_batch") {
      const result = await correctionBatch(
        empresaId,
        correctionTargets
      );
      return jsonResponse(result);
    }

    return jsonResponse(
      {
        error:
          "action inválida. Use: validate_empresa | dry_run | import_batch | correction_dry_run | correction_batch",
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
