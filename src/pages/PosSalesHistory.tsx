import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PosCashConsolidatedDialog } from "@/components/pos/PosCashConsolidatedDialog";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import { usePosSales } from "@/hooks/usePosSales";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { PosSale, PosSalesSummary } from "@/types/pos";
import { PosSaleReceiptSheet } from "@/components/pos/PosSaleReceiptSheet";
import {
  EMPTY_POS_SALES_FILTERS,
  PosSalesFilterDialog,
  type PosSalesAdvancedFilters,
} from "@/components/pos/PosSalesFilterDialog";
import {
  ShoppingCart,
  Download,
  Filter,
  Wallet,
  Loader2,
  ArrowLeft,
  Store,
} from "lucide-react";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} - ${time}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Início do mês atual (local) → ISO */
function defaultDateFrom(): { date: string; time: string } {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
    time: "00:00",
  };
}

function defaultDateTo(): { date: string; time: string } {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    date: `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`,
    time: "23:59",
  };
}

function toIsoLocal(date: string, time: string, endOfMinute = false): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, endOfMinute ? 59 : 0, endOfMinute ? 999 : 0);
  return dt.toISOString();
}

function saleListAmount(sale: PosSale, paymentMethod: string): number {
  if (paymentMethod && sale.payment_amount != null) return Number(sale.payment_amount);
  return Number(sale.total);
}

function isSplitPayment(sale: PosSale, paymentMethod: string): boolean {
  if (!paymentMethod || sale.payment_amount == null) return false;
  return Math.abs(Number(sale.payment_amount) - Number(sale.total)) > 0.009;
}

function itemsLabel(sale: PosSale): string {
  const items = sale.items || [];
  if (!items.length) return "—";
  return items
    .map((i) => `${i.name} ${Number(i.quantity)}x`)
    .join("\n");
}

function exportCsv(sales: PosSale[]) {
  const header = [
    "Código",
    "Data e hora",
    "Total",
    "Desconto",
    "Serviço/Produto",
    "Cliente",
    "Responsável",
    "Nota fiscal",
  ];
  const rows = sales.map((s) => [
    String(s.sale_number),
    formatDateTime(s.sold_at || s.created_at),
    Number(s.payment_amount ?? s.total).toFixed(2).replace(".", ","),
    Number(s.discount_amount).toFixed(2).replace(".", ","),
    itemsLabel(s).replace(/\n/g, " | "),
    s.customer_name || "",
    s.sold_by_name || "",
    (s as PosSale & { invoice_number?: string | null }).invoice_number || "Sem nota",
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escape).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historico-vendas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PosSalesHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { loading, listSalesDetailed, getOpenCashSession, openCash, closeCash, getCashConsolidated } =
    usePosSales();

  const fromDefault = useMemo(() => defaultDateFrom(), []);
  const toDefault = useMemo(() => defaultDateTo(), []);

  const [fromDate, setFromDate] = useState(fromDefault.date);
  const [fromTime, setFromTime] = useState(fromDefault.time);
  const [toDate, setToDate] = useState(toDefault.date);
  const [toTime, setToTime] = useState(toDefault.time);
  const [saleCode, setSaleCode] = useState("");
  const [searchExtra, setSearchExtra] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] =
    useState<PosSalesAdvancedFilters>(EMPTY_POS_SALES_FILTERS);
  const [orgMembers, setOrgMembers] = useState<
    Array<{ id: string; full_name: string | null; email: string }>
  >([]);

  const [sales, setSales] = useState<PosSale[]>([]);
  const [summary, setSummary] = useState<PosSalesSummary>({
    sales_count: 0,
    sales_total: 0,
  });

  const [cashOpen, setCashOpen] = useState(false);
  const [consolidatedOpen, setConsolidatedOpen] = useState(false);
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const [cashStatus, setCashStatus] = useState<"open" | "closed" | "none">("none");
  const [closingAmount, setClosingAmount] = useState("");

  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const hasAdvancedFilters = useMemo(() => {
    const f = advancedFilters;
    return Boolean(
      f.clientQuery.trim() ||
        f.soldByUserId ||
        f.paymentMethod ||
        f.origin ||
        f.withInvoice ||
        (f.priceMin !== "" && Number(f.priceMin) > 0) ||
        (f.priceMax !== "" && Number(f.priceMax) < 500000)
    );
  }, [advancedFilters]);

  const loadSales = useCallback(async () => {
    try {
      const priceMin =
        advancedFilters.priceMin !== ""
          ? Number(advancedFilters.priceMin)
          : undefined;
      const priceMax =
        advancedFilters.priceMax !== ""
          ? Number(advancedFilters.priceMax)
          : undefined;

      const result = await listSalesDetailed({
        date_from: toIsoLocal(fromDate, fromTime, false),
        date_to: toIsoLocal(toDate, toTime, true),
        sale_code: saleCode.trim() || undefined,
        search: searchExtra.trim() || undefined,
        include_items: true,
        limit: 500,
        customer_field: advancedFilters.clientField,
        customer_query: advancedFilters.clientQuery.trim() || undefined,
        sold_by: advancedFilters.soldByUserId || undefined,
        payment_method: advancedFilters.paymentMethod || undefined,
        origin: advancedFilters.origin || undefined,
        price_min: priceMin != null && priceMin > 0 ? priceMin : undefined,
        price_max: priceMax != null && priceMax < 500000 ? priceMax : undefined,
        with_invoice: advancedFilters.withInvoice || undefined,
      });
      setSales(result.data);
      setSummary(result.summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao carregar vendas";
      toast({ title: "Erro", description: message, variant: "destructive" });
      setSales([]);
      setSummary({ sales_count: 0, sales_total: 0 });
    }
  }, [
    fromDate,
    fromTime,
    toDate,
    toTime,
    saleCode,
    searchExtra,
    advancedFilters,
    listSalesDetailed,
    toast,
  ]);

  useEffect(() => {
    void loadSales();
    // carga inicial do período padrão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeOrgId) {
      setOrgMembers([]);
      return;
    }
    void (async () => {
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", activeOrgId);
      const ids = (members || []).map((m) => m.user_id);
      if (!ids.length) {
        setOrgMembers([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids)
        .order("full_name", { ascending: true });
      setOrgMembers((profiles || []) as typeof orgMembers);
    })();
  }, [activeOrgId]);

  const refreshCash = useCallback(async () => {
    try {
      const session = await getOpenCashSession();
      if (session) {
        setCashSessionId(session.id);
        setCashStatus("open");
      } else {
        setCashSessionId(null);
        setCashStatus("none");
      }
    } catch {
      setCashStatus("none");
    }
  }, [getOpenCashSession]);

  const handleOpenCashDialog = async () => {
    await refreshCash();
    setCashOpen(true);
  };

  const handleCashAction = async () => {
    try {
      if (cashStatus === "open" && cashSessionId) {
        await closeCash(cashSessionId, Number(closingAmount) || 0);
        setCashOpen(false);
        await refreshCash();
      } else {
        await openCash(0);
        toast({ title: "Caixa aberto" });
        setCashOpen(false);
        await refreshCash();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro no caixa";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  return (
    <CRMLayout activeView="pdv" onViewChange={() => {}}>
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/pdv")}
              title="Voltar ao PDV"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <ShoppingCart className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Histórico de vendas
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/pdv")}>
              <Store className="mr-2 h-4 w-4" />
              PDV
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              size="sm"
              onClick={() => {
                if (!sales.length) {
                  toast({ title: "Nada para exportar", variant: "destructive" });
                  return;
                }
                exportCsv(sales);
                toast({ title: "Exportação iniciada" });
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {/* Filtros */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Filtrar por período
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-xs">Data inicial</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hora inicial</Label>
                <Input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data final</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hora final</Label>
                <Input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                />
              </div>
              <div className="space-y-1 xl:col-span-2">
                <Label className="text-xs">Código da venda</Label>
                <Input
                  placeholder="Buscar"
                  value={saleCode}
                  onChange={(e) => setSaleCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadSales();
                  }}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label className="text-xs">Cliente / responsável</Label>
                <Input
                  placeholder="Filtrar por nome..."
                  value={searchExtra}
                  onChange={(e) => setSearchExtra(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadSales();
                  }}
                />
              </div>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setFilterOpen(true)}
                disabled={loading}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filtros
                {hasAdvancedFilters ? (
                  <Badge className="ml-2 bg-white/20 text-white hover:bg-white/20">
                    ativos
                  </Badge>
                ) : null}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-green-700 text-white hover:bg-green-800">
                    <Wallet className="mr-2 h-4 w-4" />
                    Caixa
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem onClick={() => void handleOpenCashDialog()}>
                    Abrir/Fechar Caixa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConsolidatedOpen(true)}>
                    Caixa Consolidado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="secondary"
                onClick={() => void loadSales()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Buscar
              </Button>
            </div>
          </div>

          {/* Totais */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-800 px-5 py-4 text-white shadow">
              <p className="text-sm opacity-90">Quantidade de vendas:</p>
              <p className="text-2xl font-bold tabular-nums">{summary.sales_count}</p>
            </div>
            <div className="rounded-lg bg-slate-800 px-5 py-4 text-white shadow">
              <p className="text-sm opacity-90">
                {advancedFilters.paymentMethod
                  ? `Total em ${
                      PAYMENT_METHODS.find((item) => item.value === advancedFilters.paymentMethod)
                        ?.label || "forma de pagamento"
                    }:`
                  : "Total das vendas:"}
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {summary.sales_total.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {advancedFilters.paymentMethod &&
              sales.some((sale) => isSplitPayment(sale, advancedFilters.paymentMethod)) ? (
                <p className="mt-2 text-xs leading-snug text-white/80">
                  Venda paga em mais de uma forma entra só com a parte deste filtro. O caixa
                  consolidado usa a mesma conta.
                </p>
              ) : null}
            </div>
          </div>

          {summary.sales_count > sales.length ? (
            <p className="text-sm text-muted-foreground">
              A lista mostra {sales.length} de {summary.sales_count} vendas. O total acima considera
              todas.
            </p>
          ) : null}

          {/* Tabela */}
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Código</TableHead>
                    <TableHead className="whitespace-nowrap">Data e hora</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      {advancedFilters.paymentMethod ? "Nesta forma" : "Total"}
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">Desconto</TableHead>
                    <TableHead className="min-w-[180px]">Serviço/Produto</TableHead>
                    <TableHead className="min-w-[140px]">Cliente</TableHead>
                    <TableHead className="min-w-[120px]">Responsável</TableHead>
                    <TableHead className="whitespace-nowrap">Nota fiscal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Nenhuma venda encontrada neste período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer hover:bg-muted/60"
                        onClick={() => {
                          setReceiptSaleId(sale.id);
                          setReceiptOpen(true);
                        }}
                      >
                        <TableCell className="font-medium tabular-nums">
                          {sale.sale_number}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(sale.sold_at || sale.created_at)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          <div>{formatMoney(saleListAmount(sale, advancedFilters.paymentMethod))}</div>
                          {isSplitPayment(sale, advancedFilters.paymentMethod) ? (
                            <div className="text-xs font-normal text-muted-foreground">
                              venda {formatMoney(Number(sale.total))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatMoney(Number(sale.discount_amount || 0))}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="max-h-20 overflow-y-auto whitespace-pre-line text-sm leading-snug">
                            {itemsLabel(sale)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.customer_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.sold_by_name || "—"}
                        </TableCell>
                        <TableCell>
                          {(sale as PosSale & { invoice_number?: string | null })
                            .invoice_number ? (
                            <Badge
                              variant="secondary"
                              className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            >
                              {(sale as PosSale & { invoice_number?: string })
                                .invoice_number}
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100"
                            >
                              Sem nota
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <PosCashConsolidatedDialog
        open={consolidatedOpen}
        onOpenChange={setConsolidatedOpen}
        onConsult={getCashConsolidated}
      />

      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Caixa do PDV</DialogTitle>
          </DialogHeader>
          {cashStatus === "open" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Há um caixa aberto. Informe o valor de fechamento para encerrar.
              </p>
              <div className="space-y-1">
                <Label>Valor de fechamento</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum caixa aberto. Deseja abrir um novo caixa para o PDV?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCashAction()}>
              {cashStatus === "open" ? "Fechar caixa" : "Abrir caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PosSalesFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={advancedFilters}
        orgMembers={orgMembers}
        onApply={(filters) => {
          setAdvancedFilters(filters);
          // load after state update via microtask with filters arg
          void (async () => {
            try {
              const priceMin =
                filters.priceMin !== "" ? Number(filters.priceMin) : undefined;
              const priceMax =
                filters.priceMax !== "" ? Number(filters.priceMax) : undefined;
              const result = await listSalesDetailed({
                date_from: toIsoLocal(fromDate, fromTime, false),
                date_to: toIsoLocal(toDate, toTime, true),
                sale_code: saleCode.trim() || undefined,
                search: searchExtra.trim() || undefined,
                include_items: true,
                limit: 500,
                customer_field: filters.clientField,
                customer_query: filters.clientQuery.trim() || undefined,
                sold_by: filters.soldByUserId || undefined,
                payment_method: filters.paymentMethod || undefined,
                origin: filters.origin || undefined,
                price_min: priceMin != null && priceMin > 0 ? priceMin : undefined,
                price_max: priceMax != null && priceMax < 500000 ? priceMax : undefined,
                with_invoice: filters.withInvoice || undefined,
              });
              setSales(result.data);
              setSummary(result.summary);
              toast({
                title: "Filtros aplicados",
                description: `${result.summary.sales_count} venda(s) encontrada(s)`,
              });
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : "Erro ao filtrar";
              toast({ title: "Erro", description: message, variant: "destructive" });
            }
          })();
        }}
        onClear={() => {
          setAdvancedFilters(EMPTY_POS_SALES_FILTERS);
          void (async () => {
            try {
              const result = await listSalesDetailed({
                date_from: toIsoLocal(fromDate, fromTime, false),
                date_to: toIsoLocal(toDate, toTime, true),
                sale_code: saleCode.trim() || undefined,
                search: searchExtra.trim() || undefined,
                include_items: true,
                limit: 500,
              });
              setSales(result.data);
              setSummary(result.summary);
              toast({ title: "Filtros limpos" });
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : "Erro ao limpar filtros";
              toast({ title: "Erro", description: message, variant: "destructive" });
            }
          })();
        }}
      />

      <PosSaleReceiptSheet
        saleId={receiptSaleId}
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) setReceiptSaleId(null);
        }}
        onChanged={() => void loadSales()}
      />
    </CRMLayout>
  );
}
