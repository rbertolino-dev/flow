import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, ClipboardList, FileText, Loader2, Plus, Printer } from "lucide-react";
import type { FinalizeSaleResult, PosCartItem, PosPaymentLine } from "@/types/pos";
import { printPosA4, printPosCupom, type PosPrintOrgInfo } from "@/lib/posPrint";
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: FinalizeSaleResult | null;
  items: PosCartItem[];
  payments: PosPaymentLine[];
  organizationName?: string;
  organization?: PosPrintOrgInfo;
  leadId?: string | null;
  onNewSale: () => void;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lineTotal(item: PosCartItem) {
  return Math.max(0, item.quantity * item.unit_price - item.discount_amount);
}

export function PosSaleSuccessDialog({
  open,
  onOpenChange,
  sale,
  items,
  payments,
  organizationName,
  organization,
  leadId,
  onNewSale,
}: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { createOrder } = useServiceOrders(undefined, { enabled: false });
  const [creatingOs, setCreatingOs] = useState(false);
  const [createdOs, setCreatedOs] = useState<{ id: string; code: string } | null>(null);

  useEffect(() => {
    setCreatedOs(null);
  }, [sale?.id]);

  if (!sale) return null;

  const services = items.filter((item) => item.item_type === "service");
  const printPayload = {
    sale: {
      ...sale,
      sold_at: sale.sold_at || new Date().toISOString(),
    },
    items,
    payments,
    organizationName,
    organization: organization || { name: organizationName },
  };

  const openServiceOrder = async () => {
    if (createdOs) {
      navigate("/service-orders", { state: { openOrderId: createdOs.id } });
      return;
    }
    if (!services.length) return;
    setCreatingOs(true);
    try {
      let statusId: string | undefined;
      let templateId: string | undefined;
      if (activeOrgId) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const statusResult = await supabase
          .from("service_order_statuses")
          .select("id, is_default, sort_order")
          .eq("organization_id", activeOrgId)
          .order("sort_order", { ascending: true });
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const templateResult = await supabase
          .from("service_order_templates")
          .select("id, is_default")
          .eq("organization_id", activeOrgId)
          .eq("is_active", true);
        const statuses = (statusResult.data || []) as Array<{ id: string; is_default?: boolean }>;
        const templates = (templateResult.data || []) as Array<{ id: string; is_default?: boolean }>;
        statusId = (statuses.find((item) => item.is_default) || statuses[0])?.id;
        templateId = (templates.find((item) => item.is_default) || templates[0])?.id;
      }

      const order = await createOrder({
        template_id: templateId,
        status_id: statusId,
        lead_id: leadId || undefined,
        client_name: sale.customer_name || undefined,
        client_phone: sale.customer_phone || undefined,
        service_id: services[0]?.item_id,
        service_name: services.map((item) => item.name).join(", "),
        is_single_day: true,
        client_report: `Serviço vendido no PDV, venda #${sale.sale_number}.`,
        items: services.map((item) => ({
          item_type: "service",
          item_id: item.item_id,
          name: item.name,
          sku: item.sku || null,
          unit: item.unit || "un",
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          total_price: lineTotal(item),
        })),
      });
      if (!order) return;
      setCreatedOs({ id: order.id, code: order.code });
      navigate("/service-orders", { state: { openOrderId: order.id } });
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível abrir a ordem de serviço",
        variant: "destructive",
      });
    } finally {
      setCreatingOs(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-hidden border-0 p-0 sm:rounded-xl [&>button]:text-white [&>button]:hover:text-white">
        <DialogHeader className="bg-slate-800 px-6 py-4 pr-12">
          <DialogTitle className="text-center text-base font-semibold tracking-wide text-white">
            Venda #{sale.sale_number}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(92vh-4.5rem)] space-y-5 overflow-y-auto bg-background px-6 py-6">
          <div className="rounded-2xl bg-emerald-600 px-6 py-8 text-center text-white">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12" />
            <p className="text-3xl font-bold tracking-wide">VENDA FINALIZADA!</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{money(Number(sale.total))}</p>
            {sale.customer_name ? (
              <p className="mt-2 text-sm text-white/90">{sale.customer_name}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border bg-card">
              <h3 className="border-b px-4 py-3 text-sm font-semibold text-slate-700">Itens</h3>
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.key} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug text-slate-900">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.item_type === "service" ? "Serviço" : "Produto"} · {item.quantity} ×{" "}
                        {money(item.unit_price)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{money(lineTotal(item))}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border bg-card">
              <h3 className="border-b px-4 py-3 text-sm font-semibold text-slate-700">Pagamento</h3>
              <ul className="divide-y">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span>{getPaymentMethodLabel(payment.method as PaymentMethod)}</span>
                    <span className="font-medium tabular-nums">{money(payment.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(Number(sale.total))}</span>
              </div>
            </section>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={onNewSale}>
              <Plus className="mr-2 h-4 w-4" />
              Nova venda
            </Button>
            <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => printPosCupom(printPayload)}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir cupom
            </Button>
            <Button variant="outline" onClick={() => printPosA4(printPayload)}>
              <FileText className="mr-2 h-4 w-4" />
              Imprimir comprovante A4
            </Button>
          </div>

          {services.length > 0 ? (
            <Button
              className="h-12 w-full bg-blue-700 text-base text-white hover:bg-blue-800"
              disabled={creatingOs}
              onClick={() => void openServiceOrder()}
            >
              {creatingOs ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ClipboardList className="mr-2 h-4 w-4" />
              )}
              {createdOs ? `Abrir ordem de serviço ${createdOs.code}` : "Ordem de serviço"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
