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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { todayIsoDate } from '@/lib/finance';

export interface BudgetFinanceChoice {
  received: boolean;
  date: string;
  account: string;
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
  const [account, setAccount] = useState('');
  const [accounts, setAccounts] = useState<string[]>([]);
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (!open || !budgetId) return;
    setMode('receivable');
    const today = todayIsoDate();
    setDate(today);
    setAccount('');
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

  useEffect(() => {
    if (!open || !activeOrgId) return;
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order: (column: string) => Promise<{ data: Array<{ name: string }> | null }>;
          };
        };
      };
    };
    void client
      .from('financial_accounts')
      .select('name')
      .eq('organization_id', activeOrgId)
      .order('name')
      .then(({ data }) => {
        const names = (data || []).map((row) => row.name).filter(Boolean);
        setAccounts(names);
        setAccount((current) => current || names.find((name) => name.toLowerCase() === 'caixa') || names[0] || '');
      });
  }, [open, activeOrgId]);

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
        <div>
          <Label>Conta da carteira</Label>
          <Select value={account || 'none'} onValueChange={(value) => setAccount(value === 'none' ? '' : value)}>
            <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione a conta</SelectItem>
              {accounts.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700"
            disabled={saving || !date || !account}
            onClick={() => void onConfirm({ received: mode === 'received', date, account })}
          >
            Confirmar e lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
