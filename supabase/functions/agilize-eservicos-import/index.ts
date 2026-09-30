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
  "descricao",
  "preço",
  "custo unit",
  "codigo",
  "categoria",
] as const;

type Row = Record<string, unknown> & { _row?: number };

const MAX_BATCH = 50;
const DRY_RUN_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 1000;

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

async function agilizeFetch(path: string, options: RequestInit = {}) {
  const { url, key } = getAgilizeConfig();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  return fetch(`${url}/rest/v1/${path}`, { ...options, headers });
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

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function bubbleUniqueId(): string {
  const rand = Math.floor(Math.random() * 1e18)
    .toString()
    .padStart(18, "0");
  return `${Date.now()}x${rand}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/\s/g, "").replace(/^R\$\s?/i, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function countExact(path: string): Promise<number> {
  const res = await agilizeFetch(path, {
    method: "GET",
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("content-range") || "";
  const total = range.split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

async function bubbleEmpresaNome(id: string): Promise<string | null> {
  const token = Deno.env.get("BUBBLE_AGILIZE_KEY");
  if (!token) return null;
  const res = await fetch(
    `https://app.agilizetotal.com.br/api/1.1/obj/empresa_principal/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const row = (data.response || data) as Record<string, unknown>;
  const nome = row["cad_nome da empresa"];
  return nome ? String(nome) : null;
}

async function validateEmpresa(empresaId: string, empresaNome?: string) {
  const id = empresaId.trim();
  if (!id) throw new Error("Unique ID da empresa é obrigatório");

  let empresaCadastro: { found: boolean; nome?: string } = { found: false };
  const empRes = await agilizeFetch(
    `empresas?select=id,nome%20da%20empresa,unique%20id%20empresa&unique%20id%20empresa=eq.${encodeURIComponent(id)}&limit=1`
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
  if (!empresaCadastro.found) {
    throw new Error(
      "Empresa não encontrada no Agilize Total. Confira o unique ID — sem esse cadastro o serviço não grava."
    );
  }

  const serviceCount = await countExact(
    `servicos?select=id&empresa=eq.${encodeURIComponent(id)}&limit=1`
  );
  const sampleRes = await agilizeFetch(
    `servicos?select=id,nome,codigo,pre%C3%A7o&empresa=eq.${encodeURIComponent(id)}&order=id.desc&limit=3`
  );
  const sample = sampleRes.ok ? await sampleRes.json() : [];

  const nomeBubble = await bubbleEmpresaNome(id);
  if (nomeBubble) {
    empresaCadastro = { ...empresaCadastro, nome: nomeBubble };
  }

  const nameHint = empresaNome?.trim() || null;
  let nameWarning: string | null = null;
  if (
    nameHint &&
    empresaCadastro.found &&
    empresaCadastro.nome &&
    !norm(empresaCadastro.nome).includes(norm(nameHint)) &&
    !norm(nameHint).includes(norm(empresaCadastro.nome))
  ) {
    nameWarning = `Nome informado ("${nameHint}") difere do cadastro ("${empresaCadastro.nome}")`;
  }

  return {
    ok: true,
    empresaId: id,
    empresaNomeInformado: nameHint,
    empresaCadastro,
    serviceCount,
    sample,
    nameWarning,
  };
}

type Existing = {
  id: number;
  nome: string;
  display: string;
  codigo: string;
  uniqueid: string;
  fromThisImport?: boolean;
};

async function loadExisting(empresaId: string): Promise<Existing[]> {
  const all: Existing[] = [];
  for (let offset = 0; offset < 200000; offset += PAGE_SIZE) {
    const res = await agilizeFetch(
      `servicos?select=id,nome,codigo,unique%20id&empresa=eq.${encodeURIComponent(empresaId)}&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    for (const row of rows) {
      all.push({
        id: Number(row.id),
        nome: norm(row.nome),
        display: String(row.nome ?? ""),
        codigo: norm(row.codigo),
        uniqueid: String(row["unique id"] ?? ""),
      });
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

async function loadCategoriaIndex(empresaId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let offset = 0; offset < 200000; offset += PAGE_SIZE) {
    const res = await agilizeFetch(
      `Listas-CRM?select=nome,unique%20id&empresa=eq.${encodeURIComponent(empresaId)}&order=ID.asc&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    for (const row of rows) {
      const key = norm(row.nome);
      const uid = String(row["unique id"] ?? "");
      if (key && uid && !map.has(key)) map.set(key, uid);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return map;
}

function matchExisting(row: Record<string, unknown>, index: Existing[]) {
  const nome = norm(row.nome);
  const codigo = norm(row.codigo);
  if (!nome) return null;
  for (const ex of index) {
    if (codigo) {
      if (ex.nome === nome && ex.codigo === codigo) {
        return { ex, by: "nome e código" };
      }
    } else if (ex.nome === nome) {
      return { ex, by: "nome" };
    }
  }
  return null;
}

function skipReason(by: string, ex: Existing): string {
  const where = ex.fromThisImport
    ? "repetido na própria planilha"
    : "já existe nesta empresa";
  return `${where} pelo ${by}: ${ex.display || "registro " + ex.id}`;
}

function remember(index: Existing[], data: Record<string, unknown>, id: number, uniqueid: string) {
  index.push({
    id,
    nome: norm(data.nome),
    display: String(data.nome ?? ""),
    codigo: norm(data.codigo),
    uniqueid,
    fromThisImport: true,
  });
}

function sanitize(raw: Row): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const allowed = new Set<string>(ALLOWED_FIELDS);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === "_row" || !allowed.has(key)) continue;
    if (val == null || String(val).trim() === "") continue;
    if (key === "preço" || key === "custo unit") {
      const n = toNumber(val);
      if (n == null) return { ok: false, error: `${key} inválido: "${val}"` };
      out[key] = n;
      continue;
    }
    out[key] = String(val).trim();
  }
  if (!String(out.nome ?? "").trim()) {
    return { ok: false, error: "nome é obrigatório" };
  }
  return { ok: true, data: out };
}

function applyCategoria(
  data: Record<string, unknown>,
  categorias: Map<string, string>
): string | null {
  const raw = String(data.categoria ?? "").trim();
  if (!raw) {
    delete data.categoria;
    return null;
  }
  const hit = categorias.get(norm(raw));
  if (hit) {
    data.categoria = hit;
    return null;
  }
  delete data.categoria;
  return `Categoria "${raw}" não existe nas listas desta empresa e ficará vazia.`;
}

function fingerprint(empresaId: string, rows: Row[]): string {
  const parts = rows.map((r) => `${r.nome ?? ""}|${r.codigo ?? ""}|${r["preço"] ?? ""}`);
  return `${empresaId}::${rows.length}::${parts.join(";;").slice(0, 4000)}`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createSessionToken(empresaId: string, rows: Row[]) {
  const exp = Date.now() + DRY_RUN_TTL_MS;
  const hash = await sha256Hex(fingerprint(empresaId, rows));
  const payload = JSON.stringify({ empresaId, exp, hash, n: rows.length });
  const { key } = getAgilizeConfig();
  const sig = await sha256Hex(`${payload}|${key}`);
  return btoa(JSON.stringify({ payload, sig }));
}

async function verifySessionToken(token: string, empresaId: string, rows: Row[]) {
  try {
    const parsed = JSON.parse(atob(token));
    const { key } = getAgilizeConfig();
    const expectedSig = await sha256Hex(`${parsed.payload}|${key}`);
    if (parsed.sig !== expectedSig) return false;
    const data = JSON.parse(parsed.payload);
    if (data.empresaId !== empresaId) return false;
    if (Date.now() > data.exp) return false;
    if (rows.length === data.n) {
      const hash = await sha256Hex(fingerprint(empresaId, rows));
      return hash === data.hash;
    }
    return true;
  } catch {
    return false;
  }
}

async function assertEmpresaExists(empresaId: string) {
  const res = await agilizeFetch(
    `empresas?select=id&unique%20id%20empresa=eq.${encodeURIComponent(empresaId)}&limit=1`
  );
  if (!res.ok) throw new Error("Não foi possível conferir a empresa");
  const rows = await res.json();
  if (!rows?.[0]) {
    throw new Error(
      "Empresa não encontrada no Agilize Total. Confira o unique ID — sem esse cadastro o serviço não grava."
    );
  }
}

async function dryRun(
  empresaId: string,
  rows: Row[],
  duplicateMode: "skip" | "overwrite"
) {
  await assertEmpresaExists(empresaId);
  if (!rows.length) throw new Error("Nenhuma linha para validar");
  if (rows.length > 5000) throw new Error("Máximo de 5000 linhas por validação");

  const index = await loadExisting(empresaId);
  const categorias = await loadCategoriaIndex(empresaId);
  const valid: Array<{ row: number; data: Record<string, unknown> }> = [];
  const invalid: Array<{ row: number; error: string }> = [];
  const duplicates: Array<{ row: number; nome: string; matchBy: string; existingId: number; reason: string }> = [];
  const willUpdate: Array<{ row: number; nome: string; matchBy: string; existingId: number; reason: string }> = [];
  const warnings: Array<{ row: number; warning: string }> = [];

  for (const raw of rows) {
    const rowNum = Number(raw._row) || 0;
    const parsed = sanitize(raw);
    if (!parsed.ok) {
      invalid.push({ row: rowNum, error: parsed.error });
      continue;
    }
    const warning = applyCategoria(parsed.data, categorias);
    if (warning) warnings.push({ row: rowNum, warning });

    const hit = matchExisting(parsed.data, index);
    if (hit) {
      const item = {
        row: rowNum,
        nome: String(parsed.data.nome),
        matchBy: hit.by,
        existingId: hit.ex.id,
        reason: skipReason(hit.by, hit.ex),
      };
      if (duplicateMode === "overwrite" && !hit.ex.fromThisImport) willUpdate.push(item);
      else duplicates.push(item);
      if (!hit.ex.fromThisImport && duplicateMode === "overwrite") {
        valid.push({ row: rowNum, data: parsed.data });
      }
      continue;
    }
    valid.push({ row: rowNum, data: parsed.data });
    remember(index, parsed.data, 0, "");
  }

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
    },
    preview: valid.slice(0, 8).map((v) => v.data),
    invalid,
    duplicates,
    willUpdate,
    warnings,
    sessionToken: await createSessionToken(empresaId, rows),
  };
}

function insertPayload(empresaId: string, data: Record<string, unknown>, uniqueid: string) {
  return {
    ...data,
    empresa: empresaId,
    "unique id": uniqueid,
    cod_import: "agilize-import",
  };
}

async function importBatch(
  empresaId: string,
  rows: Row[],
  sessionToken: string,
  duplicateMode: "skip" | "overwrite"
) {
  if (rows.length > MAX_BATCH) {
    throw new Error(`Máximo de ${MAX_BATCH} linhas por lote`);
  }
  await assertEmpresaExists(empresaId);
  const trusted = await verifySessionToken(sessionToken, empresaId, rows);
  if (!trusted) {
    throw new Error("Sessão de validação expirada. Rode a validação de novo.");
  }

  const index = await loadExisting(empresaId);
  const categorias = await loadCategoriaIndex(empresaId);
  let inserted = 0;
  let updated = 0;
  const skipped: Array<{ row: number; nome: string; reason: string }> = [];
  const insertedRows: Array<{ row: number; nome: string; id: number }> = [];
  const errors: Array<{ row: number; error: string }> = [];
  const warnings: Array<{ row: number; warning: string }> = [];

  for (const raw of rows) {
    const rowNum = Number(raw._row) || 0;
    const parsed = sanitize(raw);
    if (!parsed.ok) {
      errors.push({ row: rowNum, error: parsed.error });
      continue;
    }
    const data = { ...parsed.data };
    const warning = applyCategoria(data, categorias);
    if (warning) warnings.push({ row: rowNum, warning });

    const hit = matchExisting(data, index);
    if (hit && (duplicateMode === "skip" || hit.ex.fromThisImport)) {
      skipped.push({
        row: rowNum,
        nome: String(data.nome ?? ""),
        reason: skipReason(hit.by, hit.ex),
      });
      continue;
    }

    if (hit && duplicateMode === "overwrite") {
      const res = await agilizeFetch(
        `servicos?id=eq.${hit.ex.id}&empresa=eq.${encodeURIComponent(empresaId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...data, cod_import: "agilize-import" }),
        }
      );
      if (!res.ok) {
        errors.push({
          row: rowNum,
          error: `Update falhou (HTTP ${res.status}): ${(await res.text()).slice(0, 180)}`,
        });
        continue;
      }
      updated++;
      continue;
    }

    const uniqueid = bubbleUniqueId();
    const res = await agilizeFetch("servicos", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(insertPayload(empresaId, data, uniqueid)),
    });
    if (!res.ok) {
      errors.push({
        row: rowNum,
        error: `Insert falhou (HTTP ${res.status}): ${(await res.text()).slice(0, 180)}`,
      });
      continue;
    }
    const created = await res.json();
    const id = Number(created?.[0]?.id);
    remember(index, data, id, uniqueid);
    insertedRows.push({ row: rowNum, nome: String(data.nome ?? ""), id });
    inserted++;
  }

  return {
    ok: true,
    inserted,
    updated,
    skipped: skipped.length,
    errors: errors.length,
    details: { errors, skipped, inserted: insertedRows, warnings },
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
    if (!authHeader) return jsonResponse({ error: "Authorization obrigatório" }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return jsonResponse({ error: "Não autenticado. Faça login novamente." }, 401);
    }
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      await assertSuperAdmin(createClient(supabaseUrl, serviceKey), user.id);
    } else {
      await assertSuperAdmin(supabase, user.id);
    }

    const body = await req.json();
    const action = String(body?.action || "");
    const empresaId = String(body?.empresaId || "").trim();
    const rows = (Array.isArray(body?.rows) ? body.rows : []) as Row[];
    const duplicateMode = body?.duplicateMode === "overwrite" ? "overwrite" : "skip";

    if (action === "validate_empresa") {
      return jsonResponse(
        await validateEmpresa(empresaId, body?.empresaNome ? String(body.empresaNome) : undefined)
      );
    }
    if (action === "dry_run") {
      if (!empresaId) return jsonResponse({ error: "empresaId obrigatório" }, 400);
      return jsonResponse(await dryRun(empresaId, rows, duplicateMode));
    }
    if (action === "import_batch") {
      if (!empresaId) return jsonResponse({ error: "empresaId obrigatório" }, 400);
      return jsonResponse(
        await importBatch(empresaId, rows, String(body?.sessionToken || ""), duplicateMode)
      );
    }
    return jsonResponse(
      { error: "action inválida. Use: validate_empresa | dry_run | import_batch" },
      400
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const status = message.includes("Acesso negado") ? 403 : 400;
    return jsonResponse({ error: message }, status);
  }
});
