import { useMemo } from "react";
import { CalendarDays, Download, Filter, Loader2, Palette, Search } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSchedulingReport } from "@/hooks/useSchedulingReport";
import {
  GOOGLE_CALENDAR_COLORS,
  NO_COLOR_ID,
} from "@/lib/googleCalendarColors";
import { downloadCsv } from "@/lib/marginsReport";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsScheduling() {
  const report = useSchedulingReport();

  const colorOptions = useMemo(
    () => [{ id: NO_COLOR_ID, name: "Sem cor", hex: "#94A3B8" }, ...GOOGLE_CALENDAR_COLORS],
    [],
  );

  const handleExport = () => {
    const stamp = `${report.dateFrom}_${report.dateTo}`;
    downloadCsv(
      `agendamentos-por-cor-${stamp}.csv`,
      ["Cor", "Status", "Título", "Início", "Fim", "Duração", "Local"],
      report.events.map((event) => [
        event.colorName,
        event.statusLabel,
        event.summary,
        formatDateTime(event.startDatetime),
        formatDateTime(event.endDatetime),
        event.durationLabel,
        event.location || "",
      ]),
    );
  };

  return (
    <CRMLayout activeView="reports" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <ReportsSubnav />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
            <div>
              <h1 className="text-lg font-semibold">Agendamentos por cor e status</h1>
              <p className="text-sm text-slate-500">
                Cada cor do Google representa um status (ex.: verde = realizada, verde escuro = fechamento).
              </p>
            </div>
          </div>
          <Button onClick={handleExport} className="bg-slate-900 hover:bg-slate-800" disabled={!report.events.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
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
          <Select value={report.colorFilter} onValueChange={report.setColorFilter}>
            <SelectTrigger className="w-[200px] rounded-full bg-white">
              <Filter className="mr-2 h-4 w-4 text-slate-400" />
              <SelectValue placeholder="Cor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cores</SelectItem>
              {colorOptions.map((color) => (
                <SelectItem key={color.id} value={color.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-slate-300"
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={report.search}
              onChange={(event) => report.setSearch(event.target.value)}
              placeholder="Buscar título ou local"
              className="rounded-full bg-white pl-9"
            />
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Reuniões</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{report.totals.count}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tempo total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
              {report.totals.totalDurationLabel}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cores no período</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
              {report.colorSummaries.length}
            </p>
          </div>
        </div>

        {report.isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando agendamentos...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Cor
                      </span>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Reuniões</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Tempo total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.colorSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                        Nenhum agendamento no período com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.colorSummaries.map((row) => (
                      <TableRow key={row.colorId}>
                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-left hover:bg-slate-50"
                            onClick={() => report.setColorFilter(row.colorId)}
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-slate-300"
                              style={{ backgroundColor: row.colorHex }}
                            />
                            <span className="font-medium text-slate-800">{row.colorName}</span>
                          </button>
                        </TableCell>
                        <TableCell className="text-slate-700">{row.statusLabel}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">{row.count}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.totalDurationLabel}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="font-semibold text-slate-700">Cor</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="min-w-[220px] font-semibold text-slate-700">Título</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold text-slate-700">Início</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold text-slate-700">Fim</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Duração</TableHead>
                    <TableHead className="font-semibold text-slate-700">Local</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        Nenhuma reunião listada. Ajuste o período ou a cor.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="inline-flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border border-slate-300"
                              style={{ backgroundColor: event.colorHex }}
                            />
                            <span className="text-slate-700">{event.colorName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{event.statusLabel}</TableCell>
                        <TableCell className="text-slate-800">
                          {event.htmlLink ? (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {event.summary}
                            </a>
                          ) : (
                            event.summary
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {formatDateTime(event.startDatetime)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {formatDateTime(event.endDatetime)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {event.durationLabel}
                        </TableCell>
                        <TableCell className="text-slate-600">{event.location || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
