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

function plain(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = plain(item);
    return out;
  }
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(plain(body)), {
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

function buildTransporte(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const text = (key: string) => String(source[key] || "").trim();
  const weight = (key: string) => text(key).replace(",", ".");
  const transporte: Record<string, string> = {};
  if (text("volume")) transporte.volume = text("volume");
  if (text("especie")) transporte.especie = text("especie");
  if (text("marca")) transporte.marca = text("marca");
  if (text("numeracao")) transporte.numeracao = text("numeracao");
  if (weight("peso_liquido")) transporte.peso_liquido = weight("peso_liquido");
  if (weight("peso_bruto")) transporte.peso_bruto = weight("peso_bruto");
  if (text("lacres")) transporte.lacres = text("lacres");
  if (source.incluir_transportadora) {
    const cnpj = digits(source.cnpj);
    if (cnpj) transporte.cnpj = cnpj;
    if (text("razao_social")) transporte.razao_social = text("razao_social");
    if (text("ie")) transporte.ie = text("ie");
    if (text("endereco")) transporte.endereco = text("endereco");
    if (text("uf")) transporte.uf = text("uf").toUpperCase().slice(0, 2);
    if (text("cidade")) transporte.cidade = text("cidade");
    const cep = digits(source.cep);
    if (cep) transporte.cep = cep;
  }
  return Object.keys(transporte).length ? transporte : null;
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
  await client.queryArray(`ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS cce_url TEXT`);
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
  await client.queryArray(`ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS fiscal_hidden_at TIMESTAMPTZ`);
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
  vale_alimentacao: "10",
  vale_refeicao: "11",
  vale_presente: "12",
  vale_combustivel: "13",
  duplicata: "14",
  boleto: "15",
  transferencia_bancaria: "16",
  transferencia: "16",
  pix: "17",
  ted: "18",
  pix_estatico: "20",
  credito_loja: "21",
  fidelidade: "19",
  pagamento_eletronico: "22",
  sem_pagamento: "90",
  pagamento_posterior: "91",
};

function paymentCode(method: string) {
  const raw = String(method || "").trim();
  if (/^\d{2}$/.test(raw)) return raw;
  return PAYMENT_CODE[raw] || "99";
}

type LeadRow = { data: Record<string, unknown> | null; error: { message?: string } | null };

type LeadFilter = {
  eq: (column: string, value: string) => LeadFilter;
  is: (column: string, value: null) => LeadFilter;
  maybeSingle: () => Promise<LeadRow>;
};

async function loadLead(
  supabase: { from: (table: string) => { select: (columns: string) => LeadFilter } },
  organizationId: string,
  leadId: string,
) {
  const id = String(leadId || "").trim();
  if (!id) return null;
  const query = (columns: string) => supabase.from("leads").select(columns).eq("id", id).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
  const withStreet = await query("id, name, phone, email, company, cpf_cnpj, address, address_number, neighborhood, city, uf, postal_code");
  if (!withStreet.error) return withStreet.data;
  if (!/column|does not exist/i.test(withStreet.error.message || "")) return null;
  const full = await query("id, name, phone, email, company, cpf_cnpj, address, neighborhood, city, postal_code");
  if (!full.error) return full.data;
  if (!/column|does not exist/i.test(full.error.message || "")) return null;
  const slim = await query("id, name, phone, email, company");
  if (slim.error) return null;
  return slim.data;
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

function motivoFromStored(value: unknown) {
  let body: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch { /* payload inválido */ }
  } else if (value && typeof value === "object") {
    body = value as Record<string, unknown>;
  }
  return extractReturn(body).motivo;
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

const CLASS_URL = "https://webmania.com.br/api/1/nfe/classe-imposto/";
const CENARIOS = new Set(["padrao", "saida_dentro_estado", "saida_fora_estado", "entrada_dentro_estado", "entrada_fora_estado", "saida_exterior", "entrada_exterior"]);
const PESSOAS = new Set(["fisica", "juridica", "estrangeira"]);

function assertScenarioPerson(tax: string, cenario: string, tipo_pessoa: string) {
  if (tax === "icms" && (cenario === "padrao" || !CENARIOS.has(cenario))) throw new Error("Cenário de ICMS inválido");
  if (!CENARIOS.has(cenario)) throw new Error("Cenário inválido");
  if (!PESSOAS.has(tipo_pessoa)) throw new Error("Informe se a pessoa é física, jurídica ou estrangeira");
  if (cenario === "saida_exterior" && tipo_pessoa !== "estrangeira") throw new Error("Saída para o exterior aceita somente pessoa estrangeira");
  if (cenario === "entrada_exterior" && tipo_pessoa === "estrangeira") throw new Error("Entrada do exterior aceita pessoa física ou jurídica");
  if (cenario !== "saida_exterior" && tipo_pessoa === "estrangeira") throw new Error("Pessoa estrangeira só vale na saída para o exterior");
}
const TAXES = ["icms", "ipi", "pis", "cofins", "ibs_cbs"] as const;

function asList(value: unknown) {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function ufRows(value: unknown, amountKey: string) {
  return asList(value).map((row) => {
    const estado = String(row.estado || "").trim().toUpperCase();
    const amount = String(row[amountKey] || row.aliquota || row.codigo || "").trim();
    if (!/^[A-Z]{2}$/.test(estado) || !amount) return null;
    if (amountKey === "codigo") return { estado, codigo: amount };
    if (amountKey === "codigo_beneficio_fiscal") return { estado, codigo_beneficio_fiscal: amount, aliquota: money(row.aliquota) };
    return { estado, aliquota: money(amount) };
  }).filter(Boolean);
}

function icmsPayload(raw: Record<string, unknown>) {
  const cenario = String(raw.cenario || "");
  const tipo_pessoa = String(raw.tipo_pessoa || "");
  assertScenarioPerson("icms", cenario, tipo_pessoa);
  const tipo = String(raw.tipo_tributacao || "simples_nacional");
  if (!["simples_nacional", "simples_nacional_sublimite", "tributacao_normal"].includes(tipo)) {
    throw new Error("Tipo de tributação do ICMS inválido");
  }
  const cfop = digits(raw.codigo_cfop);
  if (cfop.length !== 4) throw new Error("CFOP deve ter 4 dígitos");
  const situacao = String(raw.situacao_tributaria || "");
  if (!situacao) throw new Error("Informe a situação tributária do ICMS");
  const item: Record<string, unknown> = {
    tipo_tributacao: tipo,
    cenario,
    tipo_pessoa,
    codigo_cfop: cfop,
    situacao_tributaria: situacao,
  };
  if (situacao === "101" || situacao === "201") {
    if (raw.aliquota_credito == null || String(raw.aliquota_credito) === "") throw new Error("Informe a alíquota de crédito do ICMS");
    item.aliquota_credito = money(raw.aliquota_credito);
  }
  if (cenario === "entrada_exterior") {
    if (raw.aliquota_importacao == null || String(raw.aliquota_importacao) === "") throw new Error("Informe a alíquota de importação do ICMS");
    item.aliquota_importacao = money(raw.aliquota_importacao);
  }
  if (String(raw.aliquota_reducao || "").trim()) item.aliquota_reducao = String(raw.aliquota_reducao).trim();
  const mva = ufRows(raw.aliquota_mva, "aliquota");
  const beneficio = ufRows(raw.beneficio_fiscal, "codigo");
  const credito = ufRows(raw.credito_presumido, "codigo_beneficio_fiscal");
  if (mva.length) item.aliquota_mva = mva;
  if (beneficio.length) item.beneficio_fiscal = beneficio;
  if (credito.length) item.credito_presumido = credito;
  return item;
}

function otherPayload(tax: string, raw: Record<string, unknown>) {
  const cenario = String(raw.cenario || "");
  const tipo_pessoa = String(raw.tipo_pessoa || "");
  assertScenarioPerson(tax, cenario, tipo_pessoa);
  const situacao = String(raw.situacao_tributaria || "");
  if (!situacao) throw new Error("Informe a situação tributária");
  if (tax === "ibs_cbs") {
    const classificacao = String(raw.classificacao_tributaria || "");
    if (!/^\d{6}$/.test(classificacao)) throw new Error("A classificação tributária do IBS/CBS tem 6 dígitos");
    return { cenario, tipo_pessoa, situacao_tributaria: situacao, classificacao_tributaria: classificacao };
  }
  const item: Record<string, unknown> = {
    cenario,
    tipo_pessoa,
    situacao_tributaria: situacao,
    aliquota: money(raw.aliquota),
  };
  if (tax === "ipi") item.codigo_enquadramento = String(raw.codigo_enquadramento || "999");
  return item;
}

function buildClassPayload(body: Record<string, unknown>) {
  const descricao = String(body.descricao || "").trim();
  if (!descricao) throw new Error("Informe o nome da classe");
  const referencia = String(body.referencia || "").trim();
  if (body.kind === "service") {
    const codigo = String(body.codigo_servico || "").trim();
    if (!codigo) throw new Error("Informe o código do serviço");
    const issRetido = String(body.iss_retido || "2");
    const payload: Record<string, unknown> = {
      descricao,
      tipo: "nfse",
      codigo_servico: codigo,
      natureza_operacao: String(body.natureza_operacao || "1"),
      exigibilidade_iss: String(body.exigibilidade_iss || "1"),
      iss_retido: issRetido,
      iss: Number(body.iss || 0),
      pis: Number(body.pis || 0),
      cofins: Number(body.cofins || 0),
      inss: Number(body.inss || 0),
      ir: Number(body.ir || 0),
      csll: Number(body.csll || 0),
    };
    if (issRetido === "1") {
      const responsavel = String(body.responsavel_retencao || "");
      if (responsavel !== "1" && responsavel !== "2") throw new Error("Informe quem retém o ISS");
      payload.responsavel_retencao = responsavel;
    }
    const situacao = String(body.situacao_tributaria || "").trim();
    const classificacao = String(body.classificacao_tributaria || "").trim();
    if (situacao || classificacao) {
      if (!situacao || !/^\d{6}$/.test(classificacao)) throw new Error("Informe a situação e a classificação de 6 dígitos do IBS/CBS");
      payload.ibs_cbs = { situacao_tributaria: situacao, classificacao_tributaria: classificacao };
    }
    if (referencia) payload.referencia = referencia;
    return payload;
  }
  const icms = asList(body.icms).map(icmsPayload);
  if (!icms.length || icms.length > 6) throw new Error("O ICMS aceita de 1 a 6 cenários");
  let ipi: Record<string, unknown>[];
  let pis: Record<string, unknown>[];
  let cofins: Record<string, unknown>[];
  let ibs: Record<string, unknown>[];
  if (body.mode === "simples") {
    const auto = (situacao: string, extra: Record<string, unknown> = {}) => ["fisica", "juridica"].map((tipo_pessoa) => ({
      cenario: "padrao", tipo_pessoa, situacao_tributaria: situacao, aliquota: "0.00", ...extra,
    }));
    ipi = auto("99", { codigo_enquadramento: "999" });
    pis = auto("99");
    cofins = auto("99");
    ibs = ["fisica", "juridica"].map((tipo_pessoa) => ({
      cenario: "padrao", tipo_pessoa, situacao_tributaria: "000", classificacao_tributaria: "000001",
    }));
  } else {
    const grouped = Object.fromEntries(TAXES.map((tax) => [tax, asList(body[tax] || (tax === "icms" ? body.icms : []))]) ) as Record<string, Record<string, unknown>[]>;
    grouped.icms = asList(body.icms);
    for (const tax of TAXES) {
      if (grouped[tax].length < 1 || grouped[tax].length > 6) throw new Error("Crie de 1 a 6 cenários para cada imposto");
    }
    ipi = grouped.ipi.map((row) => otherPayload("ipi", row));
    pis = grouped.pis.map((row) => otherPayload("pis", row));
    cofins = grouped.cofins.map((row) => otherPayload("cofins", row));
    ibs = grouped.ibs_cbs.map((row) => otherPayload("ibs_cbs", row));
  }
  const payload: Record<string, unknown> = { descricao, icms, ipi, pis, cofins, ibs_cbs: ibs };
  if (referencia) payload.referencia = referencia;
  return payload;
}

function scenarioView(tax: string, row: Record<string, unknown>) {
  return {
    tax,
    name: String(row.cenario || ""),
    person: String(row.tipo_pessoa || ""),
    cfop: String(row.codigo_cfop || ""),
    cst: String(row.situacao_tributaria || ""),
    rate: String(row.aliquota || row.aliquota_credito || ""),
    tipo: String(row.tipo_tributacao || ""),
    classificacao: String(row.classificacao_tributaria || ""),
    codigo_enquadramento: String(row.codigo_enquadramento || ""),
    aliquota_credito: String(row.aliquota_credito || ""),
    aliquota_importacao: String(row.aliquota_importacao || ""),
    aliquota_reducao: String(row.aliquota_reducao || ""),
    aliquota_mva: asList(row.aliquota_mva),
    beneficio_fiscal: asList(row.beneficio_fiscal),
    credito_presumido: asList(row.credito_presumido),
  };
}

function normalizeClass(item: Record<string, unknown>) {
  const tipo = String(item.tipo || "");
  const isService = tipo === "nfse";
  const grouped = Object.fromEntries(TAXES.map((tax) => {
    const source = tax === "ibs_cbs" && item.ibs_cbs && !Array.isArray(item.ibs_cbs) ? [] : asList(item[tax]);
    return [tax, source.map((row) => scenarioView(tax, row))];
  }));
  const serviceIbs = item.ibs_cbs && !Array.isArray(item.ibs_cbs) ? item.ibs_cbs as Record<string, unknown> : {};
  return {
    id: String(item.referencia || ""),
    ref: String(item.referencia || ""),
    description: String(item.descricao || ""),
    noteType: isService ? "nfse" : "nfe",
    emissionType: tipo,
    icms: grouped.icms,
    ipi: grouped.ipi,
    pis: grouped.pis,
    cofins: grouped.cofins,
    ibs: grouped.ibs_cbs,
    service: isService ? {
      codigo_servico: String(item.codigo_servico || ""),
      natureza_operacao: String(item.natureza_operacao || "1"),
      exigibilidade_iss: String(item.exigibilidade_iss || "1"),
      iss_retido: String(item.iss_retido || "2"),
      responsavel_retencao: String(item.responsavel_retencao || ""),
      iss: String(item.iss ?? ""),
      pis: String(item.pis ?? ""),
      cofins: String(item.cofins ?? ""),
      inss: String(item.inss ?? ""),
      ir: String(item.ir ?? ""),
      csll: String(item.csll ?? ""),
      situacao_tributaria: String(serviceIbs.situacao_tributaria || ""),
      classificacao_tributaria: String(serviceIbs.classificacao_tributaria || ""),
    } : null,
    scenarios: grouped.icms,
  };
}

async function webmaniaClass(empresa: Record<string, unknown>, method: string, payload?: unknown) {
  const res = await fetch(CLASS_URL, {
    method,
    headers: nfeHeaders(empresa),
    body: payload == null ? undefined : JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || data?.mensagem || data?.motivo || data?.message || `Webmania respondeu ${res.status}`;
    throw new Error(typeof message === "string" ? message : "A Webmania recusou a classe de imposto");
  }
  return data;
}

async function bubbleResults(env: string, type: string, constraints: { key: string; constraint_type: string; value: string }[]) {
  const params = new URLSearchParams({ limit: "100", constraints: JSON.stringify(constraints) });
  const data = await bubbleGet(env, `${type}?${params.toString()}`);
  const results = data?.response?.results || data?.results || [];
  return Array.isArray(results) ? results as Record<string, unknown>[] : [];
}

function scenarioFromMirror(row: Record<string, unknown>) {
  const taxName = field(row, "imposto").toUpperCase();
  const tax = taxName.includes("IBS") || taxName.includes("CBS") ? "ibs_cbs" : taxName === "IPI" ? "ipi" : taxName === "PIS" ? "pis" : taxName === "COFINS" ? "cofins" : "icms";
  return {
    tax,
    name: field(row, "cenario"),
    person: field(row, "tipo pessoa"),
    cfop: field(row, "cfop"),
    cst: field(row, "sit trib"),
    rate: field(row, "aliquota"),
    tipo: "",
    classificacao: field(row, "classificação tributária") || field(row, "classificacao"),
    codigo_enquadramento: "",
    aliquota_credito: "",
    aliquota_importacao: "",
    aliquota_reducao: "",
    aliquota_mva: [],
    beneficio_fiscal: [],
    credito_presumido: [],
  };
}

function linkedId(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    return String(row._id || row.id || "");
  }
  return "";
}

function rowCompanyId(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (!/empresa/i.test(key)) continue;
    const id = linkedId(value) || (typeof value === "string" ? value : "");
    if (id) return id;
  }
  return "";
}

async function loadMirrorClasses(env: string, empresaId: string) {
  const types = ["webmaniaclasseimposto", "webmania_classe_imposto", "classeimposto"];
  let rows: Record<string, unknown>[] = [];
  let found = false;
  for (const type of types) {
    try {
      rows = await bubbleResults(env, type, [{ key: "empresa", constraint_type: "equals", value: empresaId }]);
      found = true;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/not found|não encontrad|does not exist/i.test(message)) throw error;
    }
  }
  if (!found) return [];
  const own = rows.filter((row) => rowCompanyId(row) === empresaId);
  const classes = [];
  for (const row of own) {
    const linked = row["cenários"] || row.cenarios || row["cenarios"];
    const scenarios: Record<string, unknown>[] = [];
    if (Array.isArray(linked)) {
      const embedded = linked.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
      const ids = linked.filter((item) => item && typeof item !== "object").slice(0, 8).map((item) => String(item));
      const fetched = await Promise.all(ids.map(async (id) => {
        try {
          const data = await bubbleGet(env, `cenarioimposto/${encodeURIComponent(id)}`);
          const scene = (data.response || data) as Record<string, unknown>;
          return scene && !scene.error ? scene : null;
        } catch {
          return null;
        }
      }));
      scenarios.push(...embedded, ...fetched.filter((item): item is Record<string, unknown> => Boolean(item)));
    }
    const views = scenarios.map(scenarioFromMirror);
    const tipoNota = field(row, "tipo nota").toLowerCase();
    const isService = tipoNota.includes("nfs") || tipoNota.includes("serv");
    const pick = (tax: string) => views.filter((item) => item.tax === tax);
    const ref = field(row, "ref") || field(row, "referência") || String(row._id || "");
    if (!ref) continue;
    classes.push({
      id: ref,
      ref,
      description: field(row, "descrição") || field(row, "descricao") || ref,
      noteType: isService ? "nfse" : "nfe",
      emissionType: isService ? "nfse" : "nfe",
      icms: pick("icms"),
      ipi: pick("ipi"),
      pis: pick("pis"),
      cofins: pick("cofins"),
      ibs: pick("ibs_cbs"),
      service: isService ? {
        codigo_servico: field(row, "código do serviço") || field(row, "codigo servico") || field(row, "codigo_servico"),
        natureza_operacao: field(row, "natureza da operação") || field(row, "natureza operacao") || "1",
        exigibilidade_iss: field(row, "exigibilidade do iss") || field(row, "exigibilidade") || "1",
        iss_retido: field(row, "iss retido") || "2",
        responsavel_retencao: field(row, "responsável da retenção") || "1",
        iss: field(row, "iss") || "0",
        pis: field(row, "pis") || "0",
        cofins: field(row, "cofins") || "0",
        inss: field(row, "inss") || "0",
        ir: field(row, "ir") || "0",
        csll: field(row, "csll") || "0",
        situacao_tributaria: "",
        classificacao_tributaria: "",
      } : null,
      scenarios: pick("icms"),
    });
  }
  return classes;
}

async function mirrorClass(env: string, empresaId: string, referencia: string, descricao: string, payload: Record<string, unknown>) {
  const blocks: { tax: string; rows: Record<string, unknown>[] }[] = [
    { tax: "ICMS", rows: asList(payload.icms) },
    { tax: "IPI", rows: asList(payload.ipi) },
    { tax: "PIS", rows: asList(payload.pis) },
    { tax: "COFINS", rows: asList(payload.cofins) },
    { tax: "IBS/CBS", rows: asList(payload.ibs_cbs) },
  ];
  const ids: string[] = [];
  for (const block of blocks) {
    for (const row of block.rows.slice(0, 8)) {
      const created = await fetch(`${bubbleBase(env)}/cenarioimposto`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bubbleToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cenario: row.cenario || "",
          cfop: row.codigo_cfop || "",
          imposto: block.tax,
          "sit trib": row.situacao_tributaria || "",
          aliquota: row.aliquota || row.aliquota_credito || "",
          "tipo pessoa": row.tipo_pessoa || "",
        }),
      });
      const data = await created.json().catch(() => ({}));
      const id = data?.id || data?.response?.id || data?.response?._id;
      if (id) ids.push(String(id));
    }
  }
  await fetch(`${bubbleBase(env)}/webmaniaclasseimposto`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bubbleToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: referencia,
      descrição: descricao,
      "tipo nota": payload.tipo === "nfse" ? "NFS-e" : "NF-e",
      empresa: empresaId,
      cenários: ids,
    }),
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

    if (action === "classes" && req.method === "GET") {
      const data = await webmaniaClass(empresa, "GET");
      const results = (Array.isArray(data) ? data : data?.data || data?.classes || []) as Record<string, unknown>[];
      const fromWebmania = results.map(normalizeClass);
      let mirrorWarning = "";
      let fromMirror: Awaited<ReturnType<typeof loadMirrorClasses>> = [];
      try {
        fromMirror = await loadMirrorClasses(bubbleEnv, String(settings.empresa_id));
      } catch (error) {
        mirrorWarning = error instanceof Error ? error.message : "Não foi possível ler o espelho de classes do Agilize Total";
      }
      const seen = new Set(fromWebmania.map((item) => item.ref));
      const classes = [...fromWebmania, ...fromMirror.filter((item) => item.ref && !seen.has(item.ref))];
      return json({ classes, mirrorWarning });
    }

    if (action === "classes" && req.method === "POST") {
      const payload = buildClassPayload(body);
      const saved = await webmaniaClass(empresa, "POST", payload) as Record<string, unknown>;
      const nested = saved && typeof saved === "object" && !Array.isArray(saved) && saved.data && typeof saved.data === "object"
        ? saved.data as Record<string, unknown>
        : null;
      const first = Array.isArray(saved) ? saved[0] as Record<string, unknown> : null;
      const referencia = String(saved?.referencia || nested?.referencia || first?.referencia || body.referencia || "");
      if (!referencia) {
        const source = saved && typeof saved === "object" ? saved : {};
        const hint = String(source.error || source.mensagem || source.motivo || source.message || "");
        return json({ error: hint || "A Webmania não devolveu a referência da classe de imposto", campos: Object.keys(source).slice(0, 12) }, 400);
      }
      let bubbleWarning = "";
      if (!body.referencia) {
        try {
          await mirrorClass(bubbleEnv, String(settings.empresa_id), referencia, String(payload.descricao || ""), payload);
        } catch (error) {
          bubbleWarning = error instanceof Error ? error.message : "A classe foi salva na Webmania, mas não apareceu no Agilize Total";
        }
      }
      return json({ ok: true, referencia, bubbleWarning });
    }

    if (action === "class-delete" && req.method === "POST") {
      const referencia = String(body.referencia || "").trim();
      if (!referencia) return json({ error: "Informe a classe" }, 400);
      await webmaniaClass(empresa, "DELETE", { referencia: [referencia] });
      return json({ ok: true });
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
      const invoices = rows.rows.map((row: Record<string, unknown>) => {
        const rest = { ...row };
        const stored = rest.response_payload;
        delete rest.request_payload;
        delete rest.response_payload;
        return { ...rest, motivo: motivoFromStored(stored) };
      });
      return json({ invoices, issued });
    }

    if (action === "sales") {
      const from = url.searchParams.get("from") || "2000-01-01";
      const to = url.searchParams.get("to") || "2100-01-01";
      const q = (url.searchParams.get("q") || "").trim();
      const rows = await client.queryObject(
        `SELECT s.id, s.sale_number::int AS sale_number, s.customer_name, s.created_at, s.total,
                s.invoice_number,
                bool_or(i.item_type = 'product') AS has_product,
                bool_or(i.item_type = 'service') AS has_service
         FROM pos_sales s
         LEFT JOIN pos_sale_items i ON i.sale_id = s.id
         WHERE s.organization_id = $1 AND s.status = 'completed'
           AND s.fiscal_hidden_at IS NULL
           AND s.created_at::date BETWEEN $2::date AND $3::date
           AND ($4 = '' OR s.customer_name ILIKE '%' || $4 || '%')
         GROUP BY s.id
         ORDER BY s.created_at DESC LIMIT 1000`,
        [organizationId, from, to, q],
      );
      return json({ sales: rows.rows });
    }

    if (action === "hide-issued-sales" && req.method === "POST") {
      const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id || "").trim()).filter(Boolean) : [];
      if (!ids.length) return json({ hidden: 0 });
      const hidden = await client.queryObject<{ n: string }>(
        `WITH updated AS (
           UPDATE pos_sales
           SET fiscal_hidden_at = now()
           WHERE organization_id = $1
             AND status = 'completed'
             AND fiscal_hidden_at IS NULL
             AND COALESCE(invoice_number, '') <> ''
             AND id = ANY($2::uuid[])
           RETURNING id
         )
         SELECT count(*)::text AS n FROM updated`,
        [organizationId, ids],
      );
      return json({ hidden: Number(hidden.rows[0]?.n || 0) });
    }

    if (action === "sale") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Venda não informada" }, 400);
      const sale = await client.queryObject(
        `SELECT id, organization_id, sale_number::text AS sale_number, lead_id, customer_name, customer_phone,
                subtotal::text AS subtotal, discount_amount::text AS discount_amount, total::text AS total,
                notes, created_at
         FROM pos_sales WHERE id = $1 AND organization_id = $2`,
        [id, organizationId],
      );
      if (!sale.rows[0]) return json({ error: "Venda não encontrada" }, 404);
      const items = await client.queryObject(
        `SELECT i.id, i.item_type, i.item_id, i.name, i.sku, i.unit,
                i.quantity::text AS quantity, i.unit_price::text AS unit_price, i.total_price::text AS total_price,
                p.ncm, p.fiscal_origin, p.cest, p.tax_class_ref AS product_class,
                sv.tax_class_ref AS service_class
         FROM pos_sale_items i
         LEFT JOIN products p ON i.item_type = 'product' AND p.id = i.item_id
         LEFT JOIN services sv ON i.item_type = 'service' AND sv.id = i.item_id
         WHERE i.sale_id = $1 AND i.organization_id = $2`,
        [id, organizationId],
      );
      const payments = await client.queryObject(
        `SELECT method, amount::text AS amount FROM pos_sale_payments WHERE sale_id = $1`,
        [id],
      );
      const saleRow = sale.rows[0] as Record<string, unknown>;
      const lead = await loadLead(supabase, organizationId, saleRow.lead_id ? String(saleRow.lead_id) : "");
      return json({ sale: saleRow, items: items.rows, payments: payments.rows, lead });
    }

    if (action === "order") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Ordem não informada" }, 400);
      const { data: order, error } = await supabase.from("service_orders").select("id, code, client_name, client_phone, service_name, total, discount, lead_id").eq("id", id).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
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
      const lead = await loadLead(supabase, organizationId, order.lead_id ? String(order.lead_id) : "");
      return json({ order, items: items || [], classById, lead });
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

    if (action === "return" && req.method === "POST") {
      const chave = digits(body.chave);
      const cfop = digits(body.codigo_cfop);
      if (chave.length !== 44) return json({ error: "Informe a chave de 44 dígitos da nota de origem" }, 400);
      if (cfop.length !== 4) return json({ error: "Informe o CFOP de devolução com 4 dígitos" }, 400);
      const produtos = Array.isArray(body.produtos) ? body.produtos.map((item: unknown) => Number(item)).filter((item: number) => item > 0) : [];
      const quantidade = Array.isArray(body.quantidade) ? body.quantidade.map((item: unknown) => Number(item)) : [];
      if (quantidade.length && quantidade.length !== produtos.length) return json({ error: "A quantidade precisa acompanhar cada item devolvido" }, 400);
      const payload: Record<string, unknown> = {
        chave,
        natureza_operacao: String(body.natureza || "Devolução de mercadoria").slice(0, 60),
        codigo_cfop: cfop,
        ambiente: Number(settings.ambiente) === 1 ? 1 : 2,
        url_notificacao: webhookUrl(),
      };
      if (produtos.length) payload.produtos = produtos;
      if (quantidade.length) payload.quantidade = quantidade;
      const remote = await fetch("https://webmania.com.br/api/1/nfe/devolucao/", {
        method: "POST",
        headers: nfeHeaders(empresa),
        body: JSON.stringify(payload),
      });
      const responsePayload = await remote.json().catch(() => ({}));
      const parsed = extractReturn(responsePayload);
      if (!remote.ok && !parsed.uuid) return json({ error: parsed.motivo || "A Webmania recusou a devolução", detail: responsePayload }, 400);
      const inserted = await client.queryObject<{ id: string }>(
        `INSERT INTO fiscal_invoices (
           organization_id, source, source_id, kind, status, webmania_uuid, number, access_key, pdf_url, xml_url,
           amount, customer_name, request_payload, response_payload, bubble_env
         ) VALUES ($1,'devolucao',$2,'nfe',$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13) RETURNING id`,
        [organizationId, chave, parsed.status || "processando", parsed.uuid || null, parsed.number || null, parsed.accessKey || null, parsed.pdf || null, parsed.xml || null, Number(body.amount || 0), String(body.customer_name || "Devolução"), JSON.stringify(payload), JSON.stringify(responsePayload), bubbleEnv],
      );
      return json({ ok: remote.ok, invoiceId: inserted.rows[0].id, ...parsed });
    }

    if (action === "cancel" && req.method === "POST") {
      const motivo = String(body.motivo || "").trim();
      if (motivo.length < 15 || motivo.length > 255) return json({ error: "O motivo do cancelamento precisa ter de 15 a 255 caracteres" }, 400);
      const invoice = await client.queryObject<Record<string, unknown>>(`SELECT * FROM fiscal_invoices WHERE id = $1 AND organization_id = $2`, [body.id, organizationId]);
      const row = invoice.rows[0];
      if (!row) return json({ error: "Nota não encontrada" }, 404);
      if (String(row.status) === "cancelado") return json({ error: "Esta nota já está cancelada" }, 400);
      const uuid = String(row.webmania_uuid || "");
      const chave = digits(row.access_key);
      if (!uuid && chave.length !== 44) return json({ error: "A nota não tem chave nem identificador da Webmania" }, 400);
      const isService = row.kind === "nfse";
      const payload = isService ? { uuid, motivo } : { ...(chave.length === 44 ? { chave } : { uuid }), motivo };
      const remote = await fetch(isService ? "https://api.webmania.com.br/2/nfse/cancelar" : "https://webmania.com.br/api/1/nfe/cancelar/", {
        method: "PUT",
        headers: isService ? nfseHeaders(empresa) : nfeHeaders(empresa),
        body: JSON.stringify(payload),
      });
      const responsePayload = await remote.json().catch(() => ({}));
      if (!remote.ok) return json({ error: responsePayload?.error || responsePayload?.motivo || "A Webmania recusou o cancelamento", detail: responsePayload }, 400);
      await client.queryArray(
        `UPDATE fiscal_invoices SET status = 'cancelado', response_payload = $2::jsonb, updated_at = now() WHERE id = $1`,
        [row.id, JSON.stringify(responsePayload)],
      );
      return json({ ok: true });
    }

    if (action === "cce" && req.method === "POST") {
      const chave = digits(body.chave);
      const correcao = String(body.correcao || "").trim();
      if (chave.length !== 44) return json({ error: "Informe a chave de 44 dígitos da NF-e" }, 400);
      if (correcao.length < 15 || correcao.length > 1000) return json({ error: "A correção precisa ter de 15 a 1000 caracteres" }, 400);
      const payload = { chave, correcao, ambiente: Number(settings.ambiente) === 1 ? 1 : 2, url_notificacao: webhookUrl() };
      const remote = await fetch("https://webmania.com.br/api/1/nfe/cartacorrecao/", {
        method: "POST",
        headers: nfeHeaders(empresa),
        body: JSON.stringify(payload),
      });
      const responsePayload = await remote.json().catch(() => ({}));
      if (!remote.ok) return json({ error: responsePayload?.error || responsePayload?.motivo || "A Webmania recusou a carta de correção", detail: responsePayload }, 400);
      const dacce = String(responsePayload.dacce || "");
      if (dacce) {
        await client.queryArray(
          `UPDATE fiscal_invoices SET cce_url = $3, updated_at = now() WHERE organization_id = $1 AND access_key = $2`,
          [organizationId, chave, dacce],
        );
      }
      return json({ ok: true, dacce, status: responsePayload.status || "aprovado" });
    }

    if (action === "emit") {
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
      const foreignCustomer = Boolean(customer.foreign);
      if (foreignCustomer) {
        const foreignId = String(customer.document || "").trim();
        if (foreignId.length < 5 || foreignId.length > 20) return json({ error: "Informe o documento do cliente estrangeiro (5 a 20 caracteres)" }, 400);
      } else if (kind !== "nfce" && document.length !== 11 && document.length !== 14) return json({ error: "Informe o CPF ou CNPJ do cliente" }, 400);
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
            line.origem = row.fiscal_origin != null && String(row.fiscal_origin) !== "" ? String(row.fiscal_origin) : String(line.origem ?? "");
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
          if (line.origem === "" || line.origem == null) return json({ error: `Informações do produto faltando: Origem do produto (${line.name || "item"})` }, 400);
          if (!line.tax_class_ref) return json({ error: `Informe a classe de imposto do produto ${line.name || ""}`.trim() }, 400);
          const origin = Number(line.origem ?? 0);
          if (!Number.isInteger(origin) || origin < 0 || origin > 8) return json({ error: "Origem do produto deve ser de 0 a 8" }, 400);
        }
        const productLines = lines.filter((line) => line.item_type !== "service");
        const cliente: Record<string, unknown> = {};
        const foreign = Boolean(customer.foreign);
        if (foreign) {
          cliente.id_estrangeiro = String(customer.document || "").trim();
          cliente.nome_completo = String(customer.name);
          cliente.uf = "EX";
        } else if (document.length === 14 || isCompany) {
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
          cliente.uf = foreign ? "EX" : String(customer.uf || "");
          cliente.cep = digits(customer.cep);
        }
        const payments = Array.isArray(body.payments) && body.payments.length ? body.payments : [{ method: "dinheiro", amount }];
        requestPayload = {
          url_notificacao: webhookUrl(),
          operacao: Number(body.operacao) === 0 ? 0 : 1,
          natureza_operacao: String(body.natureza || settings.natureza || "Venda de Mercadoria"),
          modelo: kind === "nfce" ? "2" : "1",
          finalidade: [1, 3, 4].includes(Number(body.finalidade)) ? Number(body.finalidade) : 1,
          ambiente,
          ...(body.data_emissao ? { data_emissao: String(body.data_emissao) } : {}),
          ...(body.data_entrada_saida ? { data_entrada_saida: String(body.data_entrada_saida) } : {}),
          ...(body.complemento ? { informacoes_complementares: String(body.complemento) } : {}),
          ...(digits(body.nfe_referenciada).length === 44 ? { nfe_referenciada: [digits(body.nfe_referenciada)] } : {}),
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
        const transporte = buildTransporte(body.transporte);
        if (transporte) requestPayload.transporte = transporte;
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
