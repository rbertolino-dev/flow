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
  FileText,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingCart,
  Trash2,
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
    return { total, quantity: filtered.length };
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Cobranças</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="default" onClick={() => setOrcamentosOpen(true)}>
            <Receipt className="h-4 w-4 mr-2" />
            Últimos Orçamentos
          </Button>
          <Button type="button" variant="default" onClick={() => setVendasOpen(true)}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Últimas Vendas
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => setConfigOpen(true)} title="Integração Asaas">
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleSync()}
            disabled={isSyncingStatus}
            title="Sincronizar status"
          >
            <RefreshCw className={cn("h-4 w-4", isSyncingStatus && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="parcelados">Boletos Parcelados</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Filtrar por data de criação</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
                <span className="text-sm text-muted-foreground">a</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
              </div>
            </div>
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Buscar por cliente</Label>
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Nome, descrição, código..."
              />
            </div>
            <div className="space-y-1 w-full sm:w-40">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
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
              <Label className="text-xs">Valor mínimo</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={minValue}
                onChange={(e) => setMinValue(Number(e.target.value) || 0)}
              />
            </div>
            <Button type="button" onClick={() => openNova(null)} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nova cobrança
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Total: </span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
            <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Quantidade: </span>
              <strong>{totals.quantity}</strong>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar lista"}
            </Button>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingBoletos ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Carregando cobranças...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Nenhuma cobrança encontrada.
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
                          "cursor-pointer",
                          isParcel && activeTab === "parcelados" && "bg-orange-50 hover:bg-orange-100/80",
                        )}
                        onClick={() => openDetail(boleto)}
                      >
                        <TableCell className="font-mono text-xs">
                          {shortPaymentCode(boleto.asaas_payment_id)}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {boleto.descricao || "—"}
                        </TableCell>
                        <TableCell>{boleto.customer_name || "—"}</TableCell>
                        <TableCell className="text-right">
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
                        <TableCell className="whitespace-nowrap text-sm">
                          {boleto.created_at
                            ? format(parseISO(boleto.created_at), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
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
                              className="h-8 w-8 text-primary"
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
                              className="h-8 w-8 text-destructive"
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
