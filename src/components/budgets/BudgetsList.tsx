import type { ReactNode } from 'react';
import { Budget } from '@/types/budget';
import {
  Eye,
  Download,
  Send,
  RefreshCw,
  Trash2,
  Loader2,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  Calendar,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BudgetsListProps {
  budgets: Budget[];
  loading: boolean;
  onView: (budget: Budget) => void;
  onRegenerate: (budget: Budget) => void;
  onSend: (budget: Budget) => void;
  onDownload: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
  onEdit?: (budget: Budget) => void;
  onApprove?: (budget: Budget) => void;
  onReject?: (budget: Budget) => void;
}

type StatusTone = 'valid' | 'expiring' | 'expired' | 'approved' | 'rejected';

const avatarPalette = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function splitBudgetNumber(value: string) {
  const separator = value.indexOf('-');
  if (separator === -1) return { top: value, bottom: '' };
  return {
    top: value.slice(0, separator + 1),
    bottom: value.slice(separator + 1),
  };
}

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarClass(name: string) {
  const hash = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatarPalette[hash % avatarPalette.length];
}

function resolveStatus(budget: Budget): { label: string; tone: StatusTone } {
  if (budget.rejected) return { label: 'Recusado', tone: 'rejected' };
  if (budget.approved) return { label: 'Aprovado', tone: 'approved' };
  if (!budget.expires_at) return { label: 'Válido', tone: 'valid' };
  const daysLeft = differenceInDays(new Date(budget.expires_at), new Date());
  if (daysLeft < 0) return { label: 'Expirado', tone: 'expired' };
  if (daysLeft <= 7) return { label: `Expira em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`, tone: 'expiring' };
  return { label: 'Válido', tone: 'valid' };
}

const statusClass: Record<StatusTone, string> = {
  valid: 'bg-blue-50 text-blue-700',
  expiring: 'bg-amber-50 text-amber-700',
  expired: 'bg-rose-50 text-rose-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
};

const statusDot: Record<StatusTone, string> = {
  valid: 'bg-blue-500',
  expiring: 'bg-amber-500',
  expired: 'bg-rose-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
};

function ActionButton({
  label,
  onClick,
  className,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function BudgetsList({
  budgets,
  loading,
  onView,
  onRegenerate,
  onSend,
  onDownload,
  onDelete,
  onEdit,
  onApprove,
  onReject,
}: BudgetsListProps) {
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        Nenhum orçamento encontrado. Crie um novo orçamento para começar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#16233a] text-left text-[13px] font-medium text-white">
              <th className="px-4 py-3.5 font-medium">Número</th>
              <th className="px-4 py-3.5 font-medium">Cliente</th>
              <th className="px-4 py-3.5 font-medium">Data</th>
              <th className="px-4 py-3.5 font-medium">Validade</th>
              <th className="px-4 py-3.5 font-medium">Total</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 font-medium">Criado por</th>
              <th className="px-4 py-3.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((budget) => {
              const status = resolveStatus(budget);
              const client = budget.client_data || budget.lead;
              const clientName = client?.name || 'Sem cliente';
              const number = splitBudgetNumber(budget.budget_number || '');
              const decided = Boolean(budget.approved || budget.rejected);

              return (
                <tr key={budget.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                  <td className="px-4 py-3.5 align-middle">
                    <div className="leading-tight text-slate-800">
                      <div>{number.top}</div>
                      {number.bottom ? <div>{number.bottom}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClass(clientName)}`}
                      >
                        {clientInitials(clientName)}
                      </span>
                      <span className="max-w-[180px] text-[13px] font-medium uppercase leading-snug tracking-wide text-slate-600">
                        {clientName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {format(new Date(budget.created_at), 'dd/MM/yyyy')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {budget.expires_at ? format(new Date(budget.expires_at), 'dd/MM/yyyy') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-middle font-semibold text-slate-900">
                    {money.format(budget.total || 0)}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[status.tone]}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status.tone]}`} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-slate-600">
                    {budget.creator?.full_name || budget.creator?.email || '—'}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex items-center justify-end gap-1.5">
                      <ActionButton label="Visualizar" onClick={() => onView(budget)} className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                        <Eye className="h-4 w-4" />
                      </ActionButton>
                      {onEdit ? (
                        <ActionButton label="Editar" onClick={() => onEdit(budget)} className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                          <Pencil className="h-4 w-4" />
                        </ActionButton>
                      ) : null}
                      {onApprove ? (
                        <ActionButton
                          label="Aprovar"
                          disabled={decided}
                          onClick={() => onApprove(budget)}
                          className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        >
                          <Check className="h-4 w-4" />
                        </ActionButton>
                      ) : null}
                      {onReject ? (
                        <ActionButton
                          label="Recusar"
                          disabled={decided}
                          onClick={() => onReject(budget)}
                          className="bg-rose-50 text-rose-500 hover:bg-rose-100"
                        >
                          <X className="h-4 w-4" />
                        </ActionButton>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Mais ações"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onRegenerate(budget)} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Renovar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownload(budget)} className="gap-2">
                            <Download className="h-4 w-4" />
                            Baixar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSend(budget)} className="gap-2">
                            <Send className="h-4 w-4" />
                            Enviar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(budget)} className="gap-2 text-rose-600 focus:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
