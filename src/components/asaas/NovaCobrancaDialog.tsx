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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cob-desc">Descrição</Label>
            <Input
              id="cob-desc"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cob-valor">Valor</Label>
            <Input
              id="cob-valor"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cob-nome">Nome do cliente</Label>
            <Input
              id="cob-nome"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cob-tel">Telefone</Label>
              <Input
                id="cob-tel"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cob-email">Email</Label>
              <Input
                id="cob-email"
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cob-cpf">CPF/CNPJ</Label>
            <Input
              id="cob-cpf"
              value={form.customerCpfCnpj}
              onChange={(e) => setForm((f) => ({ ...f, customerCpfCnpj: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cob-venc">Vencimento</Label>
            <Input
              id="cob-venc"
              type="date"
              value={form.dataVencimento}
              onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
              className={!form.dataVencimento ? "border-destructive bg-destructive/5" : ""}
              required
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Criar conta a receber no financeiro</p>
              <p className="text-xs text-muted-foreground">Lança automaticamente no módulo Financeiro</p>
            </div>
            <Switch
              checked={form.generateFinancial}
              onCheckedChange={(v) => setForm((f) => ({ ...f, generateFinancial: v }))}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Aplicar juros e multas por atraso</p>
              </div>
              <Switch
                checked={form.applyFineInterest}
                onCheckedChange={(v) => setForm((f) => ({ ...f, applyFineInterest: v }))}
              />
            </div>
            {form.applyFineInterest && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cob-multa">Multa em R$</Label>
                  <Input
                    id="cob-multa"
                    value={form.multaValor}
                    onChange={(e) => setForm((f) => ({ ...f, multaValor: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cob-juros">Juros (valor em %)</Label>
                  <Input
                    id="cob-juros"
                    value={form.jurosPercentual}
                    onChange={(e) => setForm((f) => ({ ...f, jurosPercentual: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativar notificações por email e SMS</p>
              <p className="text-xs text-muted-foreground">
                (custo cobrado pelo Asaas de R$0,99 por cobrança)
              </p>
            </div>
            <Switch
              checked={form.postalEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, postalEnabled: v }))}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Gerar boleto de todas as parcelas</p>
              <Switch
                checked={form.generateInstallments}
                onCheckedChange={(v) => setForm((f) => ({ ...f, generateInstallments: v }))}
              />
            </div>
            {form.generateInstallments && (
              <div className="space-y-1">
                <Label htmlFor="cob-parc">Quantidade de parcelas</Label>
                <Input
                  id="cob-parc"
                  type="number"
                  min={1}
                  max={48}
                  value={form.installmentCount}
                  onChange={(e) => setForm((f) => ({ ...f, installmentCount: e.target.value }))}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isCreatingBoleto}>
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
