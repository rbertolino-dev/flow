import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AsaasIntegrationPanel } from "@/components/crm/AsaasIntegrationPanel";
import { useAsaasBoletos, type Boleto } from "@/hooks/useAsaasBoletos";
import { NovaCobrancaDialog } from "./NovaCobrancaDialog";
import { UltimosOrcamentosDialog } from "./UltimosOrcamentosDialog";
import { UltimasVendasDialog } from "./UltimasVendasDialog";
import { CobrancaDetailSheet } from "./CobrancaDetailSheet";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  formatMoney,
  monthRangeIso,
  shortPaymentCode,
  type CobrancaFormPrefill,
} from "./cobrancaTypes";
import {
  Banknote,
  FileText,
  Hash,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function parseDateOnly(value: string): Date {
  return parseISO(value.length === 10 ? `${value}T12:00:00` : value);
}

export function CobrancasPage() {
  const {
    boletos,
    isLoadingBoletos,
    refetchBoletos,
    syncBoletoStatus,
    deleteBoleto,
    isSyncingStatus,
    isDeletingBoleto,
  } = useAsaasBoletos();
  const { toast } = useToast();

  const range = monthRangeIso();
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minValue, setMinValue] = useState(0);
  const [activeTab, setActiveTab] = useState("todos");

  const [novaOpen, setNovaOpen] = useState(false);
  const [orcamentosOpen, setOrcamentosOpen] = useState(false);
  const [vendasOpen, setVendasOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [prefill, setPrefill] = useState<CobrancaFormPrefill | null>(null);
  const [selected, setSelected] = useState<Boleto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    const from = startOfDay(parseDateOnly(dateFrom));
    const to = endOfDay(parseDateOnly(dateTo));

    return boletos.filter((b) => {
      if (activeTab === "parcelados") {
        if (!b.installment_group_id && !(Number(b.installment_count) > 1)) return false;
      }

      const created = b.created_at ? parseDateOnly(b.created_at) : null;
      if (created && !isWithinInterval(created, { start: from, end: to })) return false;

      if (statusFilter !== "all" && (b.status || "").toLowerCase() !== statusFilter) return false;

      const valor = Number(b.valor) || 0;
      if (valor < minValue) return false;

      if (term) {
        const hay = [
          b.customer_name,
          b.descricao,
          b.asaas_payment_id,
          b.customer_email,
          b.customer_phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }

      return true;
    });
  }, [boletos, dateFrom, dateTo, clientSearch, statusFilter, minValue, activeTab]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, b) => sum + (Number(b.valor) || 0), 0);
    const paid = filtered
      .filter((b) => (b.status || "").toLowerCase() === "paid")
      .reduce((sum, b) => sum + (Number(b.valor) || 0), 0);
    const open = filtered
      .filter((b) => ["pending", "open", "overdue"].includes((b.status || "").toLowerCase()))
      .reduce((sum, b) => sum + (Number(b.valor) || 0), 0);
    return { total, quantity: filtered.length, paid, open };
  }, [filtered]);

  const openNova = (data?: CobrancaFormPrefill | null) => {
    setPrefill(data || null);
    setNovaOpen(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchBoletos();
    setRefreshing(false);
  };

  const handleSync = async () => {
    try {
      await syncBoletoStatus();
    } catch {
      /* toast no hook */
    }
  };

  const handleDelete = async (boleto: Boleto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remover este boleto da listagem local?")) return;
    try {
      await deleteBoleto(boleto.id);
    } catch {
      /* toast no hook */
    }
  };

  const openDetail = (boleto: Boleto) => {
    setSelected(boleto);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-700 via-cyan-700 to-sky-800 text-white shadow-md">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at 88% 10%, rgba(251,191,36,0.28), transparent 38%), radial-gradient(circle at 70% 90%, rgba(255,255,255,0.12), transparent 45%)",
          }}
        />
        <div className="relative p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Banknote className="h-3.5 w-3.5 text-amber-200" />
              Asaas · Boletos
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-7 w-7 text-amber-200 shrink-0" />
              Cobranças
            </h1>
            <p className="text-sm text-teal-50/90 max-w-xl">
              Gere boletos, acompanhe status e transforme orçamentos e vendas em cobrança com poucos cliques.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setOrcamentosOpen(true)}
              className="bg-white text-teal-800 hover:bg-teal-50 border-0 shadow-sm"
            >
              <Receipt className="h-4 w-4 mr-2 text-teal-600" />
              Últimos Orçamentos
            </Button>
            <Button
              type="button"
              onClick={() => setVendasOpen(true)}
              className="bg-sky-400/95 text-slate-900 hover:bg-sky-300 border-0 shadow-sm"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Últimas Vendas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setConfigOpen(true)}
              title="Integração Asaas"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void handleSync()}
              disabled={isSyncingStatus}
              title="Sincronizar status"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={cn("h-4 w-4", isSyncingStatus && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">Total</span>
            <Wallet className="h-4 w-4 text-teal-600" />
          </div>
          <p className="text-xl font-bold text-teal-900 tabular-nums">{formatMoney(totals.total)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Quantidade</span>
            <Hash className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-900 tabular-nums">{totals.quantity}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pago</span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-900 tabular-nums">{formatMoney(totals.paid)}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">Em aberto</span>
            <FileText className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-xl font-bold text-sky-900 tabular-nums">{formatMoney(totals.open)}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-slate-100/90 p-1 h-auto">
            <TabsTrigger
              value="todos"
              className="data-[state=active]:bg-teal-600 data-[state=active]:text-white px-4"
            >
              Todos
            </TabsTrigger>
            <TabsTrigger
              value="parcelados"
              className="data-[state=active]:bg-orange-500 data-[state=active]:text-white px-4"
            >
              Boletos Parcelados
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            onClick={() => openNova(null)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova cobrança
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white/90 p-3 sm:p-4 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">Filtrar por data de criação</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto bg-slate-50" />
                  <span className="text-sm text-slate-400">a</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto bg-slate-50" />
                </div>
              </div>
              <div className="space-y-1 flex-1 min-w-[180px]">
                <Label className="text-xs font-medium text-slate-600">Buscar por cliente</Label>
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Nome, descrição, código..."
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-1 w-full sm:w-40">
                <Label className="text-xs font-medium text-slate-600">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-slate-50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-full sm:w-36">
                <Label className="text-xs font-medium text-slate-600">Valor mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={minValue}
                  onChange={(e) => setMinValue(Number(e.target.value) || 0)}
                  className="bg-slate-50"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="border-teal-200 text-teal-800 hover:bg-teal-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Atualizar
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-amber-400" />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                    <TableHead className="text-slate-600 font-semibold">Código</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Descrição</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Cliente</TableHead>
                    <TableHead className="text-right text-slate-600 font-semibold">Valor</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Status</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Criado em</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Vencimento</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingBoletos ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-teal-600" />
                        Carregando cobranças...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <div className="inline-flex flex-col items-center gap-2 text-slate-500">
                          <div className="h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center">
                            <Banknote className="h-6 w-6 text-teal-600" />
                          </div>
                          <p className="font-medium text-slate-700">Nenhuma cobrança encontrada</p>
                          <p className="text-sm">Ajuste os filtros ou crie uma nova cobrança.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((boleto) => {
                      const status = (boleto.status || "pending").toLowerCase();
                      const isParcel = Number(boleto.installment_count) > 1 || !!boleto.installment_group_id;
                      return (
                        <TableRow
                          key={boleto.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isParcel && activeTab === "parcelados"
                              ? "bg-orange-50/80 hover:bg-orange-100/90"
                              : "hover:bg-teal-50/50",
                          )}
                          onClick={() => openDetail(boleto)}
                        >
                          <TableCell className="font-mono text-xs text-teal-800">
                            {shortPaymentCode(boleto.asaas_payment_id)}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate font-medium text-slate-800">
                            {boleto.descricao || "—"}
                          </TableCell>
                          <TableCell className="text-slate-700">{boleto.customer_name || "—"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                            {(Number(boleto.valor) || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
                              {STATUS_LABELS[status] || boleto.status || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-slate-600">
                            {boleto.created_at
                              ? format(parseISO(boleto.created_at), "dd/MM/yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-slate-600">
                            {boleto.data_vencimento
                              ? format(parseDateOnly(boleto.data_vencimento), "dd/MM/yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-teal-700 hover:bg-teal-100 hover:text-teal-900"
                                title="Sincronizar"
                                onClick={() => {
                                  void handleSync();
                                  toast({ title: "Sincronizando status..." });
                                }}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                disabled={isDeletingBoleto}
                                title="Remover"
                                onClick={(e) => void handleDelete(boleto, e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <NovaCobrancaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        prefill={prefill}
        onCreated={() => void refetchBoletos()}
      />
      <UltimosOrcamentosDialog
        open={orcamentosOpen}
        onOpenChange={setOrcamentosOpen}
        onGerarBoleto={(data) => openNova(data)}
      />
      <UltimasVendasDialog
        open={vendasOpen}
        onOpenChange={setVendasOpen}
        onGerarBoleto={(data) => openNova(data)}
      />
      <CobrancaDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        boleto={selected}
        allBoletos={boletos}
      />

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Integração Asaas</DialogTitle>
          </DialogHeader>
          <AsaasIntegrationPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
}
