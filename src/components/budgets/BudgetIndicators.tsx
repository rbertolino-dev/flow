import { useMemo } from 'react';
import { Budget } from '@/types/budget';
import { isAfter, isBefore, addDays } from 'date-fns';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  ThumbsUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BudgetIndicatorsProps {
  budgets: Budget[];
  dateFrom?: string;
  dateTo?: string;
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: value >= 10000 ? 0 : 2,
  }).format(value);

type MetricTone = 'blue' | 'emerald' | 'teal' | 'violet' | 'red' | 'amber' | 'green';

const toneStyles: Record<
  MetricTone,
  { shell: string; icon: string; value: string; label: string; bar: string }
> = {
  blue: {
    shell: 'from-blue-500/15 via-blue-400/10 to-transparent border-blue-400/30',
    icon: 'bg-blue-500 text-white shadow-blue-500/30',
    value: 'text-blue-700 dark:text-blue-300',
    label: 'text-blue-600/80 dark:text-blue-400/80',
    bar: 'bg-blue-500',
  },
  emerald: {
    shell: 'from-emerald-500/15 via-emerald-400/10 to-transparent border-emerald-400/30',
    icon: 'bg-emerald-500 text-white shadow-emerald-500/30',
    value: 'text-emerald-700 dark:text-emerald-300',
    label: 'text-emerald-600/80 dark:text-emerald-400/80',
    bar: 'bg-emerald-500',
  },
  teal: {
    shell: 'from-teal-500/15 via-teal-400/10 to-transparent border-teal-400/30',
    icon: 'bg-teal-500 text-white shadow-teal-500/30',
    value: 'text-teal-700 dark:text-teal-300',
    label: 'text-teal-600/80 dark:text-teal-400/80',
    bar: 'bg-teal-500',
  },
  violet: {
    shell: 'from-violet-500/15 via-violet-400/10 to-transparent border-violet-400/30',
    icon: 'bg-violet-500 text-white shadow-violet-500/30',
    value: 'text-violet-700 dark:text-violet-300',
    label: 'text-violet-600/80 dark:text-violet-400/80',
    bar: 'bg-violet-500',
  },
  red: {
    shell: 'from-red-500/15 via-red-400/10 to-transparent border-red-400/30',
    icon: 'bg-red-500 text-white shadow-red-500/30',
    value: 'text-red-700 dark:text-red-300',
    label: 'text-red-600/80 dark:text-red-400/80',
    bar: 'bg-red-500',
  },
  amber: {
    shell: 'from-amber-500/15 via-amber-400/10 to-transparent border-amber-400/30',
    icon: 'bg-amber-500 text-white shadow-amber-500/30',
    value: 'text-amber-700 dark:text-amber-300',
    label: 'text-amber-600/80 dark:text-amber-400/80',
    bar: 'bg-amber-500',
  },
  green: {
    shell: 'from-green-500/15 via-green-400/10 to-transparent border-green-400/30',
    icon: 'bg-green-500 text-white shadow-green-500/30',
    value: 'text-green-700 dark:text-green-300',
    label: 'text-green-600/80 dark:text-green-400/80',
    bar: 'bg-green-500',
  },
};

function MetricChip({
  tone,
  icon: Icon,
  label,
  value,
  hint,
}: {
  tone: MetricTone;
  icon: typeof FileText;
  label: string;
  value: string | number;
  hint?: string;
}) {
  const styles = toneStyles[tone];
  return (
    <div
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border bg-gradient-to-br px-2.5 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        styles.shell
      )}
      title={hint}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md transition-transform group-hover:scale-105',
          styles.icon
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[10px] font-semibold uppercase tracking-wide', styles.label)}>
          {label}
        </p>
        <p className={cn('truncate text-sm font-bold leading-tight tabular-nums sm:text-base', styles.value)}>
          {value}
        </p>
        {hint ? (
          <p className={cn('truncate text-[9px] font-medium opacity-80', styles.label)}>{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function BudgetIndicators({ budgets, dateFrom, dateTo }: BudgetIndicatorsProps) {
  const budgetsInPeriod = useMemo(() => {
    if (!budgets || !Array.isArray(budgets)) return [];
    if (!dateFrom && !dateTo) return budgets;

    return budgets.filter((budget) => {
      if (!budget.created_at) return false;
      const createdAt = new Date(budget.created_at);
      if (dateFrom && createdAt < new Date(dateFrom)) return false;
      if (dateTo) {
        const dateToEnd = new Date(dateTo);
        dateToEnd.setHours(23, 59, 59, 999);
        if (createdAt > dateToEnd) return false;
      }
      return true;
    });
  }, [budgets, dateFrom, dateTo]);

  const { expired, expiringSoon, valid, approved } = useMemo(() => {
    const now = new Date();
    const oneWeekFromNow = addDays(now, 7);
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let validCount = 0;
    let approvedCount = 0;

    budgetsInPeriod.forEach((budget) => {
      if (budget.approved) approvedCount++;
      if (!budget.expires_at) {
        validCount++;
        return;
      }
      const expiresAt = new Date(budget.expires_at);
      if (isBefore(expiresAt, now)) expiredCount++;
      else if (isAfter(expiresAt, oneWeekFromNow)) validCount++;
      else expiringSoonCount++;
    });

    return {
      expired: expiredCount,
      expiringSoon: expiringSoonCount,
      valid: validCount,
      approved: approvedCount,
    };
  }, [budgetsInPeriod]);

  const total = budgetsInPeriod.length;

  const totalValue = useMemo(
    () => budgetsInPeriod.reduce((sum, budget) => sum + (budget.total || 0), 0),
    [budgetsInPeriod]
  );

  const approvedValue = useMemo(
    () =>
      budgetsInPeriod
        .filter((budget) => budget.approved)
        .reduce((sum, budget) => sum + (budget.total || 0), 0),
    [budgetsInPeriod]
  );

  const periodLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      return `${new Date(dateFrom).toLocaleDateString('pt-BR')} – ${new Date(dateTo).toLocaleDateString('pt-BR')}`;
    }
    if (dateFrom) return `A partir de ${new Date(dateFrom).toLocaleDateString('pt-BR')}`;
    if (dateTo) return `Até ${new Date(dateTo).toLocaleDateString('pt-BR')}`;
    return 'Todos os orçamentos';
  }, [dateFrom, dateTo]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/25">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Indicadores</h3>
            <p className="text-[10px] text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        {total > 0 ? (
          <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 sm:flex dark:bg-slate-800">
            {expired > 0 && (
              <div className="bg-red-500" style={{ width: `${(expired / total) * 100}%` }} />
            )}
            {expiringSoon > 0 && (
              <div className="bg-amber-500" style={{ width: `${(expiringSoon / total) * 100}%` }} />
            )}
            {valid > 0 && (
              <div className="bg-green-500" style={{ width: `${(valid / total) * 100}%` }} />
            )}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto p-2.5 [scrollbar-width:thin]">
        <MetricChip tone="blue" icon={FileText} label="Total" value={total} hint="orçamentos" />
        <MetricChip
          tone="emerald"
          icon={DollarSign}
          label="Valor total"
          value={money(totalValue)}
          hint="orçado"
        />
        <MetricChip
          tone="teal"
          icon={ThumbsUp}
          label="Aprovados"
          value={approved}
          hint="orçamentos"
        />
        <MetricChip
          tone="violet"
          icon={DollarSign}
          label="Valor aprovado"
          value={money(approvedValue)}
          hint="aprovado"
        />
        <MetricChip tone="red" icon={AlertTriangle} label="Expirou" value={expired} />
        <MetricChip
          tone="amber"
          icon={Clock}
          label="Próximo"
          value={expiringSoon}
          hint="≤ 7 dias"
        />
        <MetricChip tone="green" icon={CheckCircle2} label="Válido" value={valid} hint="> 7 dias" />
      </div>
    </section>
  );
}
