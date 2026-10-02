import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STORES = {
  triunfo: {
    id: "1707327416537x823751169883766800",
    nome: "Eficaz Celulares - triunfo",
  },
  crimeia: {
    id: "1709832766216x823507549003186200",
    nome: "Eficaz celulares crimeia",
  },
} as const;

type Loja = keyof typeof STORES;

const MIN_COPIAS = 2;
const MAX_DIAS = 31;
const PAGE = 1000;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MATCH_MS = 5 * 1000;

type CartLine = {
  produto: string | null;
  "produto nome": string | null;
  qnt: number | null;
  uniqueid_venda: string | null;
  data_da_venda: string | null;
};

type StockLine = {
  id: number;
  data: string | null;
  produto: string | null;
  nome_produto: string | null;
  qntd: number | null;
  cod: string | null;
  creator_nome: string | null;
};

type ItemVenda = {
  nome: string;
  qnt: number | null;
  dataHora: string | null;
};

type Lancamento = {
  codigo: string | null;
  criadoEm: string | null;
  dataHora: string | null;
  quantidade: number | null;
  ligadoAVenda: boolean;
  autor: string | null;
};

type AlertRow = {
  id: string;
  vendaId: string | null;
  codigoVenda: string | null;
  dataHora: string | null;
  produtoId: string;
  produtoNome: string;
  vezesCarrinho: number;
  vezesSaida: number;
  valorFicha: number | null;
  itensFicha: number | null;
  vezesNaFicha: number;
  autor: string | null;
  gravidade: "atencao" | "critico";
  situacao: "alem_da_ficha" | "ficha_confirma";
  texto: string;
  itensVenda: ItemVenda[];
  lancamentos: Lancamento[];
};

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
      "AGILIZE_TOTAL_SERVICE_KEY não configurada nos secrets da Edge Function",
    );
  }
  return { url, key };
}

async function agilizeGet(path: string, range: string) {
  const { url, key } = getAgilizeConfig();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Range: range,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agilize HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as unknown[];
}

async function fetchAll(path: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let start = 0; start < 20000; start += PAGE) {
    const batch = await agilizeGet(path, `${start}-${start + PAGE - 1}`);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function brtToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function diffDaysInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

function parseRange(inicio?: string, fim?: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const today = brtToday();
  const end = fim && day.test(fim) ? fim : today;
  const start = inicio && day.test(inicio) ? inicio : addDays(end, -6);
  if (start > end) {
    throw new Error("A data inicial é posterior à data final");
  }
  const dias = diffDaysInclusive(start, end);
  if (dias > MAX_DIAS) {
    throw new Error("O período máximo é de 31 dias");
  }
  return { start, end };
}

function cartClockToUtcMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return ms + BRT_OFFSET_MS;
}

function formatBrt(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

function norm(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function gravidade(copias: number): "atencao" | "critico" {
  return copias >= 5 ? "critico" : "atencao";
}

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "sem valor na ficha";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function assertSuperAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
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

type SaleSheet = {
  cod: string | null;
  valor: number | null;
  itens: number | null;
  lista: string;
  quandoMs: number | null;
  produtoIds: string[];
};

async function bubbleGet(path: string): Promise<Record<string, unknown> | null> {
  const token = Deno.env.get("BUBBLE_AGILIZE_KEY");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://app.agilizetotal.com.br/api/1.1/obj/${path}`,
    { headers },
  );
  if (!res.ok) return null;
  const body = await res.json();
  const obj = body?.response;
  return obj && typeof obj === "object" ? obj as Record<string, unknown> : null;
}

async function loadSale(vendaId: string): Promise<SaleSheet | null> {
  const res = await fetch(
    `https://app.agilizetotal.com.br/api/1.1/obj/vendas/${encodeURIComponent(vendaId)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const body = await res.json();
  const obj = (body?.response ?? {}) as Record<string, unknown>;
  const produtos = Array.isArray(obj.produtos) ? obj.produtos : [];
  const quando = typeof obj.data_da_venda === "string"
    ? Date.parse(obj.data_da_venda)
    : NaN;
  const valor = typeof obj.valor_final === "number" ? obj.valor_final : null;
  return {
    cod: obj.cod != null ? String(obj.cod) : null,
    valor,
    itens: produtos.length,
    lista: typeof obj.lista_produtos_servicos === "string"
      ? obj.lista_produtos_servicos
      : "",
    quandoMs: Number.isFinite(quando) ? quando : null,
    produtoIds: produtos.map((id) => String(id)),
  };
}

function listedTimes(sheet: SaleSheet, produtoNome: string): number {
  const target = norm(produtoNome);
  if (!target || !sheet.lista) return 0;
  return sheet.lista
    .split("/")
    .map((part) => norm(part))
    .filter((part) => part === target).length;
}

function countNear(
  lines: StockLine[],
  produtoId: string,
  quandoMs: number | null,
): { vezes: number; autor: string | null } {
  if (quandoMs == null) return { vezes: 0, autor: null };
  const hits = lines.filter((line) => {
    if (String(line.produto) !== produtoId || !line.data) return false;
    const ms = Date.parse(line.data);
    return Number.isFinite(ms) && Math.abs(ms - quandoMs) <= MATCH_MS;
  });
  return {
    vezes: hits.length,
    autor: hits.find((line) => line.creator_nome)?.creator_nome ?? null,
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : supabase;
    await assertSuperAdmin(adminClient, user.id);

    const body = await req.json().catch(() => ({}));
    const loja = String(body?.loja || "") as Loja;
    const store = STORES[loja];
    if (!store) {
      return jsonResponse({ error: "Loja inválida" }, 400);
    }

    const { start, end } = parseRange(
      body?.inicio ? String(body.inicio) : undefined,
      body?.fim ? String(body.fim) : undefined,
    );
    const cartEnd = addDays(end, 1);
    const empresa = encodeURIComponent(store.id);

    const cartSelect = encodeURIComponent(
      'produto,"produto nome",qnt,uniqueid_venda,data_da_venda',
    );
    const cartPath =
      `produto_carrinho?empresa=eq.${empresa}&vendido=eq.true` +
      `&data_da_venda=gte.${start}T00:00:00Z` +
      `&data_da_venda=lt.${cartEnd}T00:00:00Z` +
      `&select=${cartSelect}&order=id.asc`;

    const cartRaw = await fetchAll(cartPath);
    const carts = cartRaw as CartLine[];

    const groups = new Map<string, CartLine[]>();
    for (const line of carts) {
      const vendaId = String(line.uniqueid_venda || "");
      const produtoId = String(line.produto || "");
      if (!vendaId || !produtoId) continue;
      const key = `${vendaId}|${produtoId}`;
      const list = groups.get(key) ?? [];
      list.push(line);
      groups.set(key, list);
    }

    const candidates = [...groups.entries()].filter(([, lines]) =>
      lines.length >= MIN_COPIAS
    );

    const sheets = new Map<string, SaleSheet | null>();
    const queue = [...new Set(candidates.map(([key]) => key.split("|")[0]))];
    for (let i = 0; i < queue.length; i += 8) {
      const slice = queue.slice(i, i + 8);
      const loaded = await Promise.all(
        slice.map(async (vendaId) => [vendaId, await loadSale(vendaId)] as const),
      );
      for (const [vendaId, sheet] of loaded) sheets.set(vendaId, sheet);
    }

    const nomes = new Map<string, string>();
    async function nomeUsuario(userId: string | null): Promise<string | null> {
      if (!userId) return null;
      if (nomes.has(userId)) return nomes.get(userId) ?? null;
      const user = await bubbleGet(`user/${encodeURIComponent(userId)}`);
      const nome = user?.["Nome de usuário"] ? String(user["Nome de usuário"]) : null;
      nomes.set(userId, nome ?? "");
      return nome;
    }

    const alertas: AlertRow[] = [];
    let soCopia = 0;
    let escolhasNormais = 0;
    const cartCache = new Map<string, Record<string, unknown>[]>();
    async function itensDaVenda(vendaId: string): Promise<Record<string, unknown>[]> {
      const cached = cartCache.get(vendaId);
      if (cached) return cached;
      const ids = sheets.get(vendaId)?.produtoIds ?? [];
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < ids.length; i += 8) {
        const loaded = await Promise.all(
          ids.slice(i, i + 8).map((id) =>
            bubbleGet(`produtocarrinho/${encodeURIComponent(id)}`)
          ),
        );
        for (const row of loaded) if (row) rows.push(row);
      }
      cartCache.set(vendaId, rows);
      return rows;
    }

    for (const [key, lines] of candidates) {
      const [vendaId, produtoId] = key.split("|");
      const produtoNome = String(lines[0]["produto nome"] || produtoId).trim();
      const sheet = sheets.get(vendaId) ?? null;
      if (!sheet) continue;
      const todos = await itensDaVenda(vendaId);
      const cartRows = todos.filter((row) => {
        if (row.vendido === false) return false;
        const mesmoProduto = String(row["SUPABASE PRODUTO"] ?? "") === produtoId;
        const mesmoNome = norm(String(row["produto nome"] ?? "")) === norm(produtoNome);
        return mesmoProduto || mesmoNome;
      });
      if (cartRows.length < MIN_COPIAS) {
        soCopia += 1;
        continue;
      }

      const itensVenda: ItemVenda[] = cartRows.map((row) => ({
        nome: String(row["produto nome"] || produtoNome).trim(),
        qnt: typeof row.qnt === "number" ? row.qnt : null,
        dataHora: formatBrt(
          typeof row["data da venda"] === "string" ? Date.parse(row["data da venda"]) : null,
        ),
      }));
      const lancamentos: Lancamento[] = [];
      for (let i = 0; i < cartRows.length; i += 8) {
        const slice = cartRows.slice(i, i + 8);
        const loaded = await Promise.all(slice.map(async (row) => {
          const lancId = row["lançamento estoque"];
          if (typeof lancId !== "string" || !lancId) return null;
          const stock = await bubbleGet(
            `${encodeURIComponent("lançamento_estoque")}/${encodeURIComponent(lancId)}`,
          );
          if (!stock) return null;
          const autorId = typeof stock["Created By"] === "string" ? stock["Created By"] : null;
          return {
            codigo: stock.cod != null ? String(stock.cod) : null,
            criadoEm: formatBrt(
              typeof stock["Created Date"] === "string" ? Date.parse(stock["Created Date"]) : null,
            ),
            dataHora: formatBrt(typeof stock.data === "string" ? Date.parse(stock.data) : null),
            quantidade: typeof stock.qntd === "number" ? stock.qntd : null,
            ligadoAVenda: stock.venda === vendaId,
            autor: await nomeUsuario(autorId),
          } satisfies Lancamento;
        }));
        for (const row of loaded) if (row) lancamentos.push(row);
      }

      const vezesNaFicha = sheet ? listedTimes(sheet, produtoNome) : 0;
      const ligado = lancamentos.filter((row) => row.ligadoAVenda).length;
      const escolhaNormal =
        vezesNaFicha >= cartRows.length && ligado === cartRows.length;
      if (escolhaNormal) {
        escolhasNormais += 1;
        continue;
      }
      const situacao: AlertRow["situacao"] = "alem_da_ficha";
      const nivel = gravidade(Math.max(cartRows.length, lancamentos.length));
      const quando = formatBrt(sheet?.quandoMs ?? cartClockToUtcMs(lines[0].data_da_venda));
      const codigo = sheet?.cod ?? null;
      const autor = lancamentos.find((row) => row.autor)?.autor ?? null;
      const aMais = Math.max(0, lancamentos.length - vezesNaFicha);
      const texto =
        `${store.nome}: venda ${codigo ?? vendaId}, ${produtoNome}. ` +
        `Na venda o produto está escrito ${vezesNaFicha} vez(es). ` +
        `O estoque lançou ${lancamentos.length} saída(s). ` +
        `${aMais} a mais do que o cliente comprou. Valor ${money(sheet?.valor ?? null)}.`;

      alertas.push({
        id: key,
        vendaId,
        codigoVenda: codigo,
        dataHora: quando,
        produtoId,
        produtoNome,
        vezesCarrinho: cartRows.length,
        vezesSaida: lancamentos.length,
        valorFicha: sheet?.valor ?? null,
        itensFicha: sheet?.itens ?? null,
        vezesNaFicha,
        autor,
        gravidade: nivel,
        situacao,
        texto,
        itensVenda,
        lancamentos,
      });
    }

    alertas.sort((a, b) => {
      if (a.situacao !== b.situacao) return a.situacao === "alem_da_ficha" ? -1 : 1;
      if (a.gravidade !== b.gravidade) return a.gravidade === "critico" ? -1 : 1;
      return Math.max(b.vezesCarrinho, b.vezesSaida) - Math.max(a.vezesCarrinho, a.vezesSaida);
    });

    const maiorRepeticao = alertas.reduce(
      (max, row) => Math.max(max, row.vezesCarrinho, row.vezesSaida),
      0,
    );
    const alemDaFicha = alertas.filter((row) => row.situacao === "alem_da_ficha").length;

    return jsonResponse({
      loja,
      empresaId: store.id,
      empresaNome: store.nome,
      inicio: start,
      fim: end,
      resumo: {
        total: alertas.length,
        criticos: alertas.filter((row) => row.gravidade === "critico" && row.situacao === "alem_da_ficha").length,
        maiorRepeticao,
        alemDaFicha,
        fichaConfirma: escolhasNormais,
        soCopia,
      },
      alertas,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar falhas";
    const status = message.startsWith("Acesso negado") ? 403 : 400;
    return jsonResponse({ error: message }, status);
  }
});
