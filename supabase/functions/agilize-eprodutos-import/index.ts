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

function parseBoolFlag(val: unknown): boolean {
  return isTruthyFlag(val);
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

/** Aceita chaves sem acento / aliases vindos do CSV do Excel */
function pickRawField(raw: ProductRow, field: AllowedField): unknown {
  if (raw[field] !== undefined && raw[field] !== null && raw[field] !== "") {
    return raw[field];
  }
  const aliases: Record<string, string[]> = {
    preço: ["preco", "preÃ§o", "price", "valor"],
    preço_atacado: ["preco_atacado", "preÃ§o_atacado"],
  };
  for (const alt of aliases[field] || []) {
    const v = (raw as Record<string, unknown>)[alt];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return raw[field];
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

  const numericFields: AllowedField[] = [
    "preço",
    "preço_atacado",
    "qnt_ideal",
    "qntd",
    "qntd_baixa",
    "total_custo",
    "total_venda",
    "custo_unit",
    "origem_produto",
  ];

  for (const field of ALLOWED_FIELDS) {
    if (field === "nome") continue;
    let val = pickRawField(raw, field);
    if (val === undefined || val === null) continue;
    // Células vazias / só espaço no Excel → ignorar (não invalidar)
    if (typeof val === "string" && val.trim() === "") continue;

    if (numericFields.includes(field)) {
      const n = toNumber(val);
      if (n === null) {
        return {
          ok: false,
          error: `Campo '${field}' inválido: "${val}" (precisa ser número ou ficar em branco)`,
        };
      }
      out[field] = n;
    } else if (field === "produto_filho" || field === "desativado") {
      out[field] = parseBoolFlag(val);
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

async function fetchExistingCodigos(
  empresaId: string,
  codigos: string[]
): Promise<Set<string>> {
  const existing = new Set<string>();
  const unique = [...new Set(codigos.filter(Boolean))];
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const filter = chunk.map((c) => `"${String(c).replace(/"/g, "")}"`).join(",");
    const res = await agilizeFetch(
      `eprodutos?select=codigo_produto&empresa=eq.${encodeURIComponent(empresaId)}&codigo_produto=in.(${filter})`,
      { method: "GET" }
    );
    if (!res.ok) continue;
    const data = await res.json();
    for (const item of data || []) {
      if (item.codigo_produto != null) {
        existing.add(String(item.codigo_produto));
      }
    }
  }
  return existing;
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

async function dryRun(empresaId: string, rows: ProductRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Nenhuma linha para validar");
  }
  if (rows.length > 5000) {
    throw new Error("Máximo de 5000 linhas por dry-run");
  }

  const valid: Array<{ row: number; data: Record<string, unknown> }> = [];
  const invalid: Array<{ row: number; error: string }> = [];
  const duplicates: Array<{ row: number; codigo_produto: string }> = [];
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

  const codigos = sanitized
    .map((s) =>
      s.data.codigo_produto != null ? String(s.data.codigo_produto) : ""
    )
    .filter(Boolean);
  const existing = await fetchExistingCodigos(empresaId, codigos);

  for (const item of sanitized) {
    const codigo =
      item.data.codigo_produto != null
        ? String(item.data.codigo_produto)
        : "";
    if (codigo && existing.has(codigo)) {
      duplicates.push({ row: item.rowNum, codigo_produto: codigo });
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
      if (isTruthyFlag(item.data.produto_filho)) reasons.push("produto_filho=true");
      warnings.push({
        row: item.rowNum,
        warning: `Não aparece na lista do Bubble (${reasons.join(", ")})`,
      });
    }
    valid.push({ row: item.rowNum, data: item.data });
  }

  const sessionToken = await createSessionToken(empresaId, rows);
  const bubbleImport = countBubbleVisibility(valid.map((v) => v.data));
  const empresaAtual = await countEmpresaVisibility(empresaId);

  return {
    ok: true,
    empresaId,
    totals: {
      total: rows.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
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
      total: empresaAtual.total + valid.length,
      visibleToUser:
        empresaAtual.visibleToUser + bubbleImport.visibleToUser,
    },
    preview: valid.slice(0, 20).map((v) => v.data),
    invalid: invalid.slice(0, 100),
    duplicates: duplicates.slice(0, 100),
    warnings: warnings.slice(0, 100),
    sessionToken,
  };
}

async function importBatch(
  empresaId: string,
  rows: ProductRow[],
  sessionToken: string
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

  const codigos = prepared
    .map((p) =>
      p.data.codigo_produto != null ? String(p.data.codigo_produto) : ""
    )
    .filter(Boolean);
  const existing = await fetchExistingCodigos(empresaId, codigos);

  const toInsert: Array<{ rowNum: number; data: Record<string, unknown> }> =
    [];
  for (const item of prepared) {
    const codigo =
      item.data.codigo_produto != null
        ? String(item.data.codigo_produto)
        : "";
    if (codigo && existing.has(codigo)) {
      skipped.push({
        row: item.rowNum,
        reason: `Duplicata codigo_produto=${codigo}`,
      });
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
      // Fallback: insert one by one
      for (const item of toInsert) {
        const one = await agilizeFetch("eprodutos", {
          method: "POST",
          prefer: "return=representation",
          body: JSON.stringify(item.data),
        });
        if (!one.ok) {
          const t = await one.text();
          errors.push({
            row: item.rowNum,
            error: t.slice(0, 300) || `HTTP ${one.status}`,
          });
        } else {
          const created = await one.json();
          inserted.push({
            row: item.rowNum,
            id: created?.[0]?.id,
            nome: String(item.data.nome),
          });
        }
      }
      if (inserted.length === 0 && errors.length === toInsert.length) {
        throw new Error(`Falha no INSERT: ${errText.slice(0, 400)}`);
      }
    } else {
      const created = await res.json();
      for (let i = 0; i < toInsert.length; i++) {
        inserted.push({
          row: toInsert[i].rowNum,
          id: created?.[i]?.id,
          nome: String(toInsert[i].data.nome),
        });
      }
    }
  }

  return {
    ok: true,
    empresaId,
    inserted: inserted.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { inserted, skipped, errors },
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

    if (action === "validate_empresa") {
      const result = await validateEmpresa(empresaId, empresaNome);
      return jsonResponse(result);
    }

    if (action === "dry_run") {
      if (!empresaId) {
        return jsonResponse({ error: "empresaId obrigatório" }, 400);
      }
      const result = await dryRun(empresaId, rows);
      return jsonResponse(result);
    }

    if (action === "import_batch") {
      if (!empresaId) {
        return jsonResponse({ error: "empresaId obrigatório" }, 400);
      }
      const result = await importBatch(empresaId, rows, sessionToken);
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
