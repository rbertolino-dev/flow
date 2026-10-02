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
  autor: string | null;
  gravidade: "atencao" | "critico";
  texto: string;
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
  if (ms == null) return null;
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
};

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

    const stockSelect = encodeURIComponent(
      "id,data,produto,nome_produto,qntd,cod,creator_nome",
    );
    const stockPath =
      `${encodeURIComponent("lançamento_estoque")}?empresa=eq.${empresa}` +
      `&entrada_saida=eq.${encodeURIComponent("Saída")}` +
      `&data=gte.${start}T03:00:00Z` +
      `&data=lt.${cartEnd}T03:00:00Z` +
      `&select=${stockSelect}&order=id.asc`;

    const [cartRaw, stockRaw] = await Promise.all([
      fetchAll(cartPath),
      fetchAll(stockPath),
    ]);
    const carts = cartRaw as CartLine[];
    const stocks = stockRaw as StockLine[];

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

    const alertas: AlertRow[] = [];
    const windows: { produtoId: string; ms: number }[] = [];
    for (const [key, lines] of candidates) {
      const [vendaId, produtoId] = key.split("|");
      const produtoNome = String(lines[0]["produto nome"] || produtoId);
      const vezesCarrinho = lines.length;
      const sheet = sheets.get(vendaId) ?? null;
      const vezesNaFicha = sheet ? listedTimes(sheet, produtoNome) : 0;
      const itensFicha = sheet?.itens ?? null;
      const quandoMs = sheet?.quandoMs ?? cartClockToUtcMs(lines[0].data_da_venda);
      if (vezesNaFicha >= vezesCarrinho) {
        if (quandoMs != null) windows.push({ produtoId, ms: quandoMs });
        continue;
      }
      const saida = countNear(stocks, produtoId, quandoMs);
      const copias = Math.max(vezesCarrinho, saida.vezes);
      const nivel = gravidade(copias);
      const quando = formatBrt(quandoMs);
      const codigo = sheet?.cod ?? null;
      const texto =
        `${store.nome}: venda ${codigo ?? vendaId} em ${quando ?? "horário não informado"}. ` +
        `${produtoNome.trim()} repetido ${vezesCarrinho} vezes no carrinho` +
        (saida.vezes > 0 ? ` e ${saida.vezes} saídas no mesmo segundo` : "") +
        `. Ficha com ${itensFicha ?? "?"} itens, ${money(sheet?.valor ?? null)}. ` +
        `Gravidade ${nivel === "critico" ? "crítica" : "atenção"}.`;

      alertas.push({
        id: key,
        vendaId,
        codigoVenda: codigo,
        dataHora: quando,
        produtoId,
        produtoNome: produtoNome.trim(),
        vezesCarrinho,
        vezesSaida: saida.vezes,
        valorFicha: sheet?.valor ?? null,
        itensFicha,
        autor: saida.autor,
        gravidade: nivel,
        texto,
      });
      if (quandoMs != null) windows.push({ produtoId, ms: quandoMs });
    }

    const bursts = new Map<string, StockLine[]>();
    for (const line of stocks) {
      const cod = String(line.cod || "").trim();
      const produtoId = String(line.produto || "");
      if (!cod || !produtoId || !line.data || Number(line.qntd) !== 1) continue;
      const second = line.data.slice(0, 19);
      const key = `${cod}|${produtoId}|${second}`;
      const list = bursts.get(key) ?? [];
      list.push(line);
      bursts.set(key, list);
    }
    for (const [key, lines] of bursts) {
      if (lines.length < MIN_COPIAS) continue;
      const produtoId = String(lines[0].produto);
      const quandoMs = Date.parse(lines[0].data || "");
      const dataHora = formatBrt(Number.isFinite(quandoMs) ? quandoMs : null);
      const already = windows.some(
        (window) =>
          window.produtoId === produtoId &&
          Number.isFinite(quandoMs) &&
          Math.abs(window.ms - quandoMs) <= MATCH_MS,
      );
      if (already) continue;
      const produtoNome = String(lines[0].nome_produto || produtoId).trim();
      const nivel = gravidade(lines.length);
      const texto =
        `${store.nome}: ${lines.length} saídas de ${produtoNome} no mesmo segundo` +
        ` (${dataHora ?? "horário não informado"}), código ${lines[0].cod}. ` +
        `Gravidade ${nivel === "critico" ? "crítica" : "atenção"}.`;
      alertas.push({
        id: `saida|${key}`,
        vendaId: null,
        codigoVenda: null,
        dataHora,
        produtoId,
        produtoNome,
        vezesCarrinho: 0,
        vezesSaida: lines.length,
        valorFicha: null,
        itensFicha: null,
        autor: lines.find((line) => line.creator_nome)?.creator_nome ?? null,
        gravidade: nivel,
        texto,
      });
    }

    alertas.sort((a, b) => {
      if (a.gravidade !== b.gravidade) return a.gravidade === "critico" ? -1 : 1;
      return Math.max(b.vezesCarrinho, b.vezesSaida) -
        Math.max(a.vezesCarrinho, a.vezesSaida);
    });

    const maiorRepeticao = alertas.reduce(
      (max, row) => Math.max(max, row.vezesCarrinho, row.vezesSaida),
      0,
    );

    return jsonResponse({
      loja,
      empresaId: store.id,
      empresaNome: store.nome,
      inicio: start,
      fim: end,
      resumo: {
        total: alertas.length,
        criticos: alertas.filter((row) => row.gravidade === "critico").length,
        maiorRepeticao,
      },
      alertas,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar falhas";
    const status = message.startsWith("Acesso negado") ? 403 : 400;
    return jsonResponse({ error: message }, status);
  }
});
