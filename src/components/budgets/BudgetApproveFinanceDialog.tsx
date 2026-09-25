import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { todayIsoDate } from '@/lib/finance';

export interface BudgetFinanceChoice {
  received: boolean;
  date: string;
}

interface BudgetApproveFinanceDialogProps {
  budgetId: string | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: BudgetFinanceChoice) => Promise<void>;
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function BudgetApproveFinanceDialog({
  budgetId,
  open,
  saving,
  onOpenChange,
  onConfirm,
}: BudgetApproveFinanceDialogProps) {
  const [mode, setMode] = useState<'received' | 'receivable'>('receivable');
  const [date, setDate] = useState(todayIsoDate());
  const [total, setTotal] = useState(0);
  const [number, setNumber] = useState('');

  useEffect(() => {
    if (!open || !budgetId) return;
    setMode('receivable');
    const today = todayIsoDate();
    setDate(today);
    let cancelled = false;

    void (async () => {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
            };
          };
        };
      };
      const { data } = await client
        .from('budgets')
        .select('budget_number, total, expires_at, delivery_date')
        .eq('id', budgetId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = {
        budget_number: typeof data.budget_number === 'string' ? data.budget_number : '',
        total: Number(data.total) || 0,
        expires_at: typeof data.expires_at === 'string' ? data.expires_at : null,
        delivery_date: typeof data.delivery_date === 'string' ? data.delivery_date : null,
      };
      setNumber(row.budget_number);
      setTotal(row.total);
      setDate(dateOnly(row.delivery_date) || dateOnly(row.expires_at) || today);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, budgetId]);

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar orçamento</DialogTitle>
          <DialogDescription>
            {number ? `Orçamento ${number} · ${money}` : money}. Escolha como esse valor entra no financeiro. Vendas do mesmo cliente no PDV continuam em lançamentos separados.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'received' | 'receivable')} className="gap-3">
          <label className="flex items-start gap-3 rounded-md border p-3">
            <RadioGroupItem value="received" className="mt-1" />
            <span>
              <span className="block font-medium">Já recebido</span>
              <span className="text-sm text-muted-foreground">Entra em contas a receber como recebido.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <RadioGroupItem value="receivable" className="mt-1" />
            <span>
              <span className="block font-medium">A receber</span>
              <span className="text-sm text-muted-foreground">Entra em aberto na data informada.</span>
            </span>
          </label>
        </RadioGroup>
        <div>
          <Label>{mode === 'received' ? 'Data do recebimento' : 'Data a receber'}</Label>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700"
            disabled={saving || !date}
            onClick={() => void onConfirm({ received: mode === 'received', date })}
          >
            Confirmar e lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
