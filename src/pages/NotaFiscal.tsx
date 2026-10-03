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
import { FileText, Trash2 } from "lucide-react";
import { TaxClassDialogs, type FiscalClass } from "@/components/fiscal/TaxClassDialogs";

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
  { code: "01", label: "Dinheiro", method: "dinheiro" },
  { code: "17", label: "PIX", method: "pix" },
  { code: "03", label: "Cartão de crédito", method: "cartao_credito" },
  { code: "04", label: "Cartão de débito", method: "cartao_debito" },
  { code: "15", label: "Boleto", method: "boleto" },
  { code: "16", label: "Transferência", method: "transferencia_bancaria" },
  { code: "99", label: "Outros", method: "outros" },
];

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
    name: "", document: "", email: "", phone: "", ie: "", street: "", number: "", district: "", city: "", uf: "", cep: "", isCompany: false,
  });
  const [natureza, setNatureza] = useState("Venda de Mercadoria");
  const [presenca, setPresenca] = useState("1");
  const [freteModo, setFreteModo] = useState("9");
  const [frete, setFrete] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [pagamento, setPagamento] = useState("0");
  const [forma, setForma] = useState("01");
  const [referenciar, setReferenciar] = useState(false);
  const [emitOpen, setEmitOpen] = useState(false);
  const [issuedDate, setIssuedDate] = useState(todayIso());
  const [issuedTime, setIssuedTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [moveDate, setMoveDate] = useState(todayIso());
  const [moveTime, setMoveTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [complemento, setComplemento] = useState("");
  const [emitTab, setEmitTab] = useState<"geral" | "transporte">("geral");
  const [carrierOn, setCarrierOn] = useState(false);
  const [carrierName, setCarrierName] = useState("");
  const [carrierCnpj, setCarrierCnpj] = useState("");
  const [volumes, setVolumes] = useState({ quantidade: "", especie: "", marca: "", numeracao: "", pesoLiquido: "", pesoBruto: "", lacres: "" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<"notas" | "product" | "service" | "avulsa" | "sales" | "cce" | "company" | "export">("notas");
  const [empresaId, setEmpresaId] = useState("");
  const [ambiente, setAmbiente] = useState("2");
  const [modeloPadrao, setModeloPadrao] = useState("nfe");
  const [salesLoading, setSalesLoading] = useState(false);
  const [sales, setSales] = useState<{ id: string; sale_number: number; customer_name: string; created_at: string; total?: number; has_product: boolean | string; has_service: boolean | string }[]>([]);
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

  useEffect(() => { void loadSettings().catch((error) => toast({ title: error.message, variant: "destructive" })); }, [loadSettings, toast]);
  useEffect(() => { void loadInvoices().catch(() => undefined); }, [loadInvoices]);

  const productClasses = useMemo(() => classes.filter((item) => item.noteType !== "nfse" && item.ref), [classes]);
  const serviceClasses = useMemo(() => classes.filter((item) => item.noteType === "nfse" && item.ref), [classes]);

  async function ensureClasses() {
    if (!activeOrgId) return classes;
    const data = await fiscalCall(activeOrgId, "classes");
    setClasses(data.classes || []);
    return data.classes || [];
  }

  function openEmit(nextKind: "nfe" | "nfce" | "nfse", nextLines: EmitLine[], nextSource: string, nextSourceId: string | null, name = "") {
    setKind(nextKind);
    setLines(nextLines);
    setSource(nextSource);
    setSourceId(nextSourceId);
    setCustomer((prev) => ({ ...prev, name }));
    setReferenciar(false);
    setEmitTab("geral");
    setCarrierOn(false);
    setCarrierName("");
    setCarrierCnpj("");
    setVolumes({ quantidade: "", especie: "", marca: "", numeracao: "", pesoLiquido: "", pesoBruto: "", lacres: "" });
    setScreen("list");
    setEmitOpen(true);
    void ensureClasses().catch(() => undefined);
  }

  function saleFlag(value: boolean | string | undefined) {
    return value === true || value === "t" || value === "true";
  }

  function openFiscalTab(tab: "notas" | "product" | "service" | "avulsa" | "sales" | "cce" | "company" | "export") {
    setPageTab(tab);
    if (tab === "product" || tab === "service" || tab === "avulsa") {
      void ensureClasses().catch((error) => toast({ title: error instanceof Error ? error.message : "Não foi possível listar as classes", variant: "destructive" }));
    }
    if (tab === "sales") openLastSales();
  }

  function openLastSales() {
    if (!activeOrgId) return;
    setSalesLoading(true);
    void fiscalCall(activeOrgId, `sales&from=${from}&to=${to}&q=${encodeURIComponent(query)}`)
      .then((data) => setSales(data.sales || []))
      .catch((error) => {
        setSales([]);
        toast({ title: error instanceof Error ? error.message : "Não foi possível listar as vendas", variant: "destructive" });
      })
      .finally(() => setSalesLoading(false));
  }

  async function openSale(id: string, nextKind: "nfe" | "nfce" | "nfse") {
    if (!activeOrgId) return;
    setSalesLoading(true);
    try {
      const data = await fiscalCall(activeOrgId, `sale&id=${id}`);
      const items = (data.items || []).filter((item: { item_type: string }) => nextKind === "nfse" ? item.item_type === "service" : item.item_type === "product");
      if (!items.length) {
        toast({ title: nextKind === "nfse" ? "Esta venda não tem serviço" : "Esta venda não tem produto", variant: "destructive" });
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
      toast({ title: error instanceof Error ? error.message : "Não foi possível abrir a emissão", variant: "destructive" });
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
    }).catch((error) => toast({ title: error.message, variant: "destructive" }));
    // openEmit é estável o bastante para este efeito de deep-link da OS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, activeOrgId, company, toast]);

  async function saveCompany() {
    if (!activeOrgId) return;
    setSaving(true);
    try {
      await fiscalCall(activeOrgId, "settings", { method: "POST", body: JSON.stringify({ empresa_id: empresaId, ambiente: Number(ambiente), modelo: modeloPadrao, natureza }) });
      setPageTab("notas");
      await loadSettings();
      toast({ title: "Empresa fiscal salva" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Erro ao salvar", variant: "destructive" });
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
      toast({ title: data.error || "Não foi possível gravar o produto", variant: "destructive" });
      return;
    }
    toast({ title: "Produto atualizado" });
  }

  async function emit() {
    if (!activeOrgId) return;
    if (referenciar) {
      toast({ title: "A devolução por referência fica para a próxima etapa", variant: "destructive" });
      return;
    }
    const missing = lines.find((line) => line.item_type === "product" && (line.origem === "" || line.ncm.replace(/\D/g, "").length !== 8 || !line.tax_class_ref));
    if (missing) {
      const field = missing.origem === "" ? "Origem do produto" : missing.ncm.replace(/\D/g, "").length !== 8 ? "Código NCM" : "Classe de imposto";
      toast({ title: `Informações do produto faltando: ${field}`, variant: "destructive" });
      return;
    }
    if (kind === "nfse" && lines.some((line) => !line.tax_class_ref)) {
      toast({ title: "Informe a classe de imposto do serviço", variant: "destructive" });
      return;
    }
    if (kind !== "nfce" && customer.document.replace(/\D/g, "").length < 11) {
      toast({ title: "Informe o CPF ou CNPJ do cliente", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const formaInfo = FORMAS.find((item) => item.code === forma) || FORMAS[0];
      const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const data = await fiscalCall(activeOrgId, "emit", {
        method: "POST",
        body: JSON.stringify({
          kind, source, source_id: sourceId, customer, natureza, presenca: Number(presenca), modalidade_frete: Number(freteModo),
          frete: Number(frete), desconto: Number(desconto), pagamento: Number(pagamento), modelo: kind === "nfce" ? "2" : "1", referenciar,
          data_emissao: `${issuedDate} ${issuedTime}:00`,
          data_entrada_saida: `${moveDate} ${moveTime}:00`,
          complemento,
          transporte: {
            incluir_transportadora: carrierOn,
            razao_social: carrierOn ? carrierName : "",
            cnpj: carrierOn ? carrierCnpj : "",
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
      toast({ title: data.status ? `Nota ${data.status}` : "Nota enviada", description: data.motivo || data.number || "" });
      setEmitOpen(false);
      setScreen("list");
      await loadInvoices();
      await loadSettings();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Falha ao emitir", variant: "destructive" });
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
      toast({ title: error instanceof Error ? error.message : "Falha ao consultar", variant: "destructive" });
    }
  }

  async function remove(id: string) {
    if (!activeOrgId) return;
    try {
      await fiscalCall(activeOrgId, "delete", { method: "POST", body: JSON.stringify({ id }) });
      await loadInvoices();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Não foi possível excluir", variant: "destructive" });
    }
  }

  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const classOptions = kind === "nfse" ? serviceClasses : productClasses;

  if (!featuresLoading && !hasFeature("nota_fiscal")) {
    return <CRMLayout activeView="nota-fiscal" onViewChange={() => {}}><div className="p-8">Peça ao administrador para habilitar Nota fiscal nesta empresa.</div></CRMLayout>;
  }

  return (
    <CRMLayout activeView="nota-fiscal" onViewChange={() => {}}>
      <div className="space-y-4 p-4 md:p-6">
        {screen === "list" ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Nota Fiscal</h1>
                <p className="text-sm text-slate-600">{company?.name || "Empresa não configurada"} {company?.cnpj ? `· ${company.cnpj}` : ""}</p>
                <p className="text-xs text-slate-500">Última emissão: {company?.lastEmission || "—"}</p>
                <p className="text-sm text-red-600">Até {company?.limit || 50} notas no mês sem custo extra; a partir da {(company?.limit || 50)}ª, R$ 0,45 por nota. Neste mês: {monthCount}.</p>
              </div>
              <Button variant="outline" onClick={() => openFiscalTab("company")}>Editar empresa</Button>
            </div>
            <div className="flex flex-wrap gap-1 border-b">
              {([
                ["notas", "Notas"],
                ["product", "Imposto de produto"],
                ["service", "Impostos de Serviços"],
                ["avulsa", "NFSe Avulsa"],
                ["sales", "Últimas vendas"],
                ["cce", "Carta de Correção"],
                ["company", "Alternar Empresa"],
                ["export", "Exportar Notas"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" className={`border-b-2 px-3 py-2 text-sm ${pageTab === id ? "border-blue-700 font-medium text-blue-700" : "border-transparent text-slate-600"}`} onClick={() => openFiscalTab(id)}>{label}</button>
              ))}
            </div>
            {pageTab === "notas" ? <div className="flex flex-wrap items-end gap-2">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
              <Input placeholder="Contato" value={query} onChange={(event) => setQuery(event.target.value)} className="w-56" />
            </div> : null}
            {pageTab === "notas" ? <><div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left"><tr><th className="p-2">Tipo</th><th>Nº</th><th>Cliente</th><th>Data de envio</th><th>Valor</th><th>Status</th><th>Arquivos</th></tr></thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className={/process/i.test(invoice.status) ? "bg-amber-50" : ""}>
                      <td className="p-2">{invoice.kind}</td>
                      <td>{invoice.number || "s/n"}</td>
                      <td>{invoice.customer_name}</td>
                      <td>{new Date(invoice.created_at).toLocaleString("pt-BR")}</td>
                      <td>{money(Number(invoice.amount || 0))}</td>
                      <td><button className="underline" onClick={() => void refresh(invoice.id)}>{invoice.status}</button></td>
                      <td className="flex gap-2 p-2">
                        {invoice.pdf_url ? <a className="text-blue-700" href={invoice.pdf_url} target="_blank" rel="noreferrer">PDF</a> : null}
                        {invoice.xml_url ? <a className="text-blue-700" href={invoice.xml_url} target="_blank" rel="noreferrer">XML</a> : null}
                        {!["aprovado", "cancelado", "processado"].includes(invoice.status) ? <button onClick={() => void remove(invoice.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button> : null}
                      </td>
                    </tr>
                  ))}
                  {!invoices.length ? <tr><td className="p-4 text-slate-500" colSpan={7}>Nenhuma nota no período.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between text-sm"><span>Emitidas: {issued}</span><span>Total: {money(total)}</span></div></> : null}
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
              <div className="space-y-3">
                {salesLoading ? <p className="text-sm text-slate-500">Carregando vendas...</p> : null}
                {!salesLoading && !sales.length ? <p className="text-sm text-slate-500">Nenhuma venda concluída entre {from} e {to}.</p> : null}
                {sales.map((sale) => (
                  <div key={sale.id} className="rounded border p-2">
                    <p>Venda {sale.sale_number} - {sale.customer_name || "Consumidor"} em {new Date(sale.created_at).toLocaleDateString("pt-BR")} · {money(Number(sale.total || 0))}</p>
                    <div className="mt-2 flex gap-2">
                      {saleFlag(sale.has_product) ? <Button size="sm" disabled={salesLoading} onClick={() => void openSale(sale.id, company?.modelo === "nfce" ? "nfce" : "nfe")}>Emitir NF-e ou NFC-e</Button> : null}
                      {saleFlag(sale.has_service) ? <Button size="sm" variant="outline" disabled={salesLoading} onClick={() => void openSale(sale.id, "nfse")}>Emitir NFS-e</Button> : null}
                    </div>
                  </div>
                ))}
              </div>
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
              <div>
                <h2 className="text-lg font-semibold">Carta de Correção</h2>
                <p className="text-sm text-slate-600">A correção de uma nota aprovada fica para a próxima etapa.</p>
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
          </>
        ) : null}
      </div>

      <Dialog open={emitOpen} onOpenChange={setEmitOpen}>
        <DialogContent className="max-w-5xl overflow-y-auto bg-white p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-semibold">{kind === "nfse" ? "Emitir NFSe" : "Emitir NFe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
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
                      <div><p className="text-[11px]">Operação:</p><Input className="h-8" value="1 - Saída" readOnly /></div>
                      <div><p className="text-[11px]">Presença:</p>
                        <Select value={presenca} onValueChange={setPresenca}><SelectTrigger className="h-8"><SelectValue placeholder="Digite" /></SelectTrigger><SelectContent><SelectItem value="1">1 - Operação presencial</SelectItem><SelectItem value="2">2 - Internet</SelectItem><SelectItem value="4">4 - Entrega</SelectItem><SelectItem value="9">9 - Outros</SelectItem></SelectContent></Select>
                      </div>
                      <div><p className="text-[11px]">Modalidade frete:</p>
                        <Select value={freteModo} onValueChange={setFreteModo}><SelectTrigger className="h-8"><SelectValue placeholder="Digite" /></SelectTrigger><SelectContent><SelectItem value="9">9 - Sem frete</SelectItem><SelectItem value="0">0 - Emitente</SelectItem><SelectItem value="1">1 - Destinatário</SelectItem><SelectItem value="2">2 - Terceiros</SelectItem></SelectContent></Select>
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
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={carrierOn} onCheckedChange={setCarrierOn} />
                      <span className="text-sm">Adicionar informações da transportadora</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <Input className="h-9 bg-slate-100" placeholder="Buscar transportadora" disabled={!carrierOn} value={carrierName} onChange={(event) => setCarrierName(event.target.value)} />
                      <Input className="h-9 bg-slate-100" placeholder="CNPJ transportadora" disabled={!carrierOn} value={carrierCnpj} onChange={(event) => setCarrierCnpj(event.target.value)} />
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
              <div><p className="text-[11px]">Nome do contato</p><Input className="h-8" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></div>
              <div><p className="text-[11px]">CPF/CNPJ</p><Input className="h-8" value={customer.document} onChange={(event) => setCustomer({ ...customer, document: event.target.value })} /></div>
              <div className="md:col-span-2"><p className="text-[11px]">Logradouro</p><Input className="h-8" value={customer.street} onChange={(event) => setCustomer({ ...customer, street: event.target.value })} /></div>
              <div><p className="text-[11px]">CEP</p><Input className="h-8" value={customer.cep} onChange={(event) => setCustomer({ ...customer, cep: event.target.value })} /></div>
              <div><p className="text-[11px]">Cidade</p><Input className="h-8" value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></div>
              <div><p className="text-[11px]">Bairro</p><Input className="h-8" value={customer.district} onChange={(event) => setCustomer({ ...customer, district: event.target.value })} /></div>
              <div><p className="text-[11px]">Número</p><Input className="h-8" value={customer.number} onChange={(event) => setCustomer({ ...customer, number: event.target.value })} /></div>
              <div><p className="text-[11px]">UF</p><Input className="h-8" value={customer.uf} onChange={(event) => setCustomer({ ...customer, uf: event.target.value })} /></div>
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
      <FileText className="hidden" />
    </CRMLayout>
  );
}
