import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import type { PosCashConsolidated } from "@/types/pos";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_PERIODS = [
  { value: "all", label: "Período do dia" },
  { value: "dawn", label: "Madrugada (00:00–06:00)" },
  { value: "morning", label: "Manhã (06:00–12:00)" },
  { value: "afternoon", label: "Tarde (12:00–18:00)" },
  { value: "night", label: "Noite (18:00–24:00)" },
] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthStartDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
}

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function toIsoLocal(date: string, end: boolean) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(
    y,
    (m || 1) - 1,
    d || 1,
    end ? 23 : 0,
    end ? 59 : 0,
    end ? 59 : 0,
    end ? 999 : 0
  );
  return dt.toISOString();
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatQty(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function paymentLabel(method: string) {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label || method;
}

function exportConsolidated(report: PosCashConsolidated, from: string, to: string) {
  const lines = [
    ["Caixa consolidado", `${from} a ${to}`],
    [],
    ["Formas de pagamento", "Valor"],
    ...report.payments.map((row) => [
      paymentLabel(row.method),
      Number(row.amount).toFixed(2).replace(".", ","),
    ]),
    [],
    ["Vendas de produtos por categoria", "Quantidade", "Valor"],
    ...report.products_by_category.map((row) => [
      row.category,
      formatQty(Number(row.quantity)),
      Number(row.amount).toFixed(2).replace(".", ","),
    ]),
    [],
    ["Vendas de serviços por categoria", "Quantidade", "Valor"],
    ...report.services_by_category.map((row) => [
      row.category,
      formatQty(Number(row.quantity)),
      Number(row.amount).toFixed(2).replace(".", ","),
    ]),
    [],
    ["Outras entradas", "Valor"],
    ...report.other_entries.map((row) => [
      row.description,
      Number(row.amount).toFixed(2).replace(".", ","),
    ]),
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = lines.map((row) => row.map((cell) => escape(String(cell))).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `caixa-consolidado-${from}-a-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface PosCashConsolidatedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsult: (opts: {
    date_from: string;
    date_to: string;
    day_period: string;
  }) => Promise<PosCashConsolidated>;
}

export function PosCashConsolidatedDialog({
  open,
  onOpenChange,
  onConsult,
}: PosCashConsolidatedDialogProps) {
  const [fromDate, setFromDate] = useState(monthStartDate);
  const [toDate, setToDate] = useState(todayDate);
  const [dayPeriod, setDayPeriod] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<PosCashConsolidated | null>(null);
  const [productsOpen, setProductsOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);
  const [othersOpen, setOthersOpen] = useState(true);

  const consult = async (from = fromDate, to = toDate, period = dayPeriod) => {
    setLoading(true);
    setError("");
    try {
      const data = await onConsult({
        date_from: toIsoLocal(from, false),
        date_to: toIsoLocal(to, true),
        day_period: period,
      });
      setReport(data);
    } catch (err: unknown) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Erro ao consultar o caixa");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const from = monthStartDate();
    const to = todayDate();
    setFromDate(from);
    setToDate(to);
    setDayPeriod("all");
    void consult(from, to, "all");
    // Consulta o mês corrente ao abrir o caixa consolidado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl [&>button]:text-red-600 [&>button]:opacity-100 [&>button>svg]:h-5 [&>button>svg]:w-5">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Caixa Consolidado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Data de Referência:</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="w-[150px]"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                className="w-[150px]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              <Select value={dayPeriod} onValueChange={setDayPeriod}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Período do dia" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_PERIODS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={loading || !fromDate || !toDate}
            onClick={() => void consult()}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Consultar
          </Button>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <section className="space-y-2">
            <h3 className="text-base font-medium">Formas de Pagamento</h3>
            <p className="text-sm text-muted-foreground">
              Valor recebido em cada forma. Venda paga em mais de uma entra dividida, igual ao
              filtro do histórico.
            </p>
            {report?.payments.length ? (
              report.payments.map((row) => (
                <div
                  key={row.method}
                  className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm"
                >
                  <span>{paymentLabel(row.method)}</span>
                  <span className="font-medium tabular-nums">{formatMoney(Number(row.amount))}</span>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-muted-foreground">
                {loading ? "Consultando..." : "Nenhuma forma de pagamento no período."}
              </p>
            )}
            {report?.payments.length ? (
              <div className="flex items-center justify-between px-3 pt-1 text-sm font-semibold">
                <span>Total recebido</span>
                <span className="tabular-nums">
                  {formatMoney(report.payments.reduce((sum, row) => sum + Number(row.amount), 0))}
                </span>
              </div>
            ) : null}
          </section>

          <CategorySection
            title="Vendas de Produtos por Categoria"
            open={productsOpen}
            onToggle={() => setProductsOpen((value) => !value)}
            rows={report?.products_by_category || []}
            emptyLabel={loading ? "Consultando..." : "Nenhuma venda de produto no período."}
          />

          <CategorySection
            title="Vendas de Serviços por Categoria"
            open={servicesOpen}
            onToggle={() => setServicesOpen((value) => !value)}
            rows={report?.services_by_category || []}
            emptyLabel={loading ? "Consultando..." : "Nenhuma venda de serviço no período."}
          />

          <section className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-base font-medium text-slate-800"
              onClick={() => setOthersOpen((value) => !value)}
            >
              Outras Entradas
              {othersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {othersOpen ? (
              report?.other_entries.length ? (
                report.other_entries.map((row) => (
                  <div
                    key={row.description}
                    className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm"
                  >
                    <span>{row.description}</span>
                    <span className="font-medium tabular-nums">{formatMoney(Number(row.amount))}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-muted-foreground">
                  Nenhuma outra entrada no período.
                </p>
              )
            ) : null}
          </section>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={!report}
              onClick={() => report && exportConsolidated(report, fromDate, toDate)}
            >
              Exportar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategorySection({
  title,
  open,
  onToggle,
  rows,
  emptyLabel,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  rows: PosCashConsolidated["products_by_category"];
  emptyLabel: string;
}) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-base font-medium text-blue-800"
        onClick={onToggle}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        rows.length ? (
          rows.map((row) => (
            <div
              key={row.category}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_72px_110px] items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm"
              )}
            >
              <span className="truncate uppercase">{row.category}</span>
              <span className="text-right tabular-nums">{formatQty(Number(row.quantity))}</span>
              <span className="text-right font-medium tabular-nums">
                {formatMoney(Number(row.amount))}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
        )
      ) : null}
    </section>
  );
}
