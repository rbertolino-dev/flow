import { ContractStatus } from '@/types/contract';
import { cn } from '@/lib/utils';

interface ContractStatusBadgeProps {
  status: ContractStatus;
}

const statusConfig: Record<
  ContractStatus,
  { label: string; dot: string; className: string }
> = {
  draft: {
    label: 'Rascunho',
    dot: 'bg-slate-400',
    className: 'border-slate-200 bg-white text-slate-600',
  },
  sent: {
    label: 'Enviado',
    dot: 'bg-slate-400',
    className: 'border-slate-200 bg-white text-slate-600',
  },
  signed: {
    label: 'Assinado',
    dot: 'bg-blue-500',
    className: 'border-slate-200 bg-white text-slate-700',
  },
  expired: {
    label: 'Expirado',
    dot: 'bg-amber-500',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  cancelled: {
    label: 'Cancelado',
    dot: 'bg-red-500',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
};

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium',
        config.className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
