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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type TaxClass = {
  id: string;
  ref: string;
  description: string;
  noteType: string;
  emissionType: string;
  scenarios: { id: string; name: string; cfop: string; tax: string; cst: string; rate: string; person: string }[];
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
  const [classes, setClasses] = useState<TaxClass[]>([]);
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
  const [companyOpen, setCompanyOpen] = useState(false);
  const [empresaId, setEmpresaId] = useState("");
  const [ambiente, setAmbiente] = useState("2");
  const [modeloPadrao, setModeloPadrao] = useState("nfe");
  const [taxesOpen, setTaxesOpen] = useState<"product" | "service" | null>(null);
  const [salesOpen, setSalesOpen] = useState(false);
  const [sales, setSales] = useState<{ id: string; sale_number: number; customer_name: string; created_at: string; has_product: boolean; has_service: boolean }[]>([]);
  const [cceOpen, setCceOpen] = useState(false);
  const [avulsaOpen, setAvulsaOpen] = useState(false);
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

  const productClasses = useMemo(() => classes.filter((item) => /nf-?e|nfc/i.test(item.noteType) || !item.noteType), [classes]);
  const serviceClasses = useMemo(() => classes.filter((item) => /nfs/i.test(item.noteType) || !item.noteType), [classes]);

  async function ensureClasses() {
    if (!activeOrgId || classes.length) return classes;
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
    setScreen("emit");
  }

  async function openSale(id: string, nextKind: "nfe" | "nfce" | "nfse") {
    if (!activeOrgId) return;
    const data = await fiscalCall(activeOrgId, `sale&id=${id}`);
    const items = (data.items || []).filter((item: { item_type: string }) => nextKind === "nfse" ? item.item_type === "service" : item.item_type === "product");
    openEmit(nextKind, items.map((item: Record<string, unknown>, index: number) => ({
      key: String(item.id || index),
      product_id: item.item_type === "product" ? String(item.item_id || "") : undefined,
      service_id: item.item_type === "service" ? String(item.item_id || "") : undefined,
      item_type: item.item_type === "service" ? "service" : "product",
      name: String(item.name || ""),
      code: String(item.sku || ""),
      ncm: String(item.ncm || ""),
      origem: String(item.fiscal_origin || "0"),
      quantity: Number(item.quantity || 1),
      price: Number(item.unit_price || 0),
      tax_class_ref: String(item.product_class || item.service_class || ""),
      description: String(item.name || ""),
    })), "pos_sale", id, data.sale?.customer_name || "");
    const payment = data.payments?.[0];
    const match = FORMAS.find((item) => item.method === payment?.method);
    if (match) setForma(match.code);
    setDesconto(String(data.sale?.discount_amount || 0));
    setSalesOpen(false);
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
  }, [params, activeOrgId, company, toast]);

  async function saveCompany() {
    if (!activeOrgId) return;
    setSaving(true);
    try {
      await fiscalCall(activeOrgId, "settings", { method: "POST", body: JSON.stringify({ empresa_id: empresaId, ambiente: Number(ambiente), modelo: modeloPadrao, natureza }) });
      setCompanyOpen(false);
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
    const missing = lines.find((line) => line.item_type === "product" && (line.ncm.replace(/\D/g, "").length !== 8 || !line.tax_class_ref));
    if (missing) {
      toast({ title: `Informações do produto faltando: ${missing.ncm ? "Classe de imposto" : "Código NCM"}`, variant: "destructive" });
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
          payments: [{ method: formaInfo.method, code: formaInfo.code, amount: total }],
          corrections: lines.filter((line) => line.product_id).map((line) => ({ product_id: line.product_id, ncm: line.ncm, fiscal_origin: line.origem, tax_class_ref: line.tax_class_ref })),
          lines: lines.map((line) => ({ ...line, total: line.price * line.quantity })),
        }),
      });
      toast({ title: data.status ? `Nota ${data.status}` : "Nota enviada", description: data.motivo || data.number || "" });
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
              <Button variant="outline" onClick={() => setCompanyOpen(true)}>Editar empresa</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
              <Input placeholder="Contato" value={query} onChange={(event) => setQuery(event.target.value)} className="w-56" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline">Opções</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { void ensureClasses(); setTaxesOpen("service"); }}>Impostos de Serviços</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void ensureClasses(); setTaxesOpen("product"); }}>Impostos de Produtos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void ensureClasses(); setAvulsaOpen(true); }}>NFSe Avulsa</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { if (!activeOrgId) return; void fiscalCall(activeOrgId, `sales&from=${from}&to=${to}&q=${encodeURIComponent(query)}`).then((data) => { setSales(data.sales || []); setSalesOpen(true); }); }}>Últimas vendas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCceOpen(true)}>Carta de Correção</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCompanyOpen(true)}>Alternar Empresa</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { if (!activeOrgId) return; void fiscalCall(activeOrgId, `export&from=${from}&to=${to}&q=${encodeURIComponent(query)}`).then((csv) => { const blob = new Blob([String(csv)], { type: "text/csv" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "notas.csv"; link.click(); }); }}>Exportar Notas</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="overflow-auto rounded border">
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
            <div className="flex justify-between text-sm"><span>Emitidas: {issued}</span><span>Total: {money(total)}</span></div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">{kind === "nfse" ? "Emitir NFS-e" : "Emitir NF-e"}</h1>
              <Button variant="ghost" onClick={() => setScreen("list")}>Voltar</Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="space-y-3">
                {lines.map((line, index) => {
                  const missing = line.item_type === "product" && (line.ncm.replace(/\D/g, "").length !== 8 || !line.tax_class_ref);
                  return (
                    <div key={line.key} className={`rounded border p-3 ${missing ? "border-red-400 bg-red-50" : ""}`}>
                      {missing ? <p className="mb-2 text-sm text-red-700">Informações do produto faltando: {line.ncm.replace(/\D/g, "").length === 8 ? "Classe de imposto" : "Código NCM"}</p> : null}
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="md:col-span-2"><Label>Nome</Label><Input value={line.name} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, name: event.target.value, description: event.target.value } : item))} /></div>
                        <div><Label>Valor unitário</Label><Input value={String(line.price)} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, price: Number(event.target.value) } : item))} /></div>
                        <div><Label>Quantidade</Label><Input value={String(line.quantity)} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} /></div>
                        {line.item_type === "product" ? <div><Label>NCM</Label><Input value={line.ncm} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, ncm: event.target.value.replace(/\D/g, "").slice(0, 8) } : item))} /></div> : null}
                        <div className="md:col-span-2">
                          <Label>Classe imposto</Label>
                          <Select value={line.tax_class_ref || "none"} onValueChange={(value) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, tax_class_ref: value === "none" ? "" : value } : item))}>
                            <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione</SelectItem>
                              {classOptions.filter((item) => item.ref).map((item) => <SelectItem key={item.ref} value={item.ref}>{item.ref} · {item.description}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="mt-2 text-sm">Subtotal {money(line.price * line.quantity)}</p>
                      {missing && line.product_id ? <Button className="mt-2" size="sm" variant="outline" onClick={() => void correctProduct(line)}>Clique para Corrigir</Button> : null}
                    </div>
                  );
                })}
              </div>
              <div className="rounded border p-3 text-lg font-semibold">Total {money(lines.reduce((sum, line) => sum + line.price * line.quantity, 0))}</div>
            </div>
            {kind !== "nfse" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>Natureza da operação</Label><Input value={natureza} onChange={(event) => setNatureza(event.target.value)} /></div>
                <div><Label>Modelo</Label>
                  <Select value={kind} onValueChange={(value) => setKind(value as "nfe" | "nfce")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nfe">1 - NF-e</SelectItem>
                      <SelectItem value="nfce">2 - NFC-e</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Finalidade</Label><Input value="1 - Normal" readOnly /></div>
                <div><Label>Operação</Label><Input value="1 - Saída" readOnly /></div>
                <div><Label>Presença</Label><Input value={presenca} onChange={(event) => setPresenca(event.target.value)} /></div>
                <div><Label>Modalidade do frete</Label><Input value={freteModo} onChange={(event) => setFreteModo(event.target.value)} /></div>
                <div><Label>Frete</Label><Input value={frete} onChange={(event) => setFrete(event.target.value)} /></div>
                <div><Label>Desconto</Label><Input value={desconto} onChange={(event) => setDesconto(event.target.value)} /></div>
                <div><Label>Forma de pagamento</Label>
                  <Select value={forma} onValueChange={setForma}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMAS.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="flex items-center gap-2"><Switch checked={pagamento === "1"} onCheckedChange={(checked) => setPagamento(checked ? "1" : "0")} /><Label>A prazo</Label></div>
                <div className="flex items-center gap-2"><Switch checked={referenciar} onCheckedChange={setReferenciar} /><Label>Referenciar outra NF-e</Label></div>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-2 md:col-span-3"><Switch checked={customer.isCompany} onCheckedChange={(checked) => setCustomer({ ...customer, isCompany: checked })} /><Label>Nota fiscal para empresa</Label></div>
              <div><Label>Nome</Label><Input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></div>
              <div><Label>{customer.isCompany ? "CNPJ" : "CPF/CNPJ"}</Label><Input value={customer.document} onChange={(event) => setCustomer({ ...customer, document: event.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></div>
              <div><Label>Logradouro</Label><Input value={customer.street} onChange={(event) => setCustomer({ ...customer, street: event.target.value })} /></div>
              <div><Label>Número</Label><Input value={customer.number} onChange={(event) => setCustomer({ ...customer, number: event.target.value })} /></div>
              <div><Label>Bairro</Label><Input value={customer.district} onChange={(event) => setCustomer({ ...customer, district: event.target.value })} /></div>
              <div><Label>CEP</Label><Input value={customer.cep} onChange={(event) => setCustomer({ ...customer, cep: event.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></div>
              <div><Label>UF</Label><Input value={customer.uf} onChange={(event) => setCustomer({ ...customer, uf: event.target.value })} /></div>
              {kind !== "nfse" ? <div><Label>Inscrição estadual</Label><Input value={customer.ie} onChange={(event) => setCustomer({ ...customer, ie: event.target.value })} /></div> : null}
            </div>
            <Button onClick={() => void emit()} disabled={saving}>{saving ? "Emitindo..." : "EMITIR NOTA"}</Button>
          </div>
        )}
      </div>

      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar empresa</DialogTitle></DialogHeader>
          <div className="space-y-3">
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
        </DialogContent>
      </Dialog>

      <Dialog open={taxesOpen !== null} onOpenChange={(open) => !open && setTaxesOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{taxesOpen === "service" ? "Impostos de Serviços" : "Impostos de Produtos"}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-auto text-sm">
            {(taxesOpen === "service" ? serviceClasses : productClasses).map((item) => (
              <div key={item.ref || item.id} className="rounded border p-2">
                <p className="font-medium">{item.description || item.ref} · {item.ref}</p>
                <p>Emissão: {item.emissionType || "—"} · Tipo: {item.noteType || "—"}</p>
                {item.scenarios.map((scenario) => <p key={scenario.id}>CFOP {scenario.cfop || "—"} · {scenario.cst || scenario.tax} · {scenario.rate}</p>)}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={salesOpen} onOpenChange={setSalesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Últimas vendas</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-auto">
            {sales.map((sale) => (
              <div key={sale.id} className="rounded border p-2">
                <p>Venda {sale.sale_number} - {sale.customer_name || "Consumidor"} em {new Date(sale.created_at).toLocaleDateString("pt-BR")}</p>
                <div className="mt-2 flex gap-2">
                  {sale.has_product ? <Button size="sm" onClick={() => void openSale(sale.id, company?.modelo === "nfce" ? "nfce" : "nfe")}>Emitir NF-e ou NFC-e</Button> : null}
                  {sale.has_service ? <Button size="sm" variant="outline" onClick={() => void openSale(sale.id, "nfse")}>Emitir NFS-e</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={avulsaOpen} onOpenChange={setAvulsaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>NFSe Avulsa</DialogTitle></DialogHeader>
          <div className="space-y-2">
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
              setAvulsaOpen(false);
            }}>Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cceOpen} onOpenChange={setCceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Carta de Correção</DialogTitle></DialogHeader>
          <p>A correção de uma nota aprovada fica para a próxima etapa.</p>
        </DialogContent>
      </Dialog>
      <FileText className="hidden" />
    </CRMLayout>
  );
}
