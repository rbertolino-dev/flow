import { useState } from "react";
import { Calculator, Loader2, Users, Wrench } from "lucide-react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ReportsSubnav } from "@/components/reports/ReportsSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCommissionsReport } from "@/hooks/useCommissionsReport";
import { formatCommissionMoney } from "@/lib/commissionsReport";

type TabKey = "vendas" | "os";

export default function ReportsCommissions() {
  const [tab, setTab] = useState<TabKey>("vendas");
  const report = useCommissionsReport();

  return (
    <CRMLayout activeView="reports" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1200px] p-4 md:p-6">
        <ReportsSubnav />

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-slate-100 p-1">
            <TabsTrigger
              value="vendas"
              className="rounded-md px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Vendas
            </TabsTrigger>
            <TabsTrigger
              value="os"
              className="rounded-md px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Ordem de Serviço
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendas" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <Users className="h-5 w-5" aria-hidden />
              <h1 className="text-lg font-semibold">Comissões das Vendas</h1>
            </div>

            <PeriodFilters report={report} />

            {report.loading ? (
              <LoadingState />
            ) : !report.loaded ? (
              <EmptyHint text='Selecione o período e clique em "Mostrar Comissões".' />
            ) : report.salesRows.length === 0 ? (
              <EmptyHint text="Nenhuma venda comissionada no período." />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100 hover:bg-slate-100">
                        <TableHead className="font-semibold text-slate-700">Usuário</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Qntd de Vendas</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Soma das Vendas</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Descontos</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Comissão</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.salesRows.map((row) => (
                        <TableRow key={row.userKey}>
                          <TableCell className="font-medium text-slate-800">{row.userName}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.salesCount}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCommissionMoney(row.salesSum)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCommissionMoney(row.discountsSum)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCommissionMoney(row.commissionSum)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="bg-slate-800 hover:bg-slate-700"
                              disabled={report.payingKey === `vendas:${row.userKey}`}
                              onClick={() => void report.createPayable("vendas", row)}
                            >
                              Conta a Pagar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <CommissionFooter
                  total={report.salesTotalShown}
                  onCalculate={() =>
                    report.setSalesTotalShown(
                      report.salesRows.reduce((sum, row) => sum + row.commissionSum, 0),
                    )
                  }
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="os" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <Wrench className="h-5 w-5" aria-hidden />
              <h1 className="text-lg font-semibold">Comissões das Ordens de Serviço</h1>
            </div>

            <PeriodFilters report={report} />

            <p className="text-sm text-slate-500">
              Mostrando Ordens de Serviço finalizadas com data final dentro do período selecionado e
              comissão preenchida:
            </p>

            {report.loading ? (
              <LoadingState />
            ) : !report.loaded ? (
              <EmptyHint text='Selecione o período e clique em "Mostrar Comissões".' />
            ) : report.osRows.length === 0 ? (
              <EmptyHint text="Nenhuma OS comissionada no período." />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100 hover:bg-slate-100">
                        <TableHead className="font-semibold text-slate-700">Usuário</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Qntd de Ordens</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Soma das Ordens</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Comissão</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.osRows.map((row) => (
                        <TableRow key={row.userKey}>
                          <TableCell className="font-medium text-slate-800">{row.userName}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.ordersCount}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCommissionMoney(row.ordersSum)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCommissionMoney(row.commissionSum)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="bg-slate-800 hover:bg-slate-700"
                              disabled={report.payingKey === `os:${row.userKey}`}
                              onClick={() => void report.createPayable("os", row)}
                            >
                              Conta a Pagar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <CommissionFooter
                  total={report.osTotalShown}
                  onCalculate={() =>
                    report.setOsTotalShown(
                      report.osRows.reduce((sum, row) => sum + row.commissionSum, 0),
                    )
                  }
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}

function PeriodFilters({
  report,
}: {
  report: ReturnType<typeof useCommissionsReport>;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-sm text-slate-600">Período:</Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={report.dateFrom}
            onChange={(e) => report.setDateFrom(e.target.value)}
            className="w-[160px] rounded-full bg-white"
          />
          <span className="text-sm text-slate-500">até</span>
          <Input
            type="date"
            value={report.dateTo}
            onChange={(e) => report.setDateTo(e.target.value)}
            className="w-[160px] rounded-full bg-white"
          />
        </div>
      </div>
      <Button onClick={() => void report.load()} disabled={report.loading} className="bg-slate-800 hover:bg-slate-700">
        {report.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Mostrar Comissões
      </Button>
    </div>
  );
}

function CommissionFooter({
  total,
  onCalculate,
}: {
  total: number | null;
  onCalculate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
      <span className="text-sm font-medium text-slate-700">
        Soma das Comissões:{" "}
        {total == null ? "—" : formatCommissionMoney(total)}
      </span>
      <Button variant="secondary" onClick={onCalculate}>
        <Calculator className="mr-2 h-4 w-4" />
        Calcular
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-10 text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando comissões…
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
