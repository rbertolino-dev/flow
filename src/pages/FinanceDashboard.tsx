import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { FinanceSubnav } from '@/components/finance/FinanceSubnav';
import { Input } from '@/components/ui/input';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import {
  entryBucket,
  entryInPeriod,
  formatFinanceMoney,
  monthRange,
  todayIsoDate,
  type FinancialEntry,
} from '@/lib/finance';

export default function FinanceDashboard() {
  const { entries, loading } = useFinancialLedger();
  const initialRange = monthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const today = todayIsoDate();

  const periodEntries = useMemo(
    () => entries.filter((entry) => entryInPeriod(entry, from, to)),
    [entries, from, to]
  );

  const metrics = useMemo(() => summarize(periodEntries, today), [periodEntries, today]);
  const byOrigin = useMemo(() => groupByOrigin(periodEntries), [periodEntries]);

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <FinanceSubnav />
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-600">Dashboard financeiro</h1>
            <p className="text-sm text-slate-500">Caixa do período, separado dos relatórios do funil.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            <span className="text-sm text-slate-400">a</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="A receber" value={metrics.receivableOpen} href="/financeiro/receber" />
              <Metric label="A pagar" value={metrics.payableOpen} href="/financeiro/pagar" />
              <Metric label="Atrasado" value={metrics.overdue} tone="danger" />
              <Metric label="Vence hoje" value={metrics.dueToday} tone="warn" />
              <Metric label="À vencer" value={metrics.upcoming} />
              <Metric label="Recebido" value={metrics.received} tone="ok" />
              <Metric label="Pago" value={metrics.paidOut} tone="ok" />
              <Metric label="Previsto" value={metrics.forecast} />
            </div>

            <div className="mb-4 rounded-md border bg-white p-4">
              <p className="text-sm text-slate-500">Saldo do período (recebido − pago)</p>
              <p className={`text-2xl font-semibold ${metrics.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatFinanceMoney(metrics.balance)}
              </p>
            </div>

            <div className="overflow-hidden rounded-md border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Origem</th>
                    <th className="px-4 py-2 font-medium">A receber</th>
                    <th className="px-4 py-2 font-medium">Recebido</th>
                    <th className="px-4 py-2 font-medium">A pagar</th>
                    <th className="px-4 py-2 font-medium">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {byOrigin.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Nenhum lançamento no período
                      </td>
                    </tr>
                  )}
                  {byOrigin.map((row) => (
                    <tr key={row.origin} className="border-t">
                      <td className="px-4 py-2">{row.origin}</td>
                      <td className="px-4 py-2">{formatFinanceMoney(row.receivableOpen)}</td>
                      <td className="px-4 py-2">{formatFinanceMoney(row.received)}</td>
                      <td className="px-4 py-2">{formatFinanceMoney(row.payableOpen)}</td>
                      <td className="px-4 py-2">{formatFinanceMoney(row.paidOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </CRMLayout>
  );
}

function summarize(entries: FinancialEntry[], today: string) {
  const metrics = {
    receivableOpen: 0,
    payableOpen: 0,
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
    received: 0,
    paidOut: 0,
    forecast: 0,
    balance: 0,
  };

  entries.forEach((entry) => {
    const amount = Number(entry.amount) || 0;
    const bucket = entryBucket(entry, today);
    if (entry.direction === 'receber') {
      if (entry.status === 'paid') metrics.received += amount;
      else if (entry.settlement_status === 'previsto') metrics.forecast += amount;
      else metrics.receivableOpen += amount;
    } else {
      if (entry.status === 'paid') metrics.paidOut += amount;
      else metrics.payableOpen += amount;
    }
    if (entry.status === 'open' && bucket === 'overdue') metrics.overdue += amount;
    if (entry.status === 'open' && bucket === 'today') metrics.dueToday += amount;
    if (entry.status === 'open' && bucket === 'upcoming') metrics.upcoming += amount;
  });

  metrics.balance = metrics.received - metrics.paidOut;
  return metrics;
}

function groupByOrigin(entries: FinancialEntry[]) {
  const map = new Map<string, {
    origin: string;
    receivableOpen: number;
    received: number;
    payableOpen: number;
    paidOut: number;
  }>();

  entries.forEach((entry) => {
    const origin = entry.origin_label || 'Normal';
    const row = map.get(origin) || {
      origin,
      receivableOpen: 0,
      received: 0,
      payableOpen: 0,
      paidOut: 0,
    };
    const amount = Number(entry.amount) || 0;
    if (entry.direction === 'receber') {
      if (entry.status === 'paid') row.received += amount;
      else row.receivableOpen += amount;
    } else if (entry.status === 'paid') {
      row.paidOut += amount;
    } else {
      row.payableOpen += amount;
    }
    map.set(origin, row);
  });

  return Array.from(map.values()).sort((a, b) => a.origin.localeCompare(b.origin, 'pt-BR'));
}

function Metric({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: 'danger' | 'warn' | 'ok';
}) {
  const toneClass = tone === 'danger'
    ? 'text-red-600'
    : tone === 'warn'
      ? 'text-orange-600'
      : tone === 'ok'
        ? 'text-green-700'
        : 'text-slate-800';
  const body = (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{formatFinanceMoney(value)}</p>
    </div>
  );
  if (!href) return body;
  return <Link to={href}>{body}</Link>;
}
