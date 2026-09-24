import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMPRESA_FIELDS = [
  "nome",
  "cnpj",
  "telefone",
  "email",
  "categoria",
  "origem",
  "endereço",
  "n do endereço",
  "bairro",
  "cidade",
  "estado",
  "cep",
  "inscrição estadual",
  "site",
  "setor",
  "tamanho",
  "observações",
  "desativado",
  "produto/serviço",
  "responsável",
  "logradouro",
  "cod municp ibge",
] as const;

const CONTATO_FIELDS = [
  "nome",
  "telefone",
  "Email",
  "cnpj ou cpf",
  "categoria",
  "origem",
  "cargo",
  "departamento",
  "empresa do contato",
  "endereço",
  "n do endereço",
  "bairro",
  "cidade",
  "estado",
  "CEP",
  "complemento",
  "rua",
  "observações",
  "desativado",
] as const;

type Tipo = "contato" | "empresa";
type Row = Record<string, unknown> & { _row?: number };

const MAX_BATCH = 50;
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

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function parseBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "s"].includes(s)) return true;
  if (["false", "0", "nao", "não", "no", "n"].includes(s)) return false;
  return null;
}

function bubbleUniqueId(): string {
  const rand = Math.floor(Math.random() * 1e18)
    .toString()
    .padStart(18, "0");
  return `${Date.now()}x${rand}`;
}

function tableFor(tipo: Tipo): string {
  return tipo === "empresa" ? "empresa-do-contato" : "contato";
}

function allowedFor(tipo: Tipo): readonly string[] {
  return tipo === "empresa" ? EMPRESA_FIELDS : CONTATO_FIELDS;
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

  const contatoCount = await countExact(
    `contato?select=ID&empresa=eq.${encodeURIComponent(id)}&limit=1`
  );
  const empresaContatoCount = await countExact(
    `empresa-do-contato?select=ID&empresa=eq.${encodeURIComponent(id)}&limit=1`
  );
  const productCount = await countExact(
    `eprodutos?select=id&empresa=eq.${encodeURIComponent(id)}&limit=1`
  );

  const sampleRes = await agilizeFetch(
    `contato?select=ID,nome,telefone,categoria&empresa=eq.${encodeURIComponent(id)}&order=ID.desc&limit=3`
  );
  const sample = sampleRes.ok ? await sampleRes.json() : [];

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
    contatoCount,
    empresaContatoCount,
    productCount,
    sample,
    nameWarning,
  };
}

type Existing = {
  id: number;
  nome: string;
  keyDoc: string;
  keyPhone: string;
  keyEmail: string;
  uniqueid: string;
};

async function loadExisting(tipo: Tipo, empresaId: string): Promise<Existing[]> {
  const all: Existing[] = [];
  const pageSize = 1000;
  const select =
    tipo === "empresa"
      ? "ID,nome,cnpj,telefone,email,uniqueid"
      : "ID,nome,telefone,Email,cnpj%20ou%20cpf,uniqueid";
  for (let offset = 0; offset < 200000; offset += pageSize) {
    const res = await agilizeFetch(
      `${tableFor(tipo)}?select=${select}&empresa=eq.${encodeURIComponent(empresaId)}&order=ID.asc&limit=${pageSize}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    for (const row of rows) {
      const doc =
        tipo === "empresa" ? digits(row.cnpj) : digits(row["cnpj ou cpf"]);
      const email =
        tipo === "empresa"
          ? norm(row.email)
          : norm(row.Email);
      all.push({
        id: Number(row.ID),
        nome: norm(row.nome),
        keyDoc: doc.length >= 11 ? doc : "",
        keyPhone: digits(row.telefone).length >= 8 ? digits(row.telefone) : "",
        keyEmail: email.includes("@") ? email : "",
        uniqueid: String(row.uniqueid ?? ""),
      });
    }
    if (rows.length < pageSize) break;
  }
  return all;
}

function matchExisting(row: Record<string, unknown>, tipo: Tipo, index: Existing[]) {
  const nome = norm(row.nome);
  const doc =
    tipo === "empresa" ? digits(row.cnpj) : digits(row["cnpj ou cpf"]);
  const phone = digits(row.telefone);
  const email = norm(tipo === "empresa" ? row.email : row.Email);
  for (const ex of index) {
    if (doc.length >= 11 && ex.keyDoc && doc === ex.keyDoc) {
      return { ex, by: "documento" };
    }
  }
  for (const ex of index) {
    if (phone.length >= 8 && ex.keyPhone && phone === ex.keyPhone) {
      return { ex, by: "telefone" };
    }
  }
  for (const ex of index) {
    if (email.includes("@") && ex.keyEmail && email === ex.keyEmail) {
      return { ex, by: "email" };
    }
  }
  for (const ex of index) {
    if (nome && ex.nome && nome === ex.nome) return { ex, by: "nome" };
  }
  return null;
}

function sanitize(tipo: Tipo, raw: Row): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const allowed = new Set(allowedFor(tipo));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === "_row" || !allowed.has(key)) continue;
    if (val == null || String(val).trim() === "") continue;
    if (key === "desativado") {
      const b = parseBool(val);
      if (b == null) return { ok: false, error: `desativado inválido: "${val}"` };
      out[key] = b;
      continue;
    }
    out[key] = String(val).trim();
  }
  if (!String(out.nome ?? "").trim()) {
    return { ok: false, error: "nome é obrigatório" };
  }
  if (!out.categoria) out.categoria = "Cliente";
  return { ok: true, data: out };
}

async function loadEmpresaNomeIndex(empresaId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const pageSize = 1000;
  for (let offset = 0; offset < 200000; offset += pageSize) {
    const res = await agilizeFetch(
      `empresa-do-contato?select=nome,uniqueid&empresa=eq.${encodeURIComponent(empresaId)}&order=ID.asc&limit=${pageSize}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{ nome?: string; uniqueid?: string }>;
    if (!rows.length) break;
    for (const row of rows) {
      const key = norm(row.nome);
      if (key && row.uniqueid && !map.has(key)) map.set(key, row.uniqueid);
    }
    if (rows.length < pageSize) break;
  }
  return map;
}

function fingerprint(empresaId: string, tipo: Tipo, rows: Row[]): string {
  const parts = rows.map((r) => `${r.nome ?? ""}|${r.telefone ?? ""}|${r.cnpj ?? ""}`);
  return `${empresaId}::${tipo}::${rows.length}::${parts.join(";;").slice(0, 4000)}`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createSessionToken(empresaId: string, tipo: Tipo, rows: Row[]) {
  const exp = Date.now() + DRY_RUN_TTL_MS;
  const hash = await sha256Hex(fingerprint(empresaId, tipo, rows));
  const payload = JSON.stringify({ empresaId, tipo, exp, hash, n: rows.length });
  const { key } = getAgilizeConfig();
  const sig = await sha256Hex(`${payload}|${key}`);
  return btoa(JSON.stringify({ payload, sig }));
}

async function verifySessionToken(
  token: string,
  empresaId: string,
  tipo: Tipo,
  rows: Row[]
) {
  try {
    const parsed = JSON.parse(atob(token));
    const { key } = getAgilizeConfig();
    const expectedSig = await sha256Hex(`${parsed.payload}|${key}`);
    if (parsed.sig !== expectedSig) return false;
    const data = JSON.parse(parsed.payload);
    if (data.empresaId !== empresaId || data.tipo !== tipo) return false;
    if (Date.now() > data.exp) return false;
    if (rows.length === data.n) {
      const hash = await sha256Hex(fingerprint(empresaId, tipo, rows));
      return hash === data.hash;
    }
    return true;
  } catch {
    return false;
  }
}

async function dryRun(
  empresaId: string,
  tipo: Tipo,
  rows: Row[],
  duplicateMode: "skip" | "overwrite"
) {
  if (!rows.length) throw new Error("Nenhuma linha para validar");
  if (rows.length > 5000) throw new Error("Máximo de 5000 linhas por validação");

  const index = await loadExisting(tipo, empresaId);
  const valid: Array<{ row: number; data: Record<string, unknown> }> = [];
  const invalid: Array<{ row: number; error: string }> = [];
  const duplicates: Array<{ row: number; nome: string; matchBy: string; existingId: number }> = [];
  const willUpdate: Array<{ row: number; nome: string; matchBy: string; existingId: number }> = [];
  const warnings: Array<{ row: number; warning: string }> = [];

  const seen = new Set<string>();
  for (const raw of rows) {
    const rowNum = Number(raw._row) || 0;
    const parsed = sanitize(tipo, raw);
    if (!parsed.ok) {
      invalid.push({ row: rowNum, error: parsed.error });
      continue;
    }
    const localKey = [
      norm(parsed.data.nome),
      digits(parsed.data.telefone || parsed.data.cnpj || parsed.data["cnpj ou cpf"]),
    ].join("|");
    if (seen.has(localKey)) {
      invalid.push({ row: rowNum, error: "Linha repetida na própria planilha" });
      continue;
    }
    seen.add(localKey);

    const hit = matchExisting(parsed.data, tipo, index);
    if (hit) {
      const item = {
        row: rowNum,
        nome: String(parsed.data.nome),
        matchBy: hit.by,
        existingId: hit.ex.id,
      };
      if (duplicateMode === "overwrite") willUpdate.push(item);
      else duplicates.push(item);
    }
    valid.push({ row: rowNum, data: parsed.data });
  }

  return {
    ok: true,
    empresaId,
    tipo,
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
    sessionToken: await createSessionToken(empresaId, tipo, rows),
  };
}

async function importBatch(
  empresaId: string,
  tipo: Tipo,
  rows: Row[],
  sessionToken: string,
  duplicateMode: "skip" | "overwrite"
) {
  if (rows.length > MAX_BATCH) {
    throw new Error(`Máximo de ${MAX_BATCH} linhas por lote`);
  }
  const trusted = await verifySessionToken(sessionToken, empresaId, tipo, rows);
  if (!trusted) {
    throw new Error("Sessão de validação expirada. Rode a validação de novo.");
  }

  const index = await loadExisting(tipo, empresaId);
  const empresaNomes =
    tipo === "contato" ? await loadEmpresaNomeIndex(empresaId) : new Map<string, string>();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (const raw of rows) {
    const rowNum = Number(raw._row) || 0;
    const parsed = sanitize(tipo, raw);
    if (!parsed.ok) {
      errors.push({ row: rowNum, error: parsed.error });
      continue;
    }
    const data = { ...parsed.data };
    if (tipo === "contato" && data["empresa do contato"]) {
      const linked = empresaNomes.get(norm(data["empresa do contato"]));
      if (!linked) {
        errors.push({
          row: rowNum,
          error: `Empresa do contato não encontrada nesta empresa: "${data["empresa do contato"]}"`,
        });
        continue;
      }
      data["empresa do contato"] = linked;
    }

    const hit = matchExisting(data, tipo, index);
    if (hit && duplicateMode === "skip") {
      skipped++;
      continue;
    }

    if (hit && duplicateMode === "overwrite") {
      const res = await agilizeFetch(
        `${tableFor(tipo)}?ID=eq.${hit.ex.id}&empresa=eq.${encodeURIComponent(empresaId)}`,
        { method: "PATCH", body: JSON.stringify(data) }
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

    const payload = {
      ...data,
      empresa: empresaId,
      "Creation Date": new Date().toISOString(),
      uniqueid: bubbleUniqueId(),
      import: "agilize-import",
    };
    const res = await agilizeFetch(tableFor(tipo), {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      errors.push({
        row: rowNum,
        error: `Insert falhou (HTTP ${res.status}): ${(await res.text()).slice(0, 180)}`,
      });
      continue;
    }
    const created = await res.json();
    const id = Number(created?.[0]?.ID);
    index.push({
      id,
      nome: norm(data.nome),
      keyDoc:
        tipo === "empresa"
          ? digits(data.cnpj).length >= 11
            ? digits(data.cnpj)
            : ""
          : digits(data["cnpj ou cpf"]).length >= 11
            ? digits(data["cnpj ou cpf"])
            : "",
      keyPhone: digits(data.telefone).length >= 8 ? digits(data.telefone) : "",
      keyEmail: norm(tipo === "empresa" ? data.email : data.Email).includes("@")
        ? norm(tipo === "empresa" ? data.email : data.Email)
        : "",
      uniqueid: String(payload.uniqueid),
    });
    if (tipo === "empresa" && payload.uniqueid) {
      empresaNomes.set(norm(data.nome), String(payload.uniqueid));
    }
    inserted++;
  }

  return { ok: true, inserted, updated, skipped, errors: errors.length, details: { errors } };
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
    const tipo: Tipo = body?.tipo === "empresa" ? "empresa" : "contato";
    const rows = (Array.isArray(body?.rows) ? body.rows : []) as Row[];
    const duplicateMode = body?.duplicateMode === "overwrite" ? "overwrite" : "skip";

    if (action === "validate_empresa") {
      return jsonResponse(
        await validateEmpresa(empresaId, body?.empresaNome ? String(body.empresaNome) : undefined)
      );
    }
    if (action === "dry_run") {
      if (!empresaId) return jsonResponse({ error: "empresaId obrigatório" }, 400);
      return jsonResponse(await dryRun(empresaId, tipo, rows, duplicateMode));
    }
    if (action === "import_batch") {
      if (!empresaId) return jsonResponse({ error: "empresaId obrigatório" }, 400);
      return jsonResponse(
        await importBatch(empresaId, tipo, rows, String(body?.sessionToken || ""), duplicateMode)
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
