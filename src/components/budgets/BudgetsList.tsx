import { Budget } from '@/types/budget';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, Download, Send, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { differenceInDays } from 'date-fns';

interface BudgetsListProps {
  budgets: Budget[];
  loading: boolean;
  onView: (budget: Budget) => void;
  onRegenerate: (budget: Budget) => void;
  onSend: (budget: Budget) => void;
  onDownload: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
}

export function BudgetsList({
  budgets,
  loading,
  onView,
  onRegenerate,
  onSend,
  onDownload,
  onDelete,
}: BudgetsListProps) {
  const getStatus = (budget: Budget) => {
    if (!budget.expires_at) return { label: 'Válido', variant: 'default' as const };
    const daysLeft = differenceInDays(new Date(budget.expires_at), new Date());
    if (daysLeft < 0) return { label: 'Expirado', variant: 'destructive' as const };
    if (daysLeft <= 7) return { label: `Expira em ${daysLeft} dias`, variant: 'secondary' as const };
    return { label: 'Válido', variant: 'default' as const };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Nenhum orçamento encontrado. Crie um novo orçamento para começar.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((budget) => {
            const status = getStatus(budget);
            const client = budget.client_data || budget.lead;

            return (
              <TableRow key={budget.id}>
                <TableCell className="font-medium">{budget.budget_number}</TableCell>
                <TableCell>{client?.name || 'N/A'}</TableCell>
                <TableCell>{format(new Date(budget.created_at), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  {budget.expires_at
                    ? format(new Date(budget.expires_at), 'dd/MM/yyyy')
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budget.total || 0)}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(budget)}
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRegenerate(budget)}
                      title="Regenerar PDF"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDownload(budget)}
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSend(budget)}
                      title="Enviar via WhatsApp"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(budget)}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}


