import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAsaasBoletos } from "@/hooks/useAsaasBoletos";
import type { CobrancaFormPrefill } from "./cobrancaTypes";
import { Loader2 } from "lucide-react";

interface NovaCobrancaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: CobrancaFormPrefill | null;
  onCreated?: () => void;
}

const emptyForm = {
  descricao: "",
  valor: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerCpfCnpj: "",
  dataVencimento: "",
  generateFinancial: true,
  applyFineInterest: false,
  multaValor: "0,00",
  jurosPercentual: "0,00",
  postalEnabled: false,
  generateInstallments: false,
  installmentCount: "1",
};

function parseMoney(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Number(normalized) || 0;
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs text-muted-foreground mb-1 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

function OptionRow({
  label,
  hint,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 min-h-8">
        <div className="min-w-0">
          <p className="text-sm leading-tight">{label}</p>
          {hint ? <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</p> : null}
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
      </div>
      {checked && children ? <div className="pl-0.5">{children}</div> : null}
    </div>
  );
}

export function NovaCobrancaDialog({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: NovaCobrancaDialogProps) {
  const { createBoleto, isCreatingBoleto } = useAsaasBoletos();
  const [form, setForm] = useState(emptyForm);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [budgetId, setBudgetId] = useState<string | undefined>();
  const [posSaleId, setPosSaleId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLeadId(prefill?.leadId);
    setBudgetId(prefill?.budgetId);
    setPosSaleId(prefill?.posSaleId);
    setForm({
      ...emptyForm,
      descricao: prefill?.descricao || "",
      valor: prefill?.valor != null
        ? prefill.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "",
      customerName: prefill?.customerName || "",
      customerPhone: prefill?.customerPhone || "",
      customerEmail: prefill?.customerEmail || "",
      customerCpfCnpj: prefill?.customerCpfCnpj || "",
      dataVencimento: prefill?.dataVencimento || "",
      generateInstallments: (prefill?.installmentCount || 1) > 1,
      installmentCount: String(prefill?.installmentCount || 1),
    });
  }, [open, prefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valor = parseMoney(form.valor);
    if (!form.customerName.trim()) {
      setError("Nome do cliente é obrigatório");
      return;
    }
    if (!valor || valor <= 0) {
      setError("Informe um valor válido");
      return;
    }
    if (!form.dataVencimento) {
      setError("Vencimento é obrigatório");
      return;
    }

    const installmentCount = form.generateInstallments
      ? Math.max(1, Math.min(48, Number(form.installmentCount) || 1))
      : 1;

    try {
      await createBoleto({
        leadId,
        budgetId,
        posSaleId,
        generateFinancial: form.generateFinancial,
        customer: {
          name: form.customerName.trim(),
          phone: form.customerPhone.trim() || undefined,
          email: form.customerEmail.trim() || undefined,
          cpfCnpj: form.customerCpfCnpj.trim() || undefined,
        },
        boleto: {
          valor,
          dataVencimento: form.dataVencimento,
          descricao: form.descricao.trim() || undefined,
          referenciaExterna: prefill?.referenciaExterna,
          multaValor: form.applyFineInterest ? parseMoney(form.multaValor) : 0,
          jurosPercentual: form.applyFineInterest ? parseMoney(form.jurosPercentual) : 0,
          postalEnabled: form.postalEnabled,
          installmentCount,
        },
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar boleto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 gap-3 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-0">
          <DialogTitle className="text-lg">Nova cobrança</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field id="cob-desc" label="Descrição">
            <Input
              id="cob-desc"
              className="h-9"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field id="cob-valor" label="Valor">
              <Input
                id="cob-valor"
                className="h-9"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
              />
            </Field>
            <Field id="cob-venc" label="Vencimento *">
              <Input
                id="cob-venc"
                type="date"
                className={`h-9 ${!form.dataVencimento ? "border-destructive bg-destructive/5" : ""}`}
                value={form.dataVencimento}
                onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                required
              />
            </Field>
          </div>

          <Field id="cob-nome" label="Nome do cliente *">
            <Input
              id="cob-nome"
              className="h-9"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field id="cob-tel" label="Telefone">
              <Input
                id="cob-tel"
                className="h-9"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              />
            </Field>
            <Field id="cob-cpf" label="CPF/CNPJ">
              <Input
                id="cob-cpf"
                className="h-9"
                value={form.customerCpfCnpj}
                onChange={(e) => setForm((f) => ({ ...f, customerCpfCnpj: e.target.value }))}
              />
            </Field>
          </div>

          <Field id="cob-email" label="Email">
            <Input
              id="cob-email"
              type="email"
              className="h-9"
              value={form.customerEmail}
              onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
            />
          </Field>

          <div className="rounded-md border divide-y px-3 py-1">
            <div className="py-2">
              <OptionRow
                label="Conta a receber no financeiro"
                checked={form.generateFinancial}
                onCheckedChange={(v) => setForm((f) => ({ ...f, generateFinancial: v }))}
              />
            </div>

            <div className="py-2">
              <OptionRow
                label="Juros e multas por atraso"
                checked={form.applyFineInterest}
                onCheckedChange={(v) => setForm((f) => ({ ...f, applyFineInterest: v }))}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Field id="cob-multa" label="Multa (R$)">
                    <Input
                      id="cob-multa"
                      className="h-8"
                      value={form.multaValor}
                      onChange={(e) => setForm((f) => ({ ...f, multaValor: e.target.value }))}
                    />
                  </Field>
                  <Field id="cob-juros" label="Juros (%)">
                    <Input
                      id="cob-juros"
                      className="h-8"
                      value={form.jurosPercentual}
                      onChange={(e) => setForm((f) => ({ ...f, jurosPercentual: e.target.value }))}
                    />
                  </Field>
                </div>
              </OptionRow>
            </div>

            <div className="py-2">
              <OptionRow
                label="Notificações email/SMS"
                hint="Asaas cobra R$0,99 por cobrança"
                checked={form.postalEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, postalEnabled: v }))}
              />
            </div>

            <div className="py-2">
              <OptionRow
                label="Gerar todas as parcelas"
                checked={form.generateInstallments}
                onCheckedChange={(v) => setForm((f) => ({ ...f, generateInstallments: v }))}
              >
                <Field id="cob-parc" label="Qtd. parcelas" className="max-w-[140px]">
                  <Input
                    id="cob-parc"
                    type="number"
                    min={1}
                    max={48}
                    className="h-8"
                    value={form.installmentCount}
                    onChange={(e) => setForm((f) => ({ ...f, installmentCount: e.target.value }))}
                  />
                </Field>
              </OptionRow>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full h-9" disabled={isCreatingBoleto}>
            {isCreatingBoleto ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              "Gerar boleto"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
