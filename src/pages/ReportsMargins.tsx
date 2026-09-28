import { useMemo, useState } from "react";
import {
  Download,
  Filter,
  Loader2,
  Package,
  Search,
  Wrench,
} from "lucide-react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ReportsSubnav } from "@/components/reports/ReportsSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useMarginsReport } from "@/hooks/useMarginsReport";
import {
  downloadCsv,
  formatMarginsDateTime,
  formatMarginsMoney,
  formatUnitCost,
  type MarginsAggregateRow,
  type MarginsGeneralRow,
} from "@/lib/marginsReport";
import { cn } from "@/lib/utils";

type TabKey = "geral" | "servicos" | "produtos";

function moneyClass(value: number): string {
  return value < 0 ? "text-red-600" : "text-slate-700";
}

function GeneralTable({ rows }: { rows: MarginsGeneralRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
        Nenhuma venda encontrada no período.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100 hover:bg-slate-100">
            <TableHead className="whitespace-nowrap font-semibold text-slate-700">Código</TableHead>
            <TableHead className="whitespace-nowrap font-semibold text-slate-700">Data e hora</TableHead>
            <TableHead className="min-w-[220px] font-semibold text-slate-700">Produtos/Serviços</TableHead>
            <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Valor Total</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Custo total</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Acréscimo</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Lucro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.saleId} className="align-top">
              <TableCell className="tabular-nums text-slate-700">{row.code}</TableCell>
              <TableCell className="whitespace-nowrap text-slate-600">
                {formatMarginsDateTime(row.soldAt)}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {row.items.map((item, index) => (
                    <div
                      key={`${row.saleId}-${index}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm",
                        row.items.length > 1 ? "bg-slate-50" : "",
                      )}
                    >
                      <span className="text-slate-700">{item.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {Number.isInteger(item.quantity)
                          ? item.quantity
                          : item.quantity.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                  {row.items.length === 0 && <span className="text-slate-400">—</span>}
                </div>
              </TableCell>
              <TableCell className="text-slate-700">{row.customerName}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.totalValue)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.totalCost)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.surcharge)}
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap text-right tabular-nums font-medium",
                  moneyClass(row.profit),
                )}
              >
                {formatMarginsMoney(row.profit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AggregateTable({
  rows,
  nameHeader,
}: {
  rows: MarginsAggregateRow[];
  nameHeader: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
        Nenhum item encontrado no período com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100 hover:bg-slate-100">
            <TableHead className="min-w-[180px] font-semibold text-slate-700">{nameHeader}</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Custo unit</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Preço praticado</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">
              Lucro Unit (médio)
            </TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Qntd vendida</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Soma das vendas</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Soma dos custos</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Total de desconto</TableHead>
            <TableHead className="whitespace-nowrap text-right font-semibold text-slate-700">Lucro Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatUnitCost(row.unitCost)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.practicedPrice)}
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap text-right tabular-nums",
                  moneyClass(row.unitProfitAvg),
                )}
              >
                {formatMarginsMoney(row.unitProfitAvg)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {row.qtySold.toLocaleString("pt-BR")}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.salesSum)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.costsSum)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
                {formatMarginsMoney(row.discountSum)}
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap text-right tabular-nums font-medium",
                  moneyClass(row.totalProfit),
                )}
              >
                {formatMarginsMoney(row.totalProfit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ReportsMargins() {
  const [tab, setTab] = useState<TabKey>("geral");
  const report = useMarginsReport();

  const title = useMemo(() => {
    if (tab === "servicos") return "Margens dos Serviços";
    if (tab === "produtos") return "Margens dos Produtos";
    return "Margem das Vendas - Faturamento";
  }, [tab]);

  const TitleIcon = tab === "servicos" ? Wrench : Package;

  const handleExport = () => {
    const stamp = `${report.dateFrom}_${report.dateTo}`;
    if (tab === "geral") {
      downloadCsv(
        `margens-geral-${stamp}.csv`,
        ["Código", "Data e hora", "Produtos/Serviços", "Cliente", "Valor Total", "Custo total", "Acréscimo", "Lucro"],
        report.generalRows.map((row) => [
          String(row.code),
          formatMarginsDateTime(row.soldAt),
          row.items.map((item) => `${item.name} (${item.quantity})`).join(" | "),
          row.customerName,
          formatMarginsMoney(row.totalValue),
          formatMarginsMoney(row.totalCost),
          formatMarginsMoney(row.surcharge),
          formatMarginsMoney(row.profit),
        ]),
      );
      return;
    }

    const rows = tab === "servicos" ? report.serviceRows : report.productRows;
    const label = tab === "servicos" ? "Serviço" : "Produto";
    downloadCsv(
      `margens-${tab}-${stamp}.csv`,
      [
        label,
        "Custo unit",
        "Preço praticado",
        "Lucro Unit (médio)",
        "Qntd vendida",
        "Soma das vendas",
        "Soma dos custos",
        "Total de desconto",
        "Lucro Total",
      ],
      rows.map((row) => [
        row.name,
        formatUnitCost(row.unitCost),
        formatMarginsMoney(row.practicedPrice),
        formatMarginsMoney(row.unitProfitAvg),
        String(row.qtySold),
        formatMarginsMoney(row.salesSum),
        formatMarginsMoney(row.costsSum),
        formatMarginsMoney(row.discountSum),
        formatMarginsMoney(row.totalProfit),
      ]),
    );
  };

  return (
    <CRMLayout activeView="reports" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <ReportsSubnav />

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-slate-100 p-1">
            <TabsTrigger
              value="geral"
              className="rounded-md px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Geral
            </TabsTrigger>
            <TabsTrigger
              value="servicos"
              className="rounded-md px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Serviços
            </TabsTrigger>
            <TabsTrigger
              value="produtos"
              className="rounded-md px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Produtos
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-700">
              <TitleIcon className="h-5 w-5 shrink-0" aria-hidden />
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            {(tab === "geral" || tab === "produtos") && (
              <Button onClick={handleExport} className="bg-slate-900 hover:bg-slate-800">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            )}
          </div>

          <TabsContent value="geral" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={report.dateFrom}
                onChange={(event) => report.setDateFrom(event.target.value)}
                className="w-[160px] rounded-full bg-white"
              />
              <span className="text-sm text-slate-500">até</span>
              <Input
                type="date"
                value={report.dateTo}
                onChange={(event) => report.setDateTo(event.target.value)}
                className="w-[160px] rounded-full bg-white"
              />
            </div>
            {report.loading ? (
              <LoadingState />
            ) : (
              <GeneralTable rows={report.generalRows} />
            )}
          </TabsContent>

          <TabsContent value="servicos" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={report.serviceCategory} onValueChange={report.setServiceCategory}>
                <SelectTrigger className="w-[200px] rounded-full bg-white">
                  <Filter className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {report.serviceCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={report.serviceNameQuery}
                  onChange={(event) => report.setServiceNameQuery(event.target.value)}
                  placeholder="Buscar por nome"
                  className="w-[200px] rounded-full bg-white pl-9"
                />
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={report.serviceCodeQuery}
                  onChange={(event) => report.setServiceCodeQuery(event.target.value)}
                  placeholder="Buscar por código"
                  className="w-[180px] rounded-full bg-white pl-9"
                />
              </div>
              <Input
                type="date"
                value={report.dateFrom}
                onChange={(event) => report.setDateFrom(event.target.value)}
                className="w-[150px] rounded-full bg-white"
              />
              <span className="text-sm text-slate-500">até</span>
              <Input
                type="date"
                value={report.dateTo}
                onChange={(event) => report.setDateTo(event.target.value)}
                className="w-[150px] rounded-full bg-white"
              />
            </div>
            {report.loading ? (
              <LoadingState />
            ) : (
              <AggregateTable rows={report.serviceRows} nameHeader="Serviço" />
            )}
          </TabsContent>

          <TabsContent value="produtos" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={report.dateFrom}
                onChange={(event) => report.setDateFrom(event.target.value)}
                className="w-[150px] rounded-full bg-white"
              />
              <span className="text-sm text-slate-500">até</span>
              <Input
                type="date"
                value={report.dateTo}
                onChange={(event) => report.setDateTo(event.target.value)}
                className="w-[150px] rounded-full bg-white"
              />
              <Select value={report.productCategory} onValueChange={report.setProductCategory}>
                <SelectTrigger className="w-[180px] rounded-full bg-white">
                  <Search className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Categoria</SelectItem>
                  {report.productCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={report.productBrand} onValueChange={report.setProductBrand}>
                <SelectTrigger className="w-[160px] rounded-full bg-white">
                  <Search className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Marca</SelectItem>
                  {report.productBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={report.productQuery}
                  onChange={(event) => report.setProductQuery(event.target.value)}
                  placeholder="Buscar produto"
                  className="rounded-full bg-white pl-9"
                />
              </div>
            </div>
            {report.loading ? (
              <LoadingState />
            ) : (
              <AggregateTable rows={report.productRows} nameHeader="Produto" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-10 text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando relatório…
    </div>
  );
}
