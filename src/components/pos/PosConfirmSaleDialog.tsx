import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS, getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import type { PosPaymentLine } from "@/types/pos";
import {
  addMonthsIso,
  buildInstallments,
  paymentsMatchTotal,
  roundMoney,
  type PosFinanceLine,
  type PosSplitMode,
} from "@/lib/posFinanceSchedule";

export type PosConfirmSaleValues = {
  applyStock: boolean;
  generateFinancial: boolean;
  saleDescription: string;
  paymentDate: string;
  financialAccount: string;
  financialCategory: string;
  paymentMethod: string;
  paymentNotes: string;
  splitRecurrence: boolean;
  splitMode: PosSplitMode | null;
  financeLines: PosFinanceLine[];
  salePayments: PosPaymentLine[] | null;
  attachmentName: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleCodePreview?: string | number;
  total: number;
  customerName?: string | null;
  organizationName?: string;
  defaultPaymentMethod?: string;
  defaultFinancialAccount?: string;
  defaultFinancialCategory?: string;
  defaultNotes?: string;
  existingPayments?: PosPaymentLine[];
  resolveTotal?: (method: string) => number;
  loading?: boolean;
  onConfirm: (values: PosConfirmSaleValues) => void;
};

const LEGACY_INCOME_CATEGORY: Record<string, string> = {
  vendas: "Vendas",
  servicos: "Serviços",
  serviços: "Serviços",
  outros: "Outros",
};

function matchIncomeCategory(value: string, names: string[]): string {
  if (!value) return "";
  const exact = names.find((name) => name === value);
  if (exact) return exact;
  const folded = names.find((name) => name.toLowerCase() === value.toLowerCase());
  if (folded) return folded;
  const legacy = LEGACY_INCOME_CATEGORY[value.toLowerCase()];
  if (!legacy) return value;
  return names.find((name) => name.toLowerCase() === legacy.toLowerCase()) || legacy;
}

function todayInputDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PosConfirmSaleDialog({
  open,
  onOpenChange,
  saleCodePreview = "—",
  total,
  customerName,
  organizationName,
  defaultPaymentMethod,
  defaultFinancialAccount,
  defaultFinancialCategory,
  defaultNotes,
  existingPayments = [],
  resolveTotal,
  loading,
  onConfirm,
}: Props) {
  const [applyStock, setApplyStock] = useState(true);
  const [generateFinancial, setGenerateFinancial] = useState(true);
  const [saleDescription, setSaleDescription] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInputDate());
  const [financialAccount, setFinancialAccount] = useState("");
  const [financialCategory, setFinancialCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod || "pix");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [splitRecurrence, setSplitRecurrence] = useState(false);
  const [splitMode, setSplitMode] = useState<PosSplitMode>("parcelar");
  const [scheduleTotal, setScheduleTotal] = useState(String(total));
  const [installmentCount, setInstallmentCount] = useState("1");
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [downPayment, setDownPayment] = useState("");
  const [downMethod, setDownMethod] = useState("pix");
  const [restMethod, setRestMethod] = useState("cartao_credito");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [walletAccounts, setWalletAccounts] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (!open) return;
    const dateLabel = new Date().toLocaleDateString("pt-BR");
    const desc = customerName
      ? `Venda - ${customerName} - ${dateLabel}`
      : `Venda - ${dateLabel}`;
    setSaleDescription(desc);
    setPaymentDate(todayInputDate());
    setFinancialAccount(defaultFinancialAccount || organizationName || "Conta principal");
    setFinancialCategory(matchIncomeCategory(defaultFinancialCategory || "", []));
    setPaymentMethod(defaultPaymentMethod || "pix");
    setPaymentNotes(defaultNotes || "");
    setApplyStock(true);
    setGenerateFinancial(true);
    setSplitRecurrence(false);
    setSplitMode("parcelar");
    setScheduleTotal(String(roundMoney(total)));
    setInstallmentCount("1");
    setIntervalMonths("1");
    setDownPayment("");
    setDownMethod("pix");
    setRestMethod("cartao_credito");
    setAttachmentName(null);
  }, [
    open,
    customerName,
    organizationName,
    defaultPaymentMethod,
    defaultFinancialAccount,
    defaultFinancialCategory,
    defaultNotes,
    total,
  ]);

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
        setWalletAccounts(names);
        setFinancialAccount((current) => current || names[0] || '');
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
        setFinancialCategory((current) => matchIncomeCategory(current, names));
      });
  }, [open, activeOrgId]);

  useEffect(() => {
    if (!open || !splitRecurrence) return;
    setScheduleTotal(String(roundMoney(
      resolveTotal ? resolveTotal(splitMode === "entrada" ? restMethod : paymentMethod) : total
    )));
  }, [open, splitRecurrence, splitMode, paymentMethod, restMethod, resolveTotal, total]);

  const chargedTotal = roundMoney(
    splitRecurrence && resolveTotal
      ? resolveTotal(splitMode === "entrada" ? restMethod : paymentMethod)
      : total
  );
  const parsedScheduleTotal = Number(String(scheduleTotal).replace(",", ".")) || 0;
  const parsedCount = Math.max(0, Math.floor(Number(installmentCount) || 0));
  const parsedInterval = Math.max(0, Math.floor(Number(intervalMonths) || 0));
  const parsedDown = Number(String(downPayment).replace(",", ".")) || 0;
  const maxCount = splitMode === "recorrencia" ? 24 : 12;
  const hasExisting = existingPayments.length > 0;

  const financeLines = useMemo(() => {
    if (!splitRecurrence || !generateFinancial) return [] as PosFinanceLine[];
    if (splitMode === "entrada") {
      const rest = roundMoney(chargedTotal - parsedDown);
      if (parsedDown <= 0 || rest <= 0 || parsedCount < 1 || parsedCount > 12) return [];
      return [
        { amount: roundMoney(parsedDown), due_date: paymentDate, method: downMethod },
        ...buildInstallments({
          total: rest,
          count: parsedCount,
          startDate: addMonthsIso(paymentDate, 1),
          method: restMethod,
          intervalMonths: 1,
        }),
      ];
    }
    if (parsedCount < 1 || parsedCount > maxCount) return [];
    if (splitMode === "recorrencia" && parsedInterval < 1) return [];
    if (!paymentsMatchTotal(parsedScheduleTotal, chargedTotal)) return [];
    return buildInstallments({
      total: chargedTotal,
      count: parsedCount,
      startDate: paymentDate,
      method: paymentMethod,
      intervalMonths: splitMode === "recorrencia" ? parsedInterval : 1,
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
    paymentDate,
    paymentMethod,
    downMethod,
    restMethod,
    maxCount,
  ]);

  const entradaRest = roundMoney(Math.max(0, chargedTotal - parsedDown));
  const installmentValue = financeLines.length
    ? splitMode === "entrada"
      ? financeLines[1]?.amount || 0
      : financeLines[0]?.amount || 0
    : 0;
  const splitValid = !splitRecurrence || !generateFinancial || financeLines.length > 0;
  const canConfirm = total >= 0 && !loading && splitValid && (!!paymentMethod || hasExisting);

  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <DialogTitle>Confirmar venda</DialogTitle>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Código da venda</div>
              <div className="text-lg font-semibold tabular-nums">{saleCodePreview}</div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={applyStock} onCheckedChange={setApplyStock} id="pos-stock" />
              <Label htmlFor="pos-stock">Lançar saída no estoque</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={generateFinancial}
                onCheckedChange={setGenerateFinancial}
                id="pos-fin"
              />
              <Label htmlFor="pos-fin">Gerar lançamento no financeiro</Label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pos-sale-description">Descrição</Label>
            <Input
              id="pos-sale-description"
              value={saleDescription}
              onChange={(e) => setSaleDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Pagamento em</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Conta financeira</Label>
              <Select value={financialAccount || 'none'} onValueChange={(value) => setFinancialAccount(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione a conta</SelectItem>
                  {financialAccount && financialAccount !== "none" && !walletAccounts.includes(financialAccount) ? (
                    <SelectItem value={financialAccount}>{financialAccount}</SelectItem>
                  ) : null}
                  {walletAccounts.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select
                value={financialCategory || "__none__"}
                onValueChange={(v) => setFinancialCategory(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione a categoria</SelectItem>
                  {financialCategory && !incomeCategories.includes(financialCategory) && (
                    <SelectItem value={financialCategory}>{financialCategory}</SelectItem>
                  )}
                  {incomeCategories.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hasExisting || splitRecurrence ? (
              <div className="space-y-1">
                <Label>Forma de Pag</Label>
                {methodSelect(paymentMethod, setPaymentMethod)}
              </div>
            ) : (
              <div className="space-y-1 text-sm text-muted-foreground">
                <Label>Formas do resumo</Label>
                <p className="pt-2">A venda usa as formas já lançadas.</p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Observações sobre pagamento</Label>
            <Textarea
              placeholder="Digite"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={2}
            />
          </div>

          {hasExisting && !splitRecurrence ? (
            <div className="rounded-md border px-3 py-2 text-sm">
              {existingPayments.map((payment) => (
                <div key={payment.id} className="flex justify-between py-1">
                  <span>{getPaymentMethodLabel(payment.method as PaymentMethod)}</span>
                  <span className="tabular-nums">{money(payment.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Anexar</Label>
            <Input type="file" onChange={(event) => setAttachmentName(event.target.files?.[0]?.name || null)} />
            {attachmentName ? <p className="text-xs text-muted-foreground">{attachmentName}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={splitRecurrence}
              onCheckedChange={setSplitRecurrence}
              id="pos-split"
              disabled={!generateFinancial}
            />
            <Label htmlFor="pos-split">Dividir lançamento ou criar recorrência</Label>
          </div>

          {splitRecurrence && generateFinancial ? (
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
              {splitMode === "parcelar" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Valor total</Label>
                    <Input value={scheduleTotal} onChange={(event) => setScheduleTotal(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pos-installment-count">Quantidade de parcelas (máx.: 12)</Label>
                    <Input id="pos-installment-count" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} inputMode="numeric" />
                  </div>
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    {money(chargedTotal)} dividido em {parsedCount || 0}x de {money(installmentValue)}
                  </p>
                </div>
              ) : null}
              {splitMode === "recorrencia" ? (
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
              {splitMode === "entrada" ? (
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
                <p className="text-sm text-destructive">A divisão precisa fechar o total da venda, dentro dos limites de parcelas.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Total a registrar: <strong>{money(total)}</strong>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!canConfirm}
            onClick={() => {
              const lines = splitRecurrence && generateFinancial ? financeLines : [];
              const grouped = new Map<string, number>();
              for (const line of lines) {
                grouped.set(line.method, roundMoney((grouped.get(line.method) || 0) + line.amount));
              }
              onConfirm({
                applyStock,
                generateFinancial,
                saleDescription,
                paymentDate,
                financialAccount,
                financialCategory,
                paymentMethod,
                paymentNotes,
                splitRecurrence: splitRecurrence && generateFinancial,
                splitMode: splitRecurrence && generateFinancial ? splitMode : null,
                financeLines: lines,
                salePayments: lines.length
                  ? Array.from(grouped.entries()).map(([method, amount]) => ({
                    id: crypto.randomUUID(),
                    method,
                    amount,
                  }))
                  : null,
                attachmentName,
              });
            }}
          >
            {loading ? "Confirmando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
