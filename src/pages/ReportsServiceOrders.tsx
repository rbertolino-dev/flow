import { useMemo, useState, type ComponentType } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Search,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ReportsSubnav } from "@/components/reports/ReportsSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useServiceOrdersReport } from "@/hooks/useServiceOrdersReport";
import {
  downloadOsCsv,
  formatOsDate,
  formatOsDateTime,
  formatOsMoney,
  type OsPersonRow,
  type OsReportOrder,
  type OsServiceRow,
  type OsStatusRow,
} from "@/lib/serviceOrdersReport";
import { cn } from "@/lib/utils";

type TabKey = "visao" | "pessoas" | "servicos" | "detalhes";

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone: "violet" | "emerald" | "amber" | "sky" | "rose" | "indigo";
}) {
  const tones: Record<string, string> = {
    violet: "from-violet-500 to-fuchsia-500 shadow-violet-200",
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-200",
    amber: "from-amber-400 to-orange-500 shadow-amber-200",
    sky: "from-sky-500 to-cyan-500 shadow-sky-200",
    rose: "from-rose-500 to-pink-500 shadow-rose-200",
    indigo: "from-indigo-500 to-blue-600 shadow-indigo-200",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md",
        tones[tone],
      )}
    >
      <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-white/75">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function StatusBars({ rows }: { rows: OsStatusRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        Nenhum status no período.
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-800">Distribuição por status</h3>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.statusId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate font-medium text-slate-700">{row.name}</span>
              </div>
              <div className="shrink-0 tabular-nums text-slate-500">
                {row.count} · {row.pct.toFixed(0)}% · {formatOsMoney(row.totalValue)}
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max((row.count / max) * 100, 4)}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonTable({ rows, empty }: { rows: OsPersonRow[]; empty: string }) {
  if (rows.length === 0) {
    return <EmptyHint text={empty} />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-slate-50 to-violet-50 hover:bg-slate-50">
            <TableHead className="font-semibold text-slate-700">Pessoa</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">OS</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Fechadas</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Valor</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Ticket médio</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Comissão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-700">{row.closedCount}</TableCell>
              <TableCell className="text-right tabular-nums font-medium text-slate-800">
                {formatOsMoney(row.totalValue)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-slate-600">
                {formatOsMoney(row.ticketAvg)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-amber-700">
                {formatOsMoney(row.commissionSum)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ServiceTable({ rows }: { rows: OsServiceRow[] }) {
  if (rows.length === 0) {
    return <EmptyHint text="Nenhum serviço no período." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-slate-50 to-sky-50 hover:bg-slate-50">
            <TableHead className="font-semibold text-slate-700">Serviço</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">OS</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Qtde</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Receita</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Custo</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Lucro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatOsMoney(row.salesSum)}</TableCell>
              <TableCell className="text-right tabular-nums text-slate-500">
                {formatOsMoney(row.costSum)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums font-medium",
                  row.profitSum < 0 ? "text-rose-600" : "text-emerald-700",
                )}
              >
                {formatOsMoney(row.profitSum)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailsTable({ orders }: { orders: OsReportOrder[] }) {
  if (orders.length === 0) {
    return <EmptyHint text="Nenhuma ordem de serviço no período com os filtros atuais." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-slate-50 to-emerald-50 hover:bg-slate-50">
            <TableHead className="font-semibold text-slate-700">Código</TableHead>
            <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
            <TableHead className="font-semibold text-slate-700">Serviço</TableHead>
            <TableHead className="font-semibold text-slate-700">Responsável</TableHead>
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="font-semibold text-slate-700">Agenda</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Total</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">Comissão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="align-top">
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold tabular-nums text-slate-800">{order.code}</span>
                  {order.isMaintenance ? (
                    <Badge className="w-fit bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                      Manutenção
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-slate-800">{order.clientName}</div>
                {order.clientPhone ? (
                  <div className="text-xs text-slate-500">{order.clientPhone}</div>
                ) : null}
              </TableCell>
              <TableCell className="max-w-[180px] text-slate-700">{order.serviceName}</TableCell>
              <TableCell className="text-slate-700">{order.responsibleName}</TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className="border-0 font-medium text-white"
                  style={{ backgroundColor: order.statusColor }}
                >
                  {order.statusName}
                </Badge>
                {order.isClosed ? (
                  <div className="mt-1 text-[11px] text-emerald-600">
                    Fechada {formatOsDate(order.closedAt)}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-slate-600">
                {formatOsDateTime(order.startsAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium text-slate-800">
                {formatOsMoney(order.total)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-amber-700">
                {order.hasCommission && order.commissionValue > 0
                  ? formatOsMoney(order.commissionValue)
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-violet-50/40 px-4 py-12 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      Carregando ordens de serviço…
    </div>
  );
}

export default function ReportsServiceOrders() {
  const [tab, setTab] = useState<TabKey>("visao");
  const report = useServiceOrdersReport();

  const closedPct = useMemo(() => {
    if (report.summary.orderCount === 0) return 0;
    return (report.summary.closedCount / report.summary.orderCount) * 100;
  }, [report.summary]);

  const handleExport = () => {
    const stamp = `${report.dateFrom}_${report.dateTo}`;
    if (tab === "pessoas") {
      downloadOsCsv(
        `os-responsaveis-${stamp}.csv`,
        ["Pessoa", "OS", "Fechadas", "Valor", "Ticket médio", "Comissão"],
        report.responsibleRows.map((row) => [
          row.name,
          String(row.orderCount),
          String(row.closedCount),
          formatOsMoney(row.totalValue),
          formatOsMoney(row.ticketAvg),
          formatOsMoney(row.commissionSum),
        ]),
      );
      return;
    }
    if (tab === "servicos") {
      downloadOsCsv(
        `os-servicos-${stamp}.csv`,
        ["Serviço", "OS", "Qtde", "Receita", "Custo", "Lucro"],
        report.serviceRows.map((row) => [
          row.name,
          String(row.orderCount),
          String(row.quantity),
          formatOsMoney(row.salesSum),
          formatOsMoney(row.costSum),
          formatOsMoney(row.profitSum),
        ]),
      );
      return;
    }
    downloadOsCsv(
      `os-detalhes-${stamp}.csv`,
      [
        "Código",
        "Cliente",
        "Telefone",
        "Serviço",
        "Responsável",
        "Colaborador",
        "Status",
        "Agenda",
        "Fechada",
        "Total",
        "Comissão",
      ],
      report.orders.map((order) => [
        order.code,
        order.clientName,
        order.clientPhone,
        order.serviceName,
        order.responsibleName,
        order.collaboratorName,
        order.statusName,
        formatOsDateTime(order.startsAt),
        order.isClosed ? formatOsDate(order.closedAt) : "",
        formatOsMoney(order.total),
        order.hasCommission ? formatOsMoney(order.commissionValue) : "",
      ]),
    );
  };

  return (
    <CRMLayout activeView="reports" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 md:p-6">
        <ReportsSubnav />

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 p-5 text-white shadow-lg md:p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-cyan-300/20" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                Relatórios · Ordem de Serviço
              </div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Painel de Ordens de Serviço
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/85">
                Acompanhe volume, valores, status e desempenho por pessoa e serviço no período.
              </p>
            </div>
            <Button
              onClick={() => void report.load()}
              disabled={report.loading}
              className="bg-white text-indigo-700 hover:bg-white/90"
            >
              {report.loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              )}
              {report.loaded ? "Atualizar" : "Mostrar relatório"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-slate-600">De</Label>
              <Input
                type="date"
                value={report.dateFrom}
                onChange={(e) => report.setDateFrom(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-600">Até</Label>
              <Input
                type="date"
                value={report.dateTo}
                onChange={(e) => report.setDateTo(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-600">Filtrar por data</Label>
              <Select
                value={report.dateMode}
                onValueChange={(v) => report.setDateMode(v as "agenda" | "fechamento" | "criacao")}
              >
                <SelectTrigger className="rounded-xl">
                  <CalendarDays className="mr-2 h-4 w-4 text-violet-500" aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agenda">Data da agenda</SelectItem>
                  <SelectItem value="fechamento">Data de fechamento</SelectItem>
                  <SelectItem value="criacao">Data de criação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-600">Status</Label>
              <Select value={report.statusFilter} onValueChange={report.setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {report.statusOptions.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={report.search}
                onChange={(e) => report.setSearch(e.target.value)}
                placeholder="Buscar código, cliente, serviço…"
                className="rounded-xl pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Switch checked={report.onlyClosed} onCheckedChange={report.setOnlyClosed} />
              Só fechadas
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Switch checked={report.onlyMaintenance} onCheckedChange={report.setOnlyMaintenance} />
              Só manutenção
            </label>
            <Button
              variant="outline"
              className="rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50"
              disabled={!report.loaded || report.orders.length === 0}
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Exportar CSV
            </Button>
          </div>
        </div>

        {!report.loaded && !report.loading ? (
          <EmptyHint text='Selecione o período e clique em "Mostrar relatório".' />
        ) : report.loading ? (
          <LoadingState />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <StatCard
                title="Total de OS"
                value={String(report.summary.orderCount)}
                hint={`${report.summary.itemsCount} itens`}
                icon={ClipboardList}
                tone="violet"
              />
              <StatCard
                title="Fechadas"
                value={String(report.summary.closedCount)}
                hint={`${closedPct.toFixed(0)}% do total`}
                icon={CheckCircle2}
                tone="emerald"
              />
              <StatCard
                title="Em aberto"
                value={String(report.summary.openCount)}
                icon={Wrench}
                tone="amber"
              />
              <StatCard
                title="Valor total"
                value={formatOsMoney(report.summary.totalValue)}
                icon={Wallet}
                tone="sky"
              />
              <StatCard
                title="Ticket médio"
                value={formatOsMoney(report.summary.ticketAvg)}
                icon={Sparkles}
                tone="indigo"
              />
              <StatCard
                title="Comissões"
                value={formatOsMoney(report.summary.commissionSum)}
                icon={Users}
                tone="rose"
              />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-100 p-1.5">
                <TabsTrigger
                  value="visao"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm"
                >
                  Visão geral
                </TabsTrigger>
                <TabsTrigger
                  value="pessoas"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm"
                >
                  Por pessoas
                </TabsTrigger>
                <TabsTrigger
                  value="servicos"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm"
                >
                  Por serviços
                </TabsTrigger>
                <TabsTrigger
                  value="detalhes"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm"
                >
                  Detalhes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visao" className="mt-0 grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <StatusBars rows={report.statusRows} />
                </div>
                <div className="space-y-3 lg:col-span-2">
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Top responsável
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {report.responsibleRows[0]?.name || "—"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {report.responsibleRows[0]
                        ? `${report.responsibleRows[0].orderCount} OS · ${formatOsMoney(report.responsibleRows[0].totalValue)}`
                        : "Sem dados"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Top serviço
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {report.serviceRows[0]?.name || "—"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {report.serviceRows[0]
                        ? `${report.serviceRows[0].orderCount} OS · ${formatOsMoney(report.serviceRows[0].salesSum)}`
                        : "Sem dados"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Comissão no período
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {formatOsMoney(report.summary.commissionSum)}
                    </p>
                    <p className="text-sm text-slate-600">
                      Soma das OS com comissão preenchida
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pessoas" className="mt-0 space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Por responsável</h3>
                  <PersonTable
                    rows={report.responsibleRows}
                    empty="Nenhum responsável no período."
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Por colaborador</h3>
                  <PersonTable
                    rows={report.collaboratorRows}
                    empty="Nenhum colaborador no período."
                  />
                </div>
              </TabsContent>

              <TabsContent value="servicos" className="mt-0">
                <ServiceTable rows={report.serviceRows} />
              </TabsContent>

              <TabsContent value="detalhes" className="mt-0">
                <DetailsTable orders={report.orders} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CRMLayout>
  );
}
