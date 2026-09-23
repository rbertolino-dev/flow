import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePosSales } from "@/hooks/usePosSales";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_POS_SETTINGS,
  type PosPaymentDiscount,
  type PosSettings,
} from "@/types/pos";
import { POS_DISCOUNT_PAYMENT_METHODS } from "@/lib/paymentMethods";
import { ArrowLeft, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadOption {
  id: string;
  name: string;
  phone: string;
  company?: string | null;
}

export default function PosSettings() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const { getPosSettings, savePosSettings } = usePosSales();
  const [form, setForm] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [section, setSection] = useState<"vendas" | "descontos">("vendas");
  const [discountMethod, setDiscountMethod] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPosSettings()
      .then((settings) => {
        if (!cancelled) setForm(settings);
      })
      .catch(() => {
        if (!cancelled) setForm(DEFAULT_POS_SETTINGS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getPosSettings]);

  useEffect(() => {
    if (!activeOrgId || leadQuery.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const q = leadQuery.trim();
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, company")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setLeadOptions((data || []) as LeadOption[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadQuery, activeOrgId]);

  const set = <K extends keyof PosSettings>(key: K, value: PosSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (next: PosSettings = form) => {
    setSaving(true);
    try {
      const saved = await savePosSettings(next);
      setForm(saved);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addPaymentDiscount = () => {
    const percent = Number(discountPercent.replace(",", "."));
    if (!discountMethod || !(percent > 0) || percent > 100) {
      toast({
        title: "Informe a forma e o desconto",
        description: "O desconto é um percentual entre 0 e 100.",
        variant: "destructive",
      });
      return;
    }
    const payment_discounts = [
      ...form.payment_discounts.filter((item) => item.method !== discountMethod),
      { method: discountMethod, percent },
    ];
    const next = { ...form, payment_discounts };
    setForm(next);
    setDiscountMethod("");
    setDiscountPercent("");
    void save(next);
  };

  const removePaymentDiscount = (method: string) => {
    const next = {
      ...form,
      payment_discounts: form.payment_discounts.filter((item) => item.method !== method),
    };
    setForm(next);
    void save(next);
  };

  const discountLabel = (method: string) =>
    POS_DISCOUNT_PAYMENT_METHODS.find((item) => item.value === method)?.label || method;

  return (
    <CRMLayout activeView="pdv" onViewChange={() => {}}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/pdv")} aria-label="Voltar ao PDV">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Configuração de Venda</h1>
            <p className="text-sm text-muted-foreground">
              Estas opções ficam salvas e mudam o comportamento do PDV.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex min-h-[520px] overflow-hidden rounded-lg border bg-card shadow-sm">
            <nav className="flex w-44 shrink-0 flex-col gap-1 border-r bg-muted/40 p-3">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm",
                  section === "vendas" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/70"
                )}
                onClick={() => setSection("vendas")}
              >
                Vendas
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm",
                  section === "descontos" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/70"
                )}
                onClick={() => setSection("descontos")}
              >
                Descontos
              </button>
            </nav>

            {section === "descontos" ? (
              <div className="min-w-0 flex-1 p-4 md:p-6">
                <h2 className="text-xl font-semibold">Desconto por Forma de Pagamento</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adicione descontos fixos por forma de pagamento
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Select value={discountMethod || undefined} onValueChange={setDiscountMethod}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {POS_DISCOUNT_PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-[120px]"
                    placeholder="Desconto"
                    inputMode="decimal"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                  <Button
                    type="button"
                    className="bg-blue-700 text-white hover:bg-blue-800"
                    disabled={saving}
                    onClick={addPaymentDiscount}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="mt-4 divide-y rounded-md border">
                  {form.payment_discounts.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-muted-foreground">
                      Nenhum desconto cadastrado.
                    </p>
                  ) : (
                    form.payment_discounts.map((item) => (
                      <PaymentDiscountRow
                        key={item.method}
                        item={item}
                        label={discountLabel(item.method)}
                        onRemove={() => removePaymentDiscount(item.method)}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : (
          <div className="min-w-0 flex-1 space-y-6 p-4 md:p-6">
            <SettingRow
              title="Observações da Venda"
              description="Texto que já vem preenchido nas observações de cada venda nova."
            >
              <Textarea
                placeholder="Digite"
                value={form.sale_notes}
                onChange={(e) => set("sale_notes", e.target.value)}
                rows={2}
              />
            </SettingRow>

            <SettingRow
              title="Conta Financeira"
              description="Conta usada no confirmar venda. Não há um plano de contas separado, então o nome fica salvo aqui."
            >
              <Input
                placeholder="Ex.: Conta principal"
                value={form.financial_account}
                onChange={(e) => set("financial_account", e.target.value)}
              />
            </SettingRow>

            <SettingRow
              title="Categoria Financeira"
              description="Categoria sugerida no lançamento da venda."
            >
              <Select
                value={form.financial_category || "__none__"}
                onValueChange={(value) => set("financial_category", value === "__none__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              title="Cliente Padrão"
              description="Este cliente já entra selecionado ao abrir o PDV."
            >
              <div className="relative">
                <Input
                  placeholder="Buscar contato"
                  value={form.default_lead_id ? form.default_lead_name || "" : leadQuery}
                  onChange={(e) => {
                    set("default_lead_id", null);
                    set("default_lead_name", null);
                    setLeadQuery(e.target.value);
                  }}
                  className="pr-8"
                />
                {form.default_lead_id && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => {
                      set("default_lead_id", null);
                      set("default_lead_name", null);
                      setLeadQuery("");
                    }}
                    aria-label="Remover cliente padrão"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!form.default_lead_id && leadOptions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {leadOptions.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          set("default_lead_id", lead.id);
                          set("default_lead_name", lead.name);
                          setLeadQuery("");
                          setLeadOptions([]);
                        }}
                      >
                        <span className="font-medium">{lead.name}</span>
                        <span className="text-xs text-muted-foreground">{lead.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </SettingRow>

            <SettingRow
              title="Venda Simples"
              description="Finalizar a venda direto, sem a tela de confirmar. Estoque e financeiro seguem o padrão já usados nessa confirmação."
            >
              <Switch checked={form.simple_sale} onCheckedChange={(value) => set("simple_sale", value)} />
            </SettingRow>

            <SettingRow
              title="Comissão de Venda Obrigatória"
              description="O PDV exige escolher o colaborador da comissão antes de finalizar."
            >
              <Switch
                checked={form.commission_required}
                onCheckedChange={(value) => set("commission_required", value)}
              />
            </SettingRow>

            <SettingRow
              title="Registro de Meio de Pagamento"
              description="Mostra as formas de pagamento no resumo da venda."
            >
              <Switch
                checked={form.show_payment_method}
                onCheckedChange={(value) => set("show_payment_method", value)}
              />
            </SettingRow>

            <SettingRow
              title="Comissão de Venda Padrão"
              description="Percentual ou valor fixo usado quando o produto não tem comissão própria."
            >
              <div className="flex gap-2">
                <Select
                  value={form.commission_type}
                  onValueChange={(value) => set("commission_type", value === "fixed" ? "fixed" : "percent")}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentagem</SelectItem>
                    <SelectItem value="fixed">Valor</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Digite"
                  value={form.commission_value || ""}
                  onChange={(e) => set("commission_value", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </SettingRow>

            <SettingRow
              title="Código do Estoque Padrão"
              description="Campo exibido como código do produto e usado primeiro na leitura do código de barras."
            >
              <Select
                value={form.stock_code_field}
                onValueChange={(value) => set("stock_code_field", value === "barcode" ? "barcode" : "sku")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sku">Código interno</SelectItem>
                  <SelectItem value="barcode">Código de barras</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              title="Bloqueio de Produtos Em Falta"
              description="Produtos com estoque zero ou negativo deixam de aparecer na lista do PDV."
            >
              <Switch
                checked={form.block_out_of_stock}
                onCheckedChange={(value) => set("block_out_of_stock", value)}
              />
            </SettingRow>

            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={saving || !activeOrgId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
            )}
          </div>
        )}
      </div>
    </CRMLayout>
  );
}

function PaymentDiscountRow({
  item,
  label,
  onRemove,
}: {
  item: PosPaymentDiscount;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_72px_40px] items-center gap-2 bg-slate-50 px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground">À vista</span>
      <span className="text-right tabular-nums">{Number(item.percent)}%</span>
      <button type="button" onClick={onRemove} aria-label={`Remover desconto de ${label}`}>
        <Trash2 className="ml-auto h-4 w-4 text-red-600" />
      </button>
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-start gap-3 border-b pb-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,360px)]">
      <div>
        <Label className="text-base font-semibold">{title}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
