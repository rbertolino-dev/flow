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
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import type { PosPaymentLine } from "@/types/pos";

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
  loading?: boolean;
  onConfirm: (values: PosConfirmSaleValues, payment: PosPaymentLine) => void;
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
  }, [
    open,
    customerName,
    organizationName,
    defaultPaymentMethod,
    defaultFinancialAccount,
    defaultFinancialCategory,
    defaultNotes,
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

  const canConfirm = useMemo(
    () => !!paymentMethod && total >= 0 && !loading,
    [paymentMethod, total, loading]
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
            <Label>Descrição</Label>
            <Input
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
            <div className="space-y-1">
              <Label>Forma de Pag</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="flex items-center gap-2">
            <Switch
              checked={splitRecurrence}
              onCheckedChange={setSplitRecurrence}
              id="pos-split"
            />
            <Label htmlFor="pos-split">Dividir lançamento ou criar recorrência</Label>
          </div>

          <p className="text-sm text-muted-foreground">
            Total a registrar:{" "}
            <strong>
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!canConfirm}
            onClick={() =>
              onConfirm(
                {
                  applyStock,
                  generateFinancial,
                  saleDescription,
                  paymentDate,
                  financialAccount,
                  financialCategory,
                  paymentMethod,
                  paymentNotes,
                  splitRecurrence,
                },
                {
                  id: crypto.randomUUID(),
                  method: paymentMethod,
                  amount: Number(total.toFixed(2)),
                }
              )
            }
          >
            {loading ? "Confirmando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
