import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Download, FilePenLine, FilePlus2, FileText, Package, Receipt, ShoppingBag, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { TaxClassDialogs, type FiscalClass } from "@/components/fiscal/TaxClassDialogs";
import { FiscalErrorNotice } from "@/components/fiscal/FiscalErrorNotice";

type Company = {
  name: string;
  cnpj: string;
  limit: number;
  lastEmission: string;
  empresaId: string;
  ambiente: number;
  modelo: string;
  natureza: string;
  bubbleEnv?: string;
};

type Invoice = {
  id: string;
  kind: string;
  number: string | null;
  customer_name: string | null;
  created_at: string;
  amount: number | string | null;
  status: string;
  pdf_url: string | null;
  xml_url: string | null;
  access_key: string | null;
  cce_url?: string | null;
  motivo?: string | null;
};


type EmitLine = {
  key: string;
  product_id?: string;
  service_id?: string;
  item_type: "product" | "service";
  name: string;
  code: string;
  ncm: string;
  origem: string;
  quantity: number;
  price: number;
  tax_class_ref: string;
  description: string;
};

const FORMAS = [
  { code: "01", label: "01 - Dinheiro", method: "dinheiro" },
  { code: "02", label: "02 - Cheque", method: "cheque" },
  { code: "03", label: "03 - Cartão de crédito", method: "cartao_credito" },
  { code: "04", label: "04 - Cartão de débito", method: "cartao_debito" },
  { code: "05", label: "05 - Crediário", method: "crediario" },
  { code: "10", label: "10 - Vale alimentação", method: "vale_alimentacao" },
  { code: "11", label: "11 - Vale refeição", method: "vale_refeicao" },
  { code: "12", label: "12 - Vale presente", method: "vale_presente" },
  { code: "13", label: "13 - Vale combustível", method: "vale_combustivel" },
  { code: "14", label: "14 - Duplicata", method: "duplicata" },
  { code: "15", label: "15 - Boleto", method: "boleto" },
  { code: "16", label: "16 - Transferência", method: "transferencia_bancaria" },
  { code: "17", label: "17 - PIX", method: "pix" },
  { code: "18", label: "18 - TED", method: "ted" },
  { code: "20", label: "20 - PIX estático", method: "pix_estatico" },
  { code: "21", label: "21 - Crédito em loja", method: "credito_loja" },
  { code: "90", label: "90 - Sem pagamento", method: "sem_pagamento" },
  { code: "91", label: "91 - Pagamento posterior", method: "pagamento_posterior" },
  { code: "99", label: "99 - Outros", method: "outros" },
];

const PAGE_TABS: { id: "notas" | "product" | "service" | "avulsa" | "sales" | "cce" | "company" | "export"; label: string; caption: string; icon: LucideIcon }[] = [
  { id: "notas", label: "Notas", caption: "Notas emitidas no período", icon: Receipt },
  { id: "product", label: "Imposto de produto", caption: "Classes de imposto dos produtos", icon: Package },
  { id: "service", label: "Impostos de Serviços", caption: "Classes de imposto dos serviços", icon: Wrench },
  { id: "avulsa", label: "NFSe Avulsa", caption: "Serviço emitido sem uma venda", icon: FilePlus2 },
  { id: "sales", label: "Últimas vendas", caption: "Vendas do PDV prontas para emitir", icon: ShoppingBag },
  { id: "cce", label: "Carta de Correção", caption: "Correção de dados acessórios da NF-e", icon: FilePenLine },
  { id: "company", label: "Alternar Empresa", caption: "Empresa, ambiente e modelo padrão", icon: Building2 },
  { id: "export", label: "Exportar Notas", caption: "Planilha das notas do período", icon: Download },
];

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function kindMeta(kind: string) {
  if (kind === "nfce") return { label: "NFC-e", className: "bg-sky-50 text-sky-700" };
  if (kind === "nfse") return { label: "NFS-e", className: "bg-indigo-50 text-indigo-700" };
  return { label: "NF-e", className: "bg-blue-50 text-blue-700" };
}

function statusMeta(status: string) {
  const value = status.toLowerCase();
  if (value.includes("aprov") || value === "processado") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (value.includes("cancel") || value.includes("rejei") || value.includes("erro")) return "bg-rose-50 text-rose-700 ring-rose-100";
  if (value.includes("process")) return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

const SALES_PAGE_SIZE = 25;

type ReadySale = {
  id: string;
  sale_number: number;
  customer_name: string;
  created_at: string;
  total?: number;
  invoice_number?: string | null;
  has_product: boolean | string;
  has_service: boolean | string;
};

function saleAlreadyIssued(sale: ReadySale) {
  return Boolean(String(sale.invoice_number || "").trim());
}

function SalesReadyList({
  sales,
  loading,
  from,
  to,
  query,
  kind,
  onFrom,
  onTo,
  onQuery,
  onKind,
  order,
  onOrder,
  hidingIssued,
  onHideIssued,
  saleFlag,
  onProduct,
  onService,
}: {
  sales: ReadySale[];
  loading: boolean;
  from: string;
  to: string;
  query: string;
  kind: "all" | "product" | "service";
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onQuery: (value: string) => void;
  onKind: (value: "all" | "product" | "service") => void;
  order: "recent" | "oldest";
  onOrder: (value: "recent" | "oldest") => void;
  hidingIssued: boolean;
  onHideIssued: (ids: string[]) => void;
  saleFlag: (value: boolean | string | undefined) => boolean;
  onProduct: (id: string) => void;
  onService: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const visible = sales.filter((sale) => {
    const name = (sale.customer_name || "").toLowerCase();
    const number = String(sale.sale_number || "");
    const matchesQuery = !query.trim() || name.includes(query.trim().toLowerCase()) || number.includes(query.trim());
    const matchesKind =
      kind === "all" ||
      (kind === "product" && saleFlag(sale.has_product)) ||
      (kind === "service" && saleFlag(sale.has_service));
    return matchesQuery && matchesKind;
  });
  const sorted = [...visible].sort((left, right) => {
    const diff = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    return order === "oldest" ? diff : -diff;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / SALES_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * SALES_PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + SALES_PAGE_SIZE);
  const issuedCount = visible.filter(saleAlreadyIssued).length;

  useEffect(() => {
    setPage(1);
  }, [query, kind, order, from, to]);

  const kindButton = (value: "all" | "product" | "service", label: string) => (
    <button
      type="button"
      onClick={() => onKind(value)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${kind === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={from} onChange={(event) => onFrom(event.target.value)} className="h-9 w-[150px] bg-white" aria-label="Data inicial" />
        <Input type="date" value={to} onChange={(event) => onTo(event.target.value)} className="h-9 w-[150px] bg-white" aria-label="Data final" />
        <Input
          placeholder="Cliente ou nº da venda"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="h-9 w-52 bg-white"
        />
        <div className="flex rounded-lg border bg-white p-0.5">
          {kindButton("all", "Todas")}
          {kindButton("product", "Só produto")}
          {kindButton("service", "Só serviço")}
        </div>
        <div className="flex rounded-lg border bg-white p-0.5">
          <button type="button" onClick={() => onOrder("recent")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${order === "recent" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Mais recentes</button>
          <button type="button" onClick={() => onOrder("oldest")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${order === "oldest" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Mais antigas</button>
        </div>
        <Button type="button" variant="outline" className="h-9" disabled={loading || hidingIssued || issuedCount === 0} onClick={() => onHideIssued(visible.filter(saleAlreadyIssued).map((sale) => sale.id))}>
          {hidingIssued ? "Tirando..." : `Tirar emitidas da lista${issuedCount ? ` (${issuedCount})` : ""}`}
        </Button>
        <span className="text-xs text-slate-500">
          {loading ? "Atualizando..." : `${visible.length} venda${visible.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="max-h-[calc(100vh-280px)] overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-[#16233a] text-left text-white">
            <tr>
              <th className="px-3 py-2 font-medium">Venda</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 text-right font-medium">Emitir</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((sale) => {
              const product = saleFlag(sale.has_product);
              const service = saleFlag(sale.has_service);
              const issued = saleAlreadyIssued(sale);
              return (
                <tr key={sale.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-800">{sale.sale_number}</td>
                  <td className="max-w-[240px] truncate px-3 py-1.5 text-slate-700">{sale.customer_name || "Consumidor"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{new Date(sale.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-900">{money(Number(sale.total || 0))}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-1">
                      {product ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Produto</span> : null}
                      {service ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">Serviço</span> : null}
                      {issued ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Nota emitida</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-1.5">
                      {product ? <Button size="sm" className="h-7 px-2.5" disabled={loading} onClick={() => onProduct(sale.id)}>NF-e / NFC-e</Button> : null}
                      {service ? <Button size="sm" variant="outline" className="h-7 px-2.5" disabled={loading} onClick={() => onService(sale.id)}>NFS-e</Button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && !visible.length ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                  Nenhuma venda neste filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {sorted.length
            ? `Mostrando ${pageStart + 1} a ${Math.min(pageStart + SALES_PAGE_SIZE, sorted.length)} de ${sorted.length}`
            : "Nenhuma venda nesta página"}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
          <span>{currentPage} / {pageCount}</span>
          <Button type="button" variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function fiscalCall(orgId: string, action: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiscal-invoice?action=${action}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session?.access_token || ""}`,
      "Content-Type": "application/json",
      "X-Organization-Id": orgId,
      ...(init?.headers || {}),
    },
  });
  if (action.includes("export") && response.ok) return response.text();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha na nota fiscal");
  return data;
}

export default function NotaFiscal() {
  const { activeOrgId } = useActiveOrganization();
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [monthCount, setMonthCount] = useState(0);
  const [from, setFrom] = useState("2022-10-01");
  const [to, setTo] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [issued, setIssued] = useState(0);
  const [classes, setClasses] = useState<FiscalClass[]>([]);
  const [screen, setScreen] = useState<"list" | "emit">("list");
  const [kind, setKind] = useState<"nfe" | "nfce" | "nfse">("nfe");
  const [lines, setLines] = useState<EmitLine[]>([]);
  const [source, setSource] = useState("avulsa");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [customer, setCustomer] = useState({
    name: "", document: "", email: "", phone: "", ie: "", street: "", number: "", district: "", city: "", uf: "", cep: "", isCompany: false, foreign: false,
  });
  const [natureza, setNatureza] = useState("Venda de Mercadoria");
  const [operacao, setOperacao] = useState("1");
  const [presenca, setPresenca] = useState("1");
  const [freteModo, setFreteModo] = useState("9");
  const [frete, setFrete] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [pagamento, setPagamento] = useState("0");
  const [forma, setForma] = useState("01");
  const [referenciar, setReferenciar] = useState(false);
  const [chaveReferencia, setChaveReferencia] = useState("");
  const [emitOpen, setEmitOpen] = useState(false);
  const [pageNotice, setPageNotice] = useState("");
  const [emitNotice, setEmitNotice] = useState("");
  const [cancelNotice, setCancelNotice] = useState("");
  const [returnNotice, setReturnNotice] = useState("");
  const [cceNotice, setCceNotice] = useState("");
  const [statusInvoice, setStatusInvoice] = useState<Invoice | null>(null);
  const [issuedDate, setIssuedDate] = useState(todayIso());
  const [issuedTime, setIssuedTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [moveDate, setMoveDate] = useState(todayIso());
  const [moveTime, setMoveTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [complemento, setComplemento] = useState("");
  const [emitTab, setEmitTab] = useState<"geral" | "transporte">("geral");
  const [carrierOn, setCarrierOn] = useState(false);
  const [carrierName, setCarrierName] = useState("");
  const [carrierCnpj, setCarrierCnpj] = useState("");
  const [carrierExtra, setCarrierExtra] = useState({ ie: "", endereco: "", uf: "", cidade: "", cep: "" });
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [returnTarget, setReturnTarget] = useState<Invoice | null>(null);
  const [returnCfop, setReturnCfop] = useState("1202");
  const [returnNatureza, setReturnNatureza] = useState("Devolução de mercadoria");
  const [returnItens, setReturnItens] = useState("");
  const [returnQtds, setReturnQtds] = useState("");
  const [cceKey, setCceKey] = useState("");
  const [cceText, setCceText] = useState("");
  const [volumes, setVolumes] = useState({ quantidade: "", especie: "", marca: "", numeracao: "", pesoLiquido: "", pesoBruto: "", lacres: "" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<"notas" | "product" | "service" | "avulsa" | "sales" | "cce" | "company" | "export">("notas");
  const [empresaId, setEmpresaId] = useState("");
  const [ambiente, setAmbiente] = useState("2");
  const [modeloPadrao, setModeloPadrao] = useState("nfe");
  const [salesLoading, setSalesLoading] = useState(false);
  const [sales, setSales] = useState<ReadySale[]>([]);
  const [salesQuery, setSalesQuery] = useState("");
  const [salesKind, setSalesKind] = useState<"all" | "product" | "service">("all");
  const [salesOrder, setSalesOrder] = useState<"recent" | "oldest">("recent");
  const [hidingIssued, setHidingIssued] = useState(false);
  const [avulsa, setAvulsa] = useState({ description: "", amount: "", tax: "", name: "", document: "", email: "" });
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!activeOrgId) return;
    const data = await fiscalCall(activeOrgId, "settings");
    setCompany(data.company);
    setMonthCount(data.monthCount || 0);
    if (data.company) {
      setEmpresaId(data.company.empresaId || "");
      setAmbiente(String(data.company.ambiente || 2));
      setModeloPadrao(data.company.modelo || "nfe");
      setNatureza(data.company.natureza || "Venda de Mercadoria");
    }
  }, [activeOrgId]);

  const loadInvoices = useCallback(async () => {
    if (!activeOrgId || !company) return;
    const data = await fiscalCall(activeOrgId, `invoices&from=${from}&to=${to}&q=${encodeURIComponent(query)}`);
    setInvoices(data.invoices || []);
    setIssued(data.issued || 0);
  }, [activeOrgId, company, from, to, query]);

  useEffect(() => { void loadSettings().catch((error) => setPageNotice(error instanceof Error ? error.message : "Falha na nota fiscal")); }, [loadSettings]);
  useEffect(() => { void loadInvoices().catch(() => undefined); }, [loadInvoices]);

  const productClasses = useMemo(() => classes.filter((item) => item.noteType !== "nfse" && item.ref), [classes]);
  const serviceClasses = useMemo(() => classes.filter((item) => item.noteType === "nfse" && item.ref), [classes]);

  async function ensureClasses() {
    if (!activeOrgId) return classes;
    const data = await fiscalCall(activeOrgId, "classes");
    setClasses(data.classes || []);
    if (data.mirrorWarning) setPageNotice(String(data.mirrorWarning));
    return data.classes || [];
  }

  function openEmit(nextKind: "nfe" | "nfce" | "nfse", nextLines: EmitLine[], nextSource: string, nextSourceId: string | null, name = "") {
    setKind(nextKind);
    setLines(nextLines);
    setSource(nextSource);
    setSourceId(nextSourceId);
    setCustomer((prev) => ({ ...prev, name }));
    setReferenciar(false);
    setChaveReferencia("");
    setOperacao("1");
    setEmitTab("geral");
    setCarrierOn(false);
    setCarrierName("");
    setCarrierCnpj("");
    setCarrierExtra({ ie: "", endereco: "", uf: "", cidade: "", cep: "" });
    setVolumes({ quantidade: "", especie: "", marca: "", numeracao: "", pesoLiquido: "", pesoBruto: "", lacres: "" });
    setEmitNotice("");
    setScreen("list");
    setEmitOpen(true);
    void ensureClasses().catch(() => undefined);
  }

  function saleFlag(value: boolean | string | undefined) {
    return value === true || value === "t" || value === "true";
  }

  function openFiscalTab(tab: (typeof PAGE_TABS)[number]["id"]) {
    setPageTab(tab);
    if (tab === "product" || tab === "service" || tab === "avulsa") {
      void ensureClasses().catch((error) => setPageNotice(error instanceof Error ? error.message : "Não foi possível listar as classes"));
    }
  }

  const openLastSales = useCallback(() => {
    if (!activeOrgId) return;
    setSalesLoading(true);
    void fiscalCall(activeOrgId, `sales&from=${from}&to=${to}`)
      .then((data) => setSales(data.sales || []))
      .catch((error) => {
        setSales([]);
        setPageNotice(error instanceof Error ? error.message : "Não foi possível listar as vendas");
      })
      .finally(() => setSalesLoading(false));
  }, [activeOrgId, from, to]);

  useEffect(() => {
    if (pageTab === "sales") openLastSales();
  }, [pageTab, openLastSales]);

  async function hideIssuedSales(ids: string[]) {
    if (!activeOrgId || !ids.length) return;
    setHidingIssued(true);
    try {
      const data = await fiscalCall(activeOrgId, "hide-issued-sales", { method: "POST", body: JSON.stringify({ ids }) });
      const hidden = Number(data.hidden || 0);
      toast({
        title: hidden ? "Vendas tiradas da lista" : "Nenhuma venda com nota emitida",
        description: hidden ? `${hidden} venda${hidden === 1 ? "" : "s"} com nota emitida saíram da lista deste período.` : "Não há venda com nota emitida neste período.",
      });
      openLastSales();
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "Não foi possível tirar as vendas da lista");
    } finally {
      setHidingIssued(false);
    }
  }

  async function openSale(id: string, nextKind: "nfe" | "nfce" | "nfse") {
    if (!activeOrgId) return;
    setSalesLoading(true);
    try {
      const data = await fiscalCall(activeOrgId, `sale&id=${id}`);
      const items = (data.items || []).filter((item: { item_type: string }) => nextKind === "nfse" ? item.item_type === "service" : item.item_type === "product");
      if (!items.length) {
        setPageNotice(nextKind === "nfse" ? "Esta venda não tem serviço" : "Esta venda não tem produto");
        return;
      }
      openEmit(nextKind, items.map((item: Record<string, unknown>, index: number) => ({
        key: String(item.id || index),
        product_id: item.item_type === "product" ? String(item.item_id || "") : undefined,
        service_id: item.item_type === "service" ? String(item.item_id || "") : undefined,
        item_type: item.item_type === "service" ? "service" : "product",
        name: String(item.name || ""),
        code: String(item.sku || ""),
        ncm: String(item.ncm || ""),
        origem: item.fiscal_origin != null && String(item.fiscal_origin) !== "" ? String(item.fiscal_origin) : "",
        quantity: Number(item.quantity || 1),
        price: Number(item.unit_price || 0),
        tax_class_ref: String(item.product_class || item.service_class || ""),
        description: String(item.name || ""),
      })), "pos_sale", id, data.sale?.customer_name || "");
      const payment = data.payments?.[0];
      const match = FORMAS.find((item) => item.method === payment?.method);
      if (match) setForma(match.code);
      setDesconto(String(data.sale?.discount_amount || 0));
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "Não foi possível abrir a emissão");
    } finally {
      setSalesLoading(false);
    }
  }

  useEffect(() => {
    const os = params.get("os");
    if (!os || !activeOrgId || !company) return;
    void fiscalCall(activeOrgId, `order&id=${os}`).then((data) => {
      const services = (data.items || []).filter((item: { item_type: string }) => item.item_type === "service");
      const base = services.length ? services : [{ name: data.order?.service_name || "Serviço", quantity: 1, unit_price: data.order?.total || 0, item_id: data.order?.id }];
      openEmit("nfse", base.map((item: Record<string, unknown>, index: number) => ({
        key: `os-${index}`,
        service_id: item.item_id ? String(item.item_id) : undefined,
        item_type: "service",
        name: String(item.name || "Serviço"),
        code: "",
        ncm: "",
        origem: "0",
        quantity: Number(item.quantity || 1),
        price: Number(item.unit_price || 0),
        tax_class_ref: String((data.classById || {})[String(item.item_id || "")] || ""),
        description: String(item.name || ""),
      })), "service_order", os, data.order?.client_name || "");
    }).catch((error) => setPageNotice(error instanceof Error ? error.message : "Não foi possível abrir a emissão"));
    // openEmit é estável o bastante para este efeito de deep-link da OS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, activeOrgId, company]);

  async function saveCompany() {
    if (!activeOrgId) return;
    setSaving(true);
    try {
      await fiscalCall(activeOrgId, "settings", { method: "POST", body: JSON.stringify({ empresa_id: empresaId, ambiente: Number(ambiente), modelo: modeloPadrao, natureza }) });
      setPageTab("notas");
      await loadSettings();
      toast({ title: "Empresa fiscal salva" });
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function correctProduct(line: EmitLine) {
    if (!activeOrgId || !line.product_id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/products/${line.product_id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json", "X-Organization-Id": activeOrgId },
      body: JSON.stringify({ ncm: line.ncm, fiscal_origin: line.origem, tax_class_ref: line.tax_class_ref }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEmitNotice(data.error || "Não foi possível gravar o produto");
      return;
    }
    toast({ title: "Produto atualizado" });
  }

  function noteWasRefused(status: string) {
    const value = status.toLowerCase();
    return value.includes("rejei") || value.includes("erro") || value.includes("recus");
  }

  async function emit() {
    if (!activeOrgId) return;
    setEmitNotice("");
    if (referenciar && chaveReferencia.replace(/\D/g, "").length !== 44) {
      setEmitNotice("Informe a chave de 44 dígitos da NF-e referenciada");
      return;
    }
    const missing = lines.find((line) => line.item_type === "product" && (line.origem === "" || line.ncm.replace(/\D/g, "").length !== 8 || !line.tax_class_ref));
    if (missing) {
      const field = missing.origem === "" ? "Origem do produto" : missing.ncm.replace(/\D/g, "").length !== 8 ? "Código NCM" : "Classe de imposto";
      setEmitNotice(`Informações do produto faltando: ${field}`);
      return;
    }
    if (kind === "nfse" && lines.some((line) => !line.tax_class_ref)) {
      setEmitNotice("Informe a classe de imposto do serviço");
      return;
    }
    if (customer.foreign) {
      const foreignId = customer.document.trim();
      if (foreignId.length < 5 || foreignId.length > 20) {
        setEmitNotice("Informe o documento do cliente estrangeiro (5 a 20 caracteres)");
        return;
      }
    } else if (kind !== "nfce" && customer.document.replace(/\D/g, "").length < 11) {
      setEmitNotice("Informe o CPF ou CNPJ do cliente");
      return;
    }
    setSaving(true);
    try {
      const formaInfo = FORMAS.find((item) => item.code === forma) || FORMAS[0];
      const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const data = await fiscalCall(activeOrgId, "emit", {
        method: "POST",
        body: JSON.stringify({
          kind, source, source_id: sourceId, customer, natureza, operacao: Number(operacao), presenca: Number(presenca), modalidade_frete: Number(freteModo),
          frete: Number(frete), desconto: Number(desconto), pagamento: Number(pagamento), modelo: kind === "nfce" ? "2" : "1",
          nfe_referenciada: referenciar ? chaveReferencia.replace(/\D/g, "") : "",
          data_emissao: `${issuedDate} ${issuedTime}:00`,
          data_entrada_saida: `${moveDate} ${moveTime}:00`,
          complemento,
          transporte: {
            incluir_transportadora: carrierOn,
            razao_social: carrierOn ? carrierName : "",
            cnpj: carrierOn ? carrierCnpj : "",
            ie: carrierOn ? carrierExtra.ie : "",
            endereco: carrierOn ? carrierExtra.endereco : "",
            uf: carrierOn ? carrierExtra.uf : "",
            cidade: carrierOn ? carrierExtra.cidade : "",
            cep: carrierOn ? carrierExtra.cep : "",
            volume: volumes.quantidade,
            especie: volumes.especie,
            marca: volumes.marca,
            numeracao: volumes.numeracao,
            peso_liquido: volumes.pesoLiquido,
            peso_bruto: volumes.pesoBruto,
            lacres: volumes.lacres,
          },
          payments: [{ method: formaInfo.method, code: formaInfo.code, amount: total }],
          corrections: lines.filter((line) => line.product_id).map((line) => ({ product_id: line.product_id, ncm: line.ncm, fiscal_origin: line.origem, tax_class_ref: line.tax_class_ref })),
          lines: lines.map((line) => ({ ...line, total: line.price * line.quantity })),
        }),
      });
      const status = String(data.status || "");
      const motivo = String(data.motivo || "");
      if (noteWasRefused(status)) {
        setStatusInvoice({
          id: String(data.invoiceId || ""),
          kind,
          number: data.number ? String(data.number) : null,
          customer_name: customer.name,
          created_at: new Date().toISOString(),
          amount: total,
          status,
          pdf_url: null,
          xml_url: null,
          access_key: null,
          motivo,
        });
      } else {
        toast({ title: status ? `Nota ${status}` : "Nota enviada", description: motivo || data.number || "" });
      }
      setEmitOpen(false);
      setScreen("list");
      await loadInvoices();
      await loadSettings();
    } catch (error) {
      setEmitNotice(error instanceof Error ? error.message : "Falha ao emitir");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    if (!activeOrgId || !cancelTarget) return;
    setCancelNotice("");
    setSaving(true);
    try {
      await fiscalCall(activeOrgId, "cancel", { method: "POST", body: JSON.stringify({ id: cancelTarget.id, motivo: cancelMotivo.trim() }) });
      toast({ title: "Nota cancelada" });
      setCancelTarget(null);
      setCancelMotivo("");
      await loadInvoices();
    } catch (error) {
      setCancelNotice(error instanceof Error ? error.message : "Falha ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmReturn() {
    if (!activeOrgId || !returnTarget?.access_key) return;
    setReturnNotice("");
    setSaving(true);
    try {
      const produtos = returnItens.split(/[,;\s]+/).map((item) => Number(item)).filter((item) => item > 0);
      const quantidade = returnQtds.split(/[,;\s]+/).map((item) => Number(item.replace(",", "."))).filter((item) => !Number.isNaN(item) && item > 0);
      if (quantidade.length && quantidade.length !== produtos.length) {
        setReturnNotice("Informe uma quantidade para cada item devolvido");
        setSaving(false);
        return;
      }
      const data = await fiscalCall(activeOrgId, "return", {
        method: "POST",
        body: JSON.stringify({
          chave: returnTarget.access_key,
          codigo_cfop: returnCfop,
          natureza: returnNatureza,
          amount: returnTarget.amount,
          customer_name: returnTarget.customer_name,
          ...(produtos.length ? { produtos, ...(quantidade.length ? { quantidade } : {}) } : {}),
        }),
      });
      toast({ title: data.status ? `Devolução ${data.status}` : "Devolução enviada" });
      setReturnTarget(null);
      await loadInvoices();
    } catch (error) {
      setReturnNotice(error instanceof Error ? error.message : "Falha na devolução");
    } finally {
      setSaving(false);
    }
  }

  async function sendCce() {
    if (!activeOrgId) return;
    setCceNotice("");
    setSaving(true);
    try {
      const data = await fiscalCall(activeOrgId, "cce", { method: "POST", body: JSON.stringify({ chave: cceKey, correcao: cceText.trim() }) });
      toast({ title: data.status ? `Carta ${data.status}` : "Carta enviada" });
      setCceText("");
      await loadInvoices();
    } catch (error) {
      setCceNotice(error instanceof Error ? error.message : "Falha na carta de correção");
    } finally {
      setSaving(false);
    }
  }

  async function refresh(id: string) {
    if (!activeOrgId) return;
    try {
      await fiscalCall(activeOrgId, "refresh", { method: "POST", body: JSON.stringify({ id }) });
      await loadInvoices();
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "Falha ao consultar");
    }
  }

  async function remove(id: string) {
    if (!activeOrgId) return;
    try {
      await fiscalCall(activeOrgId, "delete", { method: "POST", body: JSON.stringify({ id }) });
      await loadInvoices();
    } catch (error) {
      setPageNotice(error instanceof Error ? error.message : "Não foi possível excluir");
    }
  }

  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const classOptions = kind === "nfse" ? serviceClasses : productClasses;
  const openStatus = statusInvoice ? (invoices.find((item) => item.id === statusInvoice.id) || statusInvoice) : null;

  if (!featuresLoading && !hasFeature("nota_fiscal")) {
    return <CRMLayout activeView="nota-fiscal" onViewChange={() => {}}><div className="p-8">Peça ao administrador para habilitar Nota fiscal nesta empresa.</div></CRMLayout>;
  }

  return (
    <CRMLayout activeView="nota-fiscal" onViewChange={() => {}}>
      <div className="space-y-4 p-4 md:p-6">
        <FiscalErrorNotice message={pageNotice} />
        {screen === "list" ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Nota Fiscal</h1>
                  <p className="text-sm text-slate-600">{company?.name || "Empresa não configurada"} {company?.cnpj ? `· ${company.cnpj}` : ""}</p>
                  <p className="text-xs text-slate-500">Última emissão: {company?.lastEmission || "—"}</p>
                  <p className="mt-2 inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">Até {company?.limit || 50} notas no mês sem custo extra · depois, R$ 0,45 · neste mês: {monthCount}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => openFiscalTab("company")}>Editar empresa</Button>
            </div>
            <nav className="overflow-x-auto rounded-2xl bg-slate-100/90 p-1.5" aria-label="Seções da nota fiscal">
              <div className="flex min-w-max gap-1">
                {PAGE_TABS.map(({ id, label, icon: Icon }) => {
                  const active = pageTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${active ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}
                      onClick={() => openFiscalTab(id)}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-200 ${active ? "bg-blue-600 text-white" : "bg-white text-slate-400"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </nav>
            <div key={pageTab} className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-300">
            <p className="text-sm text-slate-500">{PAGE_TABS.find((tab) => tab.id === pageTab)?.caption}</p>
            {pageTab === "notas" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600">No período</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{invoices.length}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Autorizadas</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{issued}</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{money(total)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div><p className="mb-1 text-[11px] font-medium text-slate-500">De</p><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 w-40" /></div>
                  <div><p className="mb-1 text-[11px] font-medium text-slate-500">Até</p><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 w-40" /></div>
                  <div className="min-w-56 flex-1"><p className="mb-1 text-[11px] font-medium text-slate-500">Contato</p><Input placeholder="Nome ou número" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9" /></div>
                </div>
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Tipo</th>
                        <th className="px-3 py-3 font-medium">Nº</th>
                        <th className="px-3 py-3 font-medium">Cliente</th>
                        <th className="px-3 py-3 font-medium">Data de envio</th>
                        <th className="px-3 py-3 font-medium">Valor</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => {
                        const kind = kindMeta(invoice.kind);
                        return (
                          <tr key={invoice.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/80">
                            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${kind.className}`}>{kind.label}</span></td>
                            <td className="px-3 py-3 font-medium text-slate-900">{invoice.number || "s/n"}</td>
                            <td className="max-w-xs truncate px-3 py-3 text-slate-700">{invoice.customer_name}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-slate-500">{new Date(invoice.created_at).toLocaleString("pt-BR")}</td>
                            <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{money(Number(invoice.amount || 0))}</td>
                            <td className="px-3 py-3">
                              <button type="button" title={invoice.motivo && !["aprovado", "processado", "cancelado"].includes(invoice.status) ? "Ver motivo" : "Atualizar status"} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusMeta(invoice.status)}`} onClick={() => { if (invoice.motivo && !["aprovado", "processado", "cancelado"].includes(invoice.status)) setStatusInvoice(invoice); else void refresh(invoice.id); }}>{invoice.status}</button>
                              {invoice.motivo && !["aprovado", "processado", "cancelado"].includes(invoice.status) ? <p className="mt-1 max-w-xs text-xs text-rose-700">{invoice.motivo}</p> : null}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {invoice.pdf_url ? <a className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100" href={invoice.pdf_url} target="_blank" rel="noreferrer">PDF</a> : null}
                                {invoice.xml_url ? <a className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100" href={invoice.xml_url} target="_blank" rel="noreferrer">XML</a> : null}
                                {invoice.cce_url ? <a className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100" href={invoice.cce_url} target="_blank" rel="noreferrer">CC-e</a> : null}
                                {invoice.status === "aprovado" ? <button type="button" className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100" onClick={() => { setCancelNotice(""); setCancelTarget(invoice); setCancelMotivo(""); }}>Cancelar</button> : null}
                                {invoice.kind === "nfe" && invoice.status === "aprovado" && invoice.access_key ? <button type="button" className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200" onClick={() => { setReturnNotice(""); setReturnTarget(invoice); setReturnCfop("1202"); setReturnNatureza("Devolução de mercadoria"); setReturnItens(""); setReturnQtds(""); }}>Devolver</button> : null}
                                {!["aprovado", "cancelado", "processado"].includes(invoice.status) ? <button type="button" className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => void remove(invoice.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!invoices.length ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={7}>Nenhuma nota no período.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {pageTab === "product" || pageTab === "service" ? (
              <TaxClassDialogs
                orgId={activeOrgId || ""}
                which={pageTab}
                classes={classes}
                embedded
                onClose={() => setPageTab("notas")}
                onSaved={async () => { await ensureClasses(); }}
                toast={toast}
              />
            ) : null}
            {pageTab === "sales" ? (
              <SalesReadyList
                sales={sales}
                loading={salesLoading}
                from={from}
                to={to}
                query={salesQuery}
                kind={salesKind}
                onFrom={setFrom}
                onTo={setTo}
                onQuery={setSalesQuery}
                onKind={setSalesKind}
                order={salesOrder}
                onOrder={setSalesOrder}
                hidingIssued={hidingIssued}
                onHideIssued={(ids) => void hideIssuedSales(ids)}
                saleFlag={saleFlag}
                onProduct={(id) => void openSale(id, company?.modelo === "nfce" ? "nfce" : "nfe")}
                onService={(id) => void openSale(id, "nfse")}
              />
            ) : null}
            {pageTab === "avulsa" ? (
              <div className="max-w-xl space-y-2">
                <h2 className="text-lg font-semibold">NFSe Avulsa</h2>
                <Textarea placeholder="Discriminação" value={avulsa.description} onChange={(event) => setAvulsa({ ...avulsa, description: event.target.value })} />
                <Input placeholder="Valor" value={avulsa.amount} onChange={(event) => setAvulsa({ ...avulsa, amount: event.target.value })} />
                <Select value={avulsa.tax || "none"} onValueChange={(value) => setAvulsa({ ...avulsa, tax: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Classe de imposto</SelectItem>
                    {serviceClasses.filter((item) => item.ref).map((item) => <SelectItem key={item.ref} value={item.ref}>{item.ref}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Nome do tomador" value={avulsa.name} onChange={(event) => setAvulsa({ ...avulsa, name: event.target.value })} />
                <Input placeholder="CPF/CNPJ" value={avulsa.document} onChange={(event) => setAvulsa({ ...avulsa, document: event.target.value })} />
                <Input placeholder="E-mail" value={avulsa.email} onChange={(event) => setAvulsa({ ...avulsa, email: event.target.value })} />
                <Button onClick={() => {
                  openEmit("nfse", [{ key: "avulsa", item_type: "service", name: avulsa.description || "Serviço", code: "", ncm: "", origem: "0", quantity: 1, price: Number(avulsa.amount || 0), tax_class_ref: avulsa.tax, description: avulsa.description }], "avulsa", null, avulsa.name);
                  setCustomer((prev) => ({ ...prev, name: avulsa.name, document: avulsa.document, email: avulsa.email }));
                  setPageTab("notas");
                }}>Continuar</Button>
              </div>
            ) : null}
            {pageTab === "cce" ? (
              <div className="max-w-xl space-y-3">
                <FiscalErrorNotice message={cceNotice} />
                <h2 className="text-lg font-semibold">Carta de Correção</h2>
                <p className="text-sm text-slate-600">A carta corrige dados acessórios da NF-e. Não altera valor, quantidade, destinatário, data de emissão nem o número da nota.</p>
                <div><Label>NF-e</Label>
                  <Select value={cceKey || undefined} onValueChange={setCceKey}><SelectTrigger><SelectValue placeholder="Escolha a nota" /></SelectTrigger><SelectContent>
                    {invoices.filter((invoice) => invoice.kind === "nfe" && invoice.access_key).map((invoice) => <SelectItem key={invoice.id} value={invoice.access_key || invoice.id}>{invoice.number || "s/n"} · {invoice.customer_name}</SelectItem>)}
                  </SelectContent></Select>
                </div>
                <div><Label>Correção</Label><Textarea value={cceText} onChange={(event) => setCceText(event.target.value)} placeholder="Descreva a correção, entre 15 e 1000 caracteres" /></div>
                <Button disabled={saving} onClick={() => void sendCce()}>{saving ? "Enviando..." : "Emitir carta"}</Button>
              </div>
            ) : null}
            {pageTab === "company" ? (
              <div className="max-w-xl space-y-3">
                <h2 className="text-lg font-semibold">Alternar Empresa</h2>
                <p className="text-sm">{company?.name || "Nome vem do Agilize Total"} {company?.cnpj ? `· ${company.cnpj}` : ""}</p>
                {company?.bubbleEnv === "test" ? <p className="text-xs text-amber-700">Esta empresa está na versão de desenvolvimento do Agilize Total.</p> : null}
                <div><Label>ID da empresa no Agilize Total</Label><Input value={empresaId} onChange={(event) => setEmpresaId(event.target.value)} /></div>
                <div><Label>Ambiente</Label>
                  <Select value={ambiente} onValueChange={setAmbiente}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2">Homologação</SelectItem><SelectItem value="1">Produção</SelectItem></SelectContent></Select>
                </div>
                <div><Label>Modelo padrão do produto</Label>
                  <Select value={modeloPadrao} onValueChange={setModeloPadrao}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nfe">NF-e</SelectItem><SelectItem value="nfce">NFC-e</SelectItem></SelectContent></Select>
                </div>
                <div><Label>Natureza padrão</Label><Input value={natureza} onChange={(event) => setNatureza(event.target.value)} /></div>
                <Button onClick={() => void saveCompany()} disabled={saving}>Salvar</Button>
              </div>
            ) : null}
            {pageTab === "export" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Exportar Notas</h2>
                <div className="flex flex-wrap items-end gap-2">
                  <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
                  <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
                  <Input placeholder="Contato" value={query} onChange={(event) => setQuery(event.target.value)} className="w-56" />
                </div>
                <Button onClick={() => { if (!activeOrgId) return; void fiscalCall(activeOrgId, `export&from=${from}&to=${to}&q=${encodeURIComponent(query)}`).then((csv) => { const blob = new Blob([String(csv)], { type: "text/csv" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "notas.csv"; link.click(); }); }}>Baixar CSV</Button>
              </div>
            ) : null}
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={emitOpen} onOpenChange={setEmitOpen}>
        <DialogContent className="max-w-5xl overflow-y-auto bg-white p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-semibold">{kind === "nfse" ? "Emitir NFSe" : "Emitir NFe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <FiscalErrorNotice message={emitNotice} />
            <p className="font-medium">{kind === "nfse" ? "Informações dos serviços:" : "Informações dos produtos:"}</p>
            {lines.map((line, index) => {
              const missing = line.item_type === "product"
                ? (line.origem === "" ? "Origem do produto" : line.ncm.replace(/\D/g, "").length !== 8 ? "Código NCM" : !line.tax_class_ref ? "Classe de imposto" : "")
                : (!line.tax_class_ref ? "Classe de imposto" : "");
              const editing = editingKey === line.key;
              return (
                <div key={line.key} className={`rounded border px-2 py-1.5 ${missing ? "border-red-200 bg-red-50" : "bg-white"}`}>
                  {missing ? (
                    <div className="mb-1 flex items-center justify-center gap-2 text-xs leading-none text-red-600">
                      <span>Informações do produto faltando: {missing}</span>
                      {line.product_id ? <Button size="sm" className="h-6 rounded-full bg-blue-600 px-2 text-xs text-white hover:bg-blue-700" onClick={() => void correctProduct(line)}>Clique para Corrigir</Button> : null}
                    </div>
                  ) : null}
                  <div className="flex items-end gap-1 overflow-x-auto">
                    <div className="w-36 shrink-0">
                      <p className="text-[11px] leading-none text-slate-500">{line.item_type === "service" ? "Serviço" : "Produto"}</p>
                      <p className="truncate text-xs font-medium leading-4">{line.name}</p>
                      <button type="button" className="text-[11px] leading-none underline" onClick={() => setEditingKey(editing ? null : line.key)}>Editar</button>
                    </div>
                    <div className="w-20 shrink-0"><p className="text-[11px] leading-none text-slate-500">Valor Unit.</p><Input className="h-7 px-2" value={String(line.price)} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, price: Number(event.target.value) } : item))} /></div>
                    <div className="w-14 shrink-0"><p className="text-[11px] leading-none text-slate-500">Qntd.</p><Input className="h-7 px-2" value={String(line.quantity)} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} /></div>
                    <div className="w-24 shrink-0"><p className="text-[11px] leading-none text-slate-500">Subtotal</p><p className="flex h-7 items-center text-xs">{money(line.price * line.quantity)}</p></div>
                    <div className="w-24 shrink-0"><p className="text-[11px] leading-none text-slate-500">Código prod</p><Input className="h-7 px-2" value={line.code} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, code: event.target.value } : item))} /></div>
                    {line.item_type === "product" ? <div className="w-24 shrink-0"><p className="text-[11px] leading-none text-slate-500">NCM</p><Input className="h-7 px-2" value={line.ncm} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, ncm: event.target.value.replace(/\D/g, "").slice(0, 8) } : item))} /></div> : null}
                    <div className="w-32 shrink-0">
                      <p className="text-[11px] leading-none text-slate-500">Classe imposto</p>
                      <Select value={line.tax_class_ref || "none"} onValueChange={(value) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, tax_class_ref: value === "none" ? "" : value } : item))}>
                        <SelectTrigger className="h-7"><SelectValue placeholder="Classe" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Classe</SelectItem>
                          {classOptions.filter((item) => item.ref).map((item) => <SelectItem key={item.ref} value={item.ref}>{item.ref}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {line.item_type === "product" && (missing || editing) ? (
                      <div className="w-28 shrink-0">
                        <p className="text-[11px] leading-none text-slate-500">Origem</p>
                        <Select value={line.origem === "" ? "none" : line.origem} onValueChange={(value) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, origem: value === "none" ? "" : value } : item))}>
                          <SelectTrigger className="h-7"><SelectValue placeholder="Origem" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione</SelectItem>
                            {["0", "1", "2", "3", "4", "5", "6", "7", "8"].map((origin) => <SelectItem key={origin} value={origin}>{origin}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end">
              <div className="w-40">
                <p className="text-[11px] text-slate-500">Valor total:</p>
                <Input readOnly value={lines.reduce((sum, line) => sum + line.price * line.quantity, 0).toFixed(2)} />
              </div>
            </div>
            {kind !== "nfse" ? (
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-2 border-b bg-slate-100 text-sm">
                  <button type="button" className={`py-2 ${emitTab === "geral" ? "bg-white font-medium" : "text-slate-600"}`} onClick={() => setEmitTab("geral")}>Informações gerais</button>
                  <button type="button" className={`py-2 ${emitTab === "transporte" ? "bg-white font-medium" : "text-slate-600"}`} onClick={() => setEmitTab("transporte")}>Transporte</button>
                </div>
                {emitTab === "geral" ? (
                  <div className="space-y-2 p-3">
                    <div className="grid gap-2 md:grid-cols-6">
                      <div><p className="text-[11px]">Data de emissão:</p><Input className="h-8" type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} /></div>
                      <div><p className="text-[11px]">&nbsp;</p><Input className="h-8" type="time" value={issuedTime} onChange={(event) => setIssuedTime(event.target.value)} /></div>
                      <div><p className="text-[11px]">Entrada/saída:</p><Input className="h-8" type="date" value={moveDate} onChange={(event) => setMoveDate(event.target.value)} /></div>
                      <div><p className="text-[11px]">&nbsp;</p><Input className="h-8" type="time" value={moveTime} onChange={(event) => setMoveTime(event.target.value)} /></div>
                      <div className="md:col-span-2"><p className="text-[11px]">Natureza da Operação:</p><Input className="h-8" value={natureza} onChange={(event) => setNatureza(event.target.value)} /></div>
                      <div><p className="text-[11px]">Modelo:</p>
                        <Select value={kind} onValueChange={(value) => setKind(value as "nfe" | "nfce")}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nfe">1 - NF-e</SelectItem><SelectItem value="nfce">2 - NFC-e</SelectItem></SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Finalidade:</p><Input className="h-8" value="1 - Normal" readOnly /></div>
                      <div><p className="text-[11px]">Operação:</p>
                        <Select value={operacao} onValueChange={setOperacao}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 - Saída</SelectItem><SelectItem value="0">0 - Entrada</SelectItem></SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Presença:</p>
                        <Select value={presenca} onValueChange={setPresenca}><SelectTrigger className="h-8"><SelectValue placeholder="Digite" /></SelectTrigger><SelectContent><SelectItem value="0">0 - Não se aplica</SelectItem><SelectItem value="1">1 - Operação presencial</SelectItem><SelectItem value="2">2 - Internet</SelectItem><SelectItem value="3">3 - Teleatendimento</SelectItem><SelectItem value="4">4 - Entrega</SelectItem><SelectItem value="5">5 - Presencial fora do estabelecimento</SelectItem><SelectItem value="9">9 - Outros</SelectItem></SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Modalidade frete:</p>
                        <Select value={freteModo} onValueChange={setFreteModo}><SelectTrigger className="h-8"><SelectValue placeholder="Digite" /></SelectTrigger><SelectContent><SelectItem value="9">9 - Sem frete</SelectItem><SelectItem value="0">0 - Emitente</SelectItem><SelectItem value="1">1 - Destinatário</SelectItem><SelectItem value="2">2 - Terceiros</SelectItem><SelectItem value="3">3 - Transporte próprio do remetente</SelectItem><SelectItem value="4">4 - Transporte próprio do destinatário</SelectItem></SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Frete:</p><Input className="h-8" value={frete} onChange={(event) => setFrete(event.target.value)} /></div>
                      <div><p className="text-[11px]">Forma de pagamento:</p>
                        <Select value={forma} onValueChange={setForma}><SelectTrigger className="h-8"><SelectValue placeholder="Digite" /></SelectTrigger><SelectContent>{FORMAS.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Pagamento:</p>
                        <Select value={pagamento} onValueChange={setPagamento}><SelectTrigger className="h-8"><SelectValue placeholder="Digite" /></SelectTrigger><SelectContent><SelectItem value="0">0 - À vista</SelectItem><SelectItem value="1">1 - A prazo</SelectItem></SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Desconto:</p><Input className="h-8" value={desconto} onChange={(event) => setDesconto(event.target.value)} /></div>
                    </div>
                    <div className="flex items-center gap-2"><Switch checked={referenciar} onCheckedChange={setReferenciar} /><span>Referenciar outra NF-e</span></div>
                    {referenciar ? <Input className="h-8" placeholder="Chave de 44 dígitos" value={chaveReferencia} onChange={(event) => setChaveReferencia(event.target.value.replace(/\D/g, "").slice(0, 44))} /> : null}
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={carrierOn} onCheckedChange={setCarrierOn} />
                      <span className="text-sm">Adicionar informações da transportadora</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <Input className="h-9 bg-slate-100" placeholder="Nome da transportadora" disabled={!carrierOn} value={carrierName} onChange={(event) => setCarrierName(event.target.value)} />
                      <Input className="h-9 bg-slate-100" placeholder="CNPJ transportadora" disabled={!carrierOn} value={carrierCnpj} onChange={(event) => setCarrierCnpj(event.target.value)} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input className="h-9 bg-slate-100" placeholder="Inscrição estadual" disabled={!carrierOn} value={carrierExtra.ie} onChange={(event) => setCarrierExtra({ ...carrierExtra, ie: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Endereço" disabled={!carrierOn} value={carrierExtra.endereco} onChange={(event) => setCarrierExtra({ ...carrierExtra, endereco: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Cidade" disabled={!carrierOn} value={carrierExtra.cidade} onChange={(event) => setCarrierExtra({ ...carrierExtra, cidade: event.target.value })} />
                      <div className="grid grid-cols-[80px_1fr] gap-3">
                        <Input className="h-9 bg-slate-100" placeholder="UF" disabled={!carrierOn} value={carrierExtra.uf} onChange={(event) => setCarrierExtra({ ...carrierExtra, uf: event.target.value.toUpperCase().slice(0, 2) })} />
                        <Input className="h-9 bg-slate-100" placeholder="CEP" disabled={!carrierOn} value={carrierExtra.cep} onChange={(event) => setCarrierExtra({ ...carrierExtra, cep: event.target.value })} />
                      </div>
                    </div>
                    <p className="text-sm">Volumes</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input className="h-9 bg-slate-100" placeholder="Quantidade" value={volumes.quantidade} onChange={(event) => setVolumes({ ...volumes, quantidade: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Espécie" value={volumes.especie} onChange={(event) => setVolumes({ ...volumes, especie: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Marca" value={volumes.marca} onChange={(event) => setVolumes({ ...volumes, marca: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Numeração" value={volumes.numeracao} onChange={(event) => setVolumes({ ...volumes, numeracao: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Peso líquido" value={volumes.pesoLiquido} onChange={(event) => setVolumes({ ...volumes, pesoLiquido: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Peso bruto" value={volumes.pesoBruto} onChange={(event) => setVolumes({ ...volumes, pesoBruto: event.target.value })} />
                      <Input className="h-9 bg-slate-100" placeholder="Lacres" value={volumes.lacres} onChange={(event) => setVolumes({ ...volumes, lacres: event.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            <p className="border-t pt-2 font-medium">Informações do cliente:</p>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="flex items-center gap-2"><Switch checked={customer.isCompany} onCheckedChange={(checked) => setCustomer({ ...customer, isCompany: checked })} /><span>Nota fiscal para empresa</span></div>
              <div className="flex items-center gap-2"><Switch checked={customer.foreign} onCheckedChange={(checked) => setCustomer({ ...customer, foreign: checked, uf: checked ? "EX" : customer.uf === "EX" ? "" : customer.uf })} /><span>Cliente no exterior</span></div>
              <div><p className="text-[11px]">Nome do contato</p><Input className="h-8" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></div>
              <div><p className="text-[11px]">{customer.foreign ? "Documento estrangeiro" : "CPF/CNPJ"}</p><Input className="h-8" value={customer.document} onChange={(event) => setCustomer({ ...customer, document: event.target.value })} /></div>
              <div className="md:col-span-2"><p className="text-[11px]">Logradouro</p><Input className="h-8" value={customer.street} onChange={(event) => setCustomer({ ...customer, street: event.target.value })} /></div>
              <div><p className="text-[11px]">CEP</p><Input className="h-8" value={customer.cep} onChange={(event) => setCustomer({ ...customer, cep: event.target.value })} /></div>
              <div><p className="text-[11px]">Cidade</p><Input className="h-8" value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></div>
              <div><p className="text-[11px]">Bairro</p><Input className="h-8" value={customer.district} onChange={(event) => setCustomer({ ...customer, district: event.target.value })} /></div>
              <div><p className="text-[11px]">Número</p><Input className="h-8" value={customer.number} onChange={(event) => setCustomer({ ...customer, number: event.target.value })} /></div>
              <div><p className="text-[11px]">UF</p><Input className="h-8" value={customer.foreign ? "EX" : customer.uf} readOnly={customer.foreign} onChange={(event) => setCustomer({ ...customer, uf: event.target.value.toUpperCase().slice(0, 2) })} /></div>
              <div className="md:col-span-2"><p className="text-[11px]">Email</p><Input className="h-8" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /><p className="text-[11px] text-slate-500">O PDF e o XML da nota emitida serão enviados para o email informado.</p></div>
              {kind !== "nfse" ? <div><p className="text-[11px]">Inscrição Estadual</p><Input className="h-8" value={customer.ie} onChange={(event) => setCustomer({ ...customer, ie: event.target.value })} /><p className="text-[11px] text-slate-500">Obrigatório caso o cliente tiver Inscrição Estadual</p></div> : null}
              <div className="md:col-span-3"><p className="text-[11px]">Informações Complementares (opcional)</p><Textarea value={complemento} onChange={(event) => setComplemento(event.target.value)} /></div>
            </div>
            <div className="flex justify-center pt-2">
              <Button className="bg-blue-700 px-8 hover:bg-blue-800" onClick={() => void emit()} disabled={saving}>{saving ? "Emitindo..." : "EMITIR NOTA"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelNotice(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar nota</DialogTitle></DialogHeader>
          <FiscalErrorNotice message={cancelNotice} />
          <p className="text-sm text-slate-600">Informe o motivo do cancelamento, entre 15 e 255 caracteres.</p>
          <Textarea value={cancelMotivo} onChange={(event) => setCancelMotivo(event.target.value.slice(0, 255))} />
          <Button disabled={saving || cancelMotivo.trim().length < 15} onClick={() => void confirmCancel()}>{saving ? "Cancelando..." : "Confirmar cancelamento"}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(returnTarget)} onOpenChange={(open) => { if (!open) { setReturnTarget(null); setReturnNotice(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Devolver NF-e</DialogTitle></DialogHeader>
          <FiscalErrorNotice message={returnNotice} />
          <p className="text-sm text-slate-600">A Webmania monta o vínculo com a nota de origem. Deixe os itens em branco para devolver a nota inteira.</p>
          <div><Label>CFOP</Label><Input value={returnCfop} onChange={(event) => setReturnCfop(event.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
          <div><Label>Natureza</Label><Input value={returnNatureza} onChange={(event) => setReturnNatureza(event.target.value)} /></div>
          <div><Label>Itens parciais</Label><Input placeholder="Números dos itens, começando em 1" value={returnItens} onChange={(event) => setReturnItens(event.target.value)} /></div>
          <div><Label>Quantidades</Label><Input placeholder="Uma quantidade para cada item" value={returnQtds} onChange={(event) => setReturnQtds(event.target.value)} /></div>
          <Button disabled={saving || returnCfop.length !== 4} onClick={() => void confirmReturn()}>{saving ? "Enviando..." : "Emitir devolução"}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(openStatus)} onOpenChange={(open) => { if (!open) setStatusInvoice(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo da nota</DialogTitle></DialogHeader>
          {openStatus?.motivo ? <FiscalErrorNotice message={openStatus.motivo} /> : <p className="text-sm text-slate-600">Status: {openStatus?.status}</p>}
          {openStatus?.id ? <Button variant="outline" onClick={() => void refresh(openStatus.id)}>Atualizar status</Button> : null}
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
