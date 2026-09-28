import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
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
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { PAYMENT_METHODS } from '@/lib/paymentMethods';
import { todayIsoDate } from '@/lib/finance';
import {
  addMonthsIso,
  buildInstallments,
  paymentsMatchTotal,
  roundMoney,
  type PosSplitMode,
} from '@/lib/posFinanceSchedule';
import type { BudgetFinanceChoice, BudgetProduct } from '@/types/budget';

interface BudgetApproveFinanceDialogProps {
  budgetId: string | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: BudgetFinanceChoice) => Promise<void>;
}

const LEGACY_INCOME_CATEGORY: Record<string, string> = {
  vendas: 'Vendas',
  servicos: 'Serviços',
  serviços: 'Serviços',
  outros: 'Outros',
};

function matchIncomeCategory(value: string, names: string[]): string {
  if (!value) return '';
  const exact = names.find((name) => name === value);
  if (exact) return exact;
  const folded = names.find((name) => name.toLowerCase() === value.toLowerCase());
  if (folded) return folded;
  const legacy = LEGACY_INCOME_CATEGORY[value.toLowerCase()];
  if (!legacy) return value;
  return names.find((name) => name.toLowerCase() === legacy.toLowerCase()) || legacy;
}

function nowTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function asPaymentMethod(value: string | undefined): string {
  if (!value) return 'pix';
  const found = PAYMENT_METHODS.find(
    (method) => method.value === value || method.label.toLowerCase() === value.toLowerCase()
  );
  return found?.value || 'pix';
}

export function BudgetApproveFinanceDialog({
  budgetId,
  open,
  saving,
  onOpenChange,
  onConfirm,
}: BudgetApproveFinanceDialogProps) {
  const { activeOrgId, activeOrganization } = useActiveOrganization();
  const { users } = useOrganizationUsers();
  const [number, setNumber] = useState('');
  const [total, setTotal] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [saleDate, setSaleDate] = useState(todayIsoDate());
  const [saleTime, setSaleTime] = useState(nowTime());
  const [receiptDescription, setReceiptDescription] = useState('');
  const [saleDescription, setSaleDescription] = useState('');
  const [applyStock, setApplyStock] = useState(true);
  const [generateFinancial, setGenerateFinancial] = useState(true);
  const [addCommission, setAddCommission] = useState(false);
  const [commissionUserId, setCommissionUserId] = useState('');
  const [commissionAmount, setCommissionAmount] = useState(0);
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [accounts, setAccounts] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [splitRecurrence, setSplitRecurrence] = useState(false);
  const [splitMode, setSplitMode] = useState<PosSplitMode>('parcelar');
  const [scheduleTotal, setScheduleTotal] = useState('0');
  const [installmentCount, setInstallmentCount] = useState('1');
  const [intervalMonths, setIntervalMonths] = useState('1');
  const [downPayment, setDownPayment] = useState('');
  const [downMethod, setDownMethod] = useState('pix');
  const [restMethod, setRestMethod] = useState('cartao_credito');
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!open || !budgetId) return;
    const today = todayIsoDate();
    setSaleDate(today);
    setSaleTime(nowTime());
    setReceiptDescription('');
    setApplyStock(true);
    setGenerateFinancial(true);
    setAddCommission(false);
    setCommissionUserId('');
    setCommissionAmount(0);
    setDueDate(today);
    setAccount('');
    setCategory('');
    setPaymentNotes('');
    setPaymentMethod('pix');
    setSplitRecurrence(false);
    setSplitMode('parcelar');
    setInstallmentCount('1');
    setIntervalMonths('1');
    setDownPayment('');
    setDownMethod('pix');
    setRestMethod('cartao_credito');
    setReceiptOpen(false);

    let cancelled = false;
    void (async () => {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
              in: (column: string, values: string[]) => Promise<{ data: Array<Record<string, unknown>> | null }>;
            };
          };
        };
      };
      const { data } = await client
        .from('budgets')
        .select('budget_number, total, expires_at, delivery_date, client_data, products, payment_methods, pdf_url, observations, lead:leads(name, company)')
        .eq('id', budgetId)
        .maybeSingle();
      if (cancelled || !data) return;

      const clientData = (data.client_data && typeof data.client_data === 'object')
        ? data.client_data as { name?: string; company?: string }
        : {};
      const lead = (data.lead && typeof data.lead === 'object')
        ? data.lead as { name?: string; company?: string }
        : {};
      const customer = clientData.name || lead.name || 'Cliente';
      const company = clientData.company || lead.company || activeOrganization?.name || '';
      const products = Array.isArray(data.products) ? data.products as BudgetProduct[] : [];
      const methods = Array.isArray(data.payment_methods) ? data.payment_methods as string[] : [];
      const delivery = typeof data.delivery_date === 'string' ? data.delivery_date.slice(0, 10) : '';
      const expires = typeof data.expires_at === 'string' ? data.expires_at.slice(0, 10) : '';
      const budgetTotal = Number(data.total) || 0;

      setNumber(typeof data.budget_number === 'string' ? data.budget_number : '');
      setTotal(budgetTotal);
      setPdfUrl(typeof data.pdf_url === 'string' ? data.pdf_url : null);
      setSaleDescription(`Venda - ${customer}${company ? ` - ${company}` : ''}`);
      setDueDate(delivery || expires || today);
      setScheduleTotal(String(roundMoney(budgetTotal)));
      setPaymentMethod(asPaymentMethod(methods[0]));
      setPaymentNotes(typeof data.observations === 'string' ? data.observations : '');

      const productIds = products
        .map((item) => item.id)
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
      if (!productIds.length || !activeOrgId) return;
      const { data: productRows } = await client
        .from('products')
        .select('id, commission_percentage, commission_fixed')
        .eq('organization_id', activeOrgId)
        .in('id', productIds);
      if (cancelled || !productRows) return;
      const rates = new Map(productRows.map((row) => [String(row.id), {
        commission_percentage: Number(row.commission_percentage) || 0,
        commission_fixed: Number(row.commission_fixed) || 0,
      }]));
      const amount = products.reduce((sum, item) => {
        const rate = rates.get(item.id);
        if (!rate) return sum;
        const lineTotal = Number(item.subtotal || item.price * (item.quantity || 1)) || 0;
        const percent = rate.commission_percentage;
        const fixed = rate.commission_fixed;
        return sum + (lineTotal * percent) / 100 + fixed * (item.quantity || 1);
      }, 0);
      setCommissionAmount(roundMoney(amount));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, budgetId, activeOrgId, activeOrganization?.name]);

  useEffect(() => {
    if (!open || !activeOrgId) return;
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order: (column: string) => Promise<{ data: Array<{ name: string }> | null }>;
            in: (column: string, values: string[]) => {
              order: (column: string) => Promise<{ data: Array<{ name: string }> | null }>;
            };
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
    void client
      .from('financial_categories')
      .select('name')
      .eq('organization_id', activeOrgId)
      .in('direction', ['receber', 'ambos'])
      .order('name')
      .then(({ data }) => {
        const names = (data || []).map((row) => row.name).filter(Boolean);
        setIncomeCategories(names);
        setCategory((current) => matchIncomeCategory(current || 'Vendas', names));
      });
  }, [open, activeOrgId]);

  const chargedTotal = roundMoney(total);
  const parsedScheduleTotal = Number(String(scheduleTotal).replace(',', '.')) || 0;
  const parsedCount = Math.max(0, Math.floor(Number(installmentCount) || 0));
  const parsedInterval = Math.max(0, Math.floor(Number(intervalMonths) || 0));
  const parsedDown = Number(String(downPayment).replace(',', '.')) || 0;
  const maxCount = splitMode === 'recorrencia' ? 24 : 12;

  const financeLines = useMemo(() => {
    if (!splitRecurrence || !generateFinancial) return [];
    if (splitMode === 'entrada') {
      const rest = roundMoney(chargedTotal - parsedDown);
      if (parsedDown <= 0 || rest <= 0 || parsedCount < 1 || parsedCount > 12) return [];
      return [
        { amount: roundMoney(parsedDown), due_date: dueDate, method: downMethod },
        ...buildInstallments({
          total: rest,
          count: parsedCount,
          startDate: addMonthsIso(dueDate, 1),
          method: restMethod,
          intervalMonths: 1,
        }),
      ];
    }
    if (parsedCount < 1 || parsedCount > maxCount) return [];
    if (splitMode === 'recorrencia' && parsedInterval < 1) return [];
    if (!paymentsMatchTotal(parsedScheduleTotal, chargedTotal)) return [];
    return buildInstallments({
      total: chargedTotal,
      count: parsedCount,
      startDate: dueDate,
      method: paymentMethod,
      intervalMonths: splitMode === 'recorrencia' ? parsedInterval : 1,
    });
  }, [
    splitRecurrence,
    generateFinancial,
    splitMode,
    parsedDown,
    parsedCount,
    parsedInterval,
    parsedScheduleTotal,
    chargedTotal,
    dueDate,
    paymentMethod,
    downMethod,
    restMethod,
    maxCount,
  ]);

  const installmentValue = financeLines.length
    ? splitMode === 'entrada'
      ? financeLines[1]?.amount || 0
      : financeLines[0]?.amount || 0
    : 0;
  const entradaRest = roundMoney(Math.max(0, chargedTotal - parsedDown));
  const splitValid = !splitRecurrence || !generateFinancial || financeLines.length > 0;
  const commissionUser = users.find((user) => user.id === commissionUserId);
  const canConfirm = !saving
    && !!saleDate
    && splitValid
    && (!generateFinancial || (!!dueDate && !!account))
    && (!addCommission || commissionAmount <= 0 || !!commissionUserId);

  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const methodSelect = (value: string, onChange: (next: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_METHODS.map((method) => (
          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const openReceipt = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setReceiptOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{number ? `Aprovar orçamento ${number}` : 'Aprovar orçamento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Data da venda:</Label>
              <div className="grid grid-cols-[1fr_7.5rem] gap-2">
                <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
                <Input type="time" value={saleTime} onChange={(event) => setSaleTime(event.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="budget-receipt-description">Adicionar descrição para o comprovante de venda</Label>
              <Textarea
                id="budget-receipt-description"
                placeholder="Cláusulas, explicações, etc."
                value={receiptDescription}
                onChange={(event) => setReceiptDescription(event.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="budget-commission"
                  checked={addCommission}
                  onCheckedChange={setAddCommission}
                  className="data-[state=checked]:bg-green-500"
                />
                <Label htmlFor="budget-commission">Adicionar comissão de venda</Label>
              </div>
              {addCommission ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Vendedor</Label>
                    <Select value={commissionUserId || 'none'} onValueChange={(value) => setCommissionUserId(value === 'none' ? '' : value)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.full_name || user.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Comissão dos produtos</Label>
                    <p className="pt-2 text-sm">
                      {commissionAmount > 0 ? money(commissionAmount) : 'Sem comissão cadastrada nos produtos'}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <Switch
                  id="budget-stock"
                  checked={applyStock}
                  onCheckedChange={setApplyStock}
                  className="data-[state=checked]:bg-green-500"
                />
                <Label htmlFor="budget-stock">Lançar saída no estoque</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="budget-fin"
                  checked={generateFinancial}
                  onCheckedChange={setGenerateFinancial}
                  className="data-[state=checked]:bg-green-500"
                />
                <Label htmlFor="budget-fin">Gerar lançamento no financeiro</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={saleDescription}
                onChange={(event) => setSaleDescription(event.target.value)}
                aria-label="Descrição da venda"
              />
              <Button type="button" variant="secondary" onClick={openReceipt}>
                Comprovante
              </Button>
            </div>

            {generateFinancial ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Vencimento</Label>
                    <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Conta financeira</Label>
                    <Select value={account || 'none'} onValueChange={(value) => setAccount(value === 'none' ? '' : value)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        {account && !accounts.includes(account) ? (
                          <SelectItem value={account}>{account}</SelectItem>
                        ) : null}
                        {accounts.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Categoria</Label>
                    <Select value={category || '__none__'} onValueChange={(value) => setCategory(value === '__none__' ? '' : value)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {category && !incomeCategories.includes(category) ? (
                          <SelectItem value={category}>{category}</SelectItem>
                        ) : null}
                        {incomeCategories.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Forma de pagamento</Label>
                  {methodSelect(paymentMethod, setPaymentMethod)}
                </div>

                <div className="space-y-1">
                  <Label>Observações sobre pagamento</Label>
                  <Textarea
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    id="budget-split"
                    checked={splitRecurrence}
                    onCheckedChange={setSplitRecurrence}
                    disabled={!generateFinancial}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <Label htmlFor="budget-split">Dividir lançamento ou criar recorrência</Label>
                </div>

                {splitRecurrence ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <Select value={splitMode} onValueChange={(value) => setSplitMode(value as PosSplitMode)}>
                      <SelectTrigger aria-label="Tipo de divisão">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parcelar">Parcelar</SelectItem>
                        <SelectItem value="recorrencia">Gerar recorrência</SelectItem>
                        <SelectItem value="entrada">Pagamento com entrada</SelectItem>
                      </SelectContent>
                    </Select>
                    {splitMode === 'parcelar' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Valor total</Label>
                          <Input value={scheduleTotal} onChange={(event) => setScheduleTotal(event.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Quantidade de parcelas (máx.: 12)</Label>
                          <Input value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} inputMode="numeric" />
                        </div>
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                          {money(chargedTotal)} dividido em {parsedCount || 0}x de {money(installmentValue)}
                        </p>
                      </div>
                    ) : null}
                    {splitMode === 'recorrencia' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Total de lançamentos (máx.: 24)</Label>
                          <Input value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} inputMode="numeric" />
                        </div>
                        <div className="space-y-1">
                          <Label>Intervalo em meses</Label>
                          <Input value={intervalMonths} onChange={(event) => setIntervalMonths(event.target.value)} inputMode="numeric" />
                        </div>
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                          {parsedCount || 0} lançamentos de {money(installmentValue)} a cada {parsedInterval || 0} meses
                        </p>
                      </div>
                    ) : null}
                    {splitMode === 'entrada' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Valor da entrada</Label>
                          <Input value={downPayment} onChange={(event) => setDownPayment(event.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Forma de Pag</Label>
                          {methodSelect(downMethod, setDownMethod)}
                        </div>
                        <div className="space-y-1">
                          <Label>Restante em parcelas (máx.: 12)</Label>
                          <Input value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} inputMode="numeric" />
                        </div>
                        <div className="space-y-1">
                          <Label>Forma de Pag</Label>
                          {methodSelect(restMethod, setRestMethod)}
                        </div>
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                          Entrada {money(parsedDown)} e {money(entradaRest)} em {parsedCount || 0}x de {money(installmentValue)}
                        </p>
                      </div>
                    ) : null}
                    {!splitValid ? (
                      <p className="text-sm text-destructive">A divisão precisa fechar o total do orçamento, dentro dos limites de parcelas.</p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              className="bg-green-500 px-10 text-white hover:bg-green-600"
              disabled={!canConfirm}
              onClick={() => void onConfirm({
                saleDate,
                saleTime,
                receiptDescription: receiptDescription.trim(),
                saleDescription: saleDescription.trim(),
                applyStock,
                generateFinancial,
                dueDate,
                account,
                category: category || 'Vendas',
                paymentNotes: paymentNotes.trim(),
                paymentMethod,
                financeLines: splitRecurrence && generateFinancial ? financeLines : [],
                isRecurring: splitRecurrence && generateFinancial && splitMode === 'recorrencia',
                addCommission,
                commissionUserName: addCommission ? (commissionUser?.full_name || commissionUser?.email || null) : null,
                commissionAmount: addCommission ? commissionAmount : 0,
              })}
            >
              {saving ? 'Confirmando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprovante de venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{saleDescription || 'Venda'}</p>
            <p>Data: {saleDate.split('-').reverse().join('/')} {saleTime}</p>
            <p>Total: {money(total)}</p>
            {receiptDescription ? <p className="whitespace-pre-wrap">{receiptDescription}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { BudgetFinanceChoice };
