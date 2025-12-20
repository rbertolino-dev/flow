import { Badge } from '@/components/ui/badge';
import { ContractStatus } from '@/types/contract';

interface ContractStatusBadgeProps {
  status: ContractStatus;
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  const statusConfig: Record<ContractStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Rascunho', variant: 'outline' },
    sent: { label: 'Enviado', variant: 'secondary' },
    signed: { label: 'Assinado', variant: 'default' },
    expired: { label: 'Expirado', variant: 'destructive' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}


