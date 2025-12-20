import { Budget } from '@/types/budget-module';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, Download, Send, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BudgetListProps {
  budgets: Budget[];
  loading?: boolean;
  onView?: (budget: Budget) => void;
  onEdit?: (budget: Budget) => void;
  onDelete?: (budget: Budget) => void;
  onDownload?: (budget: Budget) => void;
  onSendWhatsApp?: (budget: Budget) => void;
}

export function BudgetList({
  budgets,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onDownload,
  onSendWhatsApp,
}: BudgetListProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando orçamentos...</p>
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-2">Nenhum orçamento encontrado</p>
        <p className="text-sm text-muted-foreground">
          Crie seu primeiro orçamento clicando em "Novo Orçamento"
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Criado em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {budgets.map((budget) => {
          const expired = isExpired(budget.expires_at);
          const client = budget.client_data || budget.lead;

          return (
            <TableRow key={budget.id}>
              <TableCell className="font-medium">{budget.budget_number}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{client?.name || 'N/A'}</div>
                  {client?.phone && (
                    <div className="text-sm text-muted-foreground">{client.phone}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatCurrency(budget.total)}</TableCell>
              <TableCell>
                {budget.expires_at
                  ? format(new Date(budget.expires_at), 'dd/MM/yyyy', { locale: ptBR })
                  : 'N/A'}
              </TableCell>
              <TableCell>
                {expired ? (
                  <Badge variant="destructive">Expirado</Badge>
                ) : (
                  <Badge variant="default">Válido</Badge>
                )}
              </TableCell>
              <TableCell>
                {format(new Date(budget.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(budget)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(budget)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDownload && budget.pdf_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(budget)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {onSendWhatsApp && client?.phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSendWhatsApp(budget)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(budget)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

