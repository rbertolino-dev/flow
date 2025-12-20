import { Badge } from '@/components/ui/badge';
import { DigitalContractStatus } from '@/types/digital-contract';

interface DigitalContractStatusBadgeProps {
  status: DigitalContractStatus;
}

export function DigitalContractStatusBadge({ status }: DigitalContractStatusBadgeProps) {
  const statusConfig = {
    draft: {
      label: 'Rascunho',
      variant: 'secondary' as const,
    },
    sent: {
      label: 'Enviado',
      variant: 'default' as const,
    },
    signed: {
      label: 'Assinado',
      variant: 'default' as const,
      className: 'bg-green-500 hover:bg-green-600',
    },
    expired: {
      label: 'Expirado',
      variant: 'destructive' as const,
    },
    cancelled: {
      label: 'Cancelado',
      variant: 'outline' as const,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={config.className}
    >
      {config.label}
    </Badge>
  );
}

