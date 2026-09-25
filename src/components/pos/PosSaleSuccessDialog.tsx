import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, ClipboardList, FileText, Loader2, Plus, Printer } from "lucide-react";
import type { FinalizeSaleResult, PosCartItem, PosPaymentLine } from "@/types/pos";
import { printPosA4, printPosCupom, type PosPrintOrgInfo } from "@/lib/posPrint";
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ServiceOrder, ServiceOrderCloseData, ServiceOrderFormData } from "@/types/serviceOrder";
import { ServiceOrderDetailDialog } from "@/components/service-orders/ServiceOrderDetailDialog";
import { ServiceOrderCloseDialog } from "@/components/service-orders/ServiceOrderCloseDialog";
import { CreateServiceOrderDialog } from "@/components/service-orders/CreateServiceOrderDialog";
import { useServiceOrderStatuses, useServiceOrderTemplates } from "@/hooks/useServiceOrderTemplates";
import { useProducts } from "@/hooks/useProducts";
import { useLeads } from "@/hooks/useLeads";
import {
  downloadServiceOrderPDF,
  generateServiceOrderPDF,
  openServiceOrderPDF,
} from "@/lib/serviceOrderPdfGenerator";

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

const ORDER_SELECT = `
  *,
  status:service_order_statuses(*),
  template:service_order_templates(
    id, name, is_default,
    fields:service_order_template_fields(*)
  ),
  lead:leads(id, name, phone, email, company),
  items:service_order_items(*),
  checklist:service_order_checklist_items(*)
`;

async function fetchServiceOrder(id: string, organizationId: string): Promise<ServiceOrder | null> {
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data, error } = await supabase
    .from("service_orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ServiceOrder;
}

function PosOpenedServiceOrder({
  order,
  open,
  organizationName,
  onOpenChange,
  onOrderChange,
}: {
  order: ServiceOrder;
  open: boolean;
  organizationName?: string;
  onOpenChange: (open: boolean) => void;
  onOrderChange: (order: ServiceOrder | null) => void;
}) {
  const { toast } = useToast();
  const { activeOrgId, activeOrganization } = useActiveOrganization();
  const { updateOrder, deleteOrder, duplicateOrder, closeOrder } = useServiceOrders(undefined, {
    enabled: false,
  });
  const [exporting, setExporting] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  const refresh = async (id: string) => {
    if (!activeOrgId) return;
    const full = await fetchServiceOrder(id, activeOrgId);
    if (full) onOrderChange(full);
  };

  const exportPdf = async (current: ServiceOrder, mode: "full" | "no_values") => {
    setExporting(true);
    try {
      const blob = await generateServiceOrderPDF({
        order: current,
        mode,
        organizationName: organizationName || activeOrganization?.name,
        organizationData: activeOrganization ? { name: activeOrganization.name } : null,
      });
      openServiceOrderPDF(blob);
      const suffix = mode === "no_values" ? "-sem-valores" : "";
      downloadServiceOrderPDF(blob, `${current.code}${suffix}`);
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível gerar o PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ServiceOrderDetailDialog
        open={open && !editing}
        onOpenChange={onOpenChange}
        order={order}
        exporting={exporting}
        onEdit={() => setEditing(true)}
        onCloseOrder={() => setShowClose(true)}
        onDelete={() => setShowDelete(true)}
        onCopy={(current) => {
          void (async () => {
            const copy = await duplicateOrder(current);
            if (!copy || !activeOrgId) return;
            const full = (await fetchServiceOrder(copy.id, activeOrgId)) || (copy as ServiceOrder);
            onOrderChange(full);
            toast({ title: "OS copiada", description: `Nova ordem ${full.code} criada.` });
          })();
        }}
        onExportPdf={(current, mode) => void exportPdf(current, mode)}
      />

      {editing ? (
        <PosServiceOrderEditor
          order={order}
          onOpenChange={(next) => {
            if (!next) setEditing(false);
          }}
          onSaved={async () => {
            setEditing(false);
            await refresh(order.id);
          }}
        />
      ) : null}

      {activeOrgId ? (
        <ServiceOrderCloseDialog
          open={showClose}
          onOpenChange={setShowClose}
          order={order}
          organizationId={activeOrgId}
          onClosed={async (data: ServiceOrderCloseData) => {
            const ok = await closeOrder(order.id, data);
            if (ok) {
              setShowClose(false);
              await refresh(order.id);
            }
            return ok;
          }}
        />
      ) : null}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem {order.code} será excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void (async () => {
                  const ok = await deleteOrder(order.id);
                  if (!ok) return;
                  setShowDelete(false);
                  onOpenChange(false);
                  onOrderChange(null);
                })();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PosServiceOrderEditor({
  order,
  onOpenChange,
  onSaved,
}: {
  order: ServiceOrder;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { statuses } = useServiceOrderStatuses();
  const { templates } = useServiceOrderTemplates();
  const { products } = useProducts();
  const { leads } = useLeads();
  const { updateOrder } = useServiceOrders(undefined, { enabled: false });

  return (
    <CreateServiceOrderDialog
      open
      onOpenChange={onOpenChange}
      templates={templates}
      statuses={statuses}
      products={products}
      leads={leads || []}
      nextCode={order.code}
      editingOrder={order}
      onSubmit={async (data: ServiceOrderFormData) => {
        const ok = await updateOrder(order.id, {
          ...data,
          template_id: data.template_id || order.template_id || undefined,
          status_id: data.status_id || order.status_id || undefined,
        });
        if (ok) await onSaved();
        return !!ok;
      }}
    />
  );
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
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { createOrder } = useServiceOrders(undefined, { enabled: false });
  const [creatingOs, setCreatingOs] = useState(false);
  const [createdOs, setCreatedOs] = useState<{ id: string; code: string } | null>(null);
  const [detailOrder, setDetailOrder] = useState<ServiceOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setCreatedOs(null);
    setDetailOrder(null);
    setDetailOpen(false);
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

  const showOrder = async (orderId: string, fallback?: ServiceOrder) => {
    if (activeOrgId) {
      const full = await fetchServiceOrder(orderId, activeOrgId);
      if (full) {
        setDetailOrder(full);
        setDetailOpen(true);
        return;
      }
    }
    if (fallback) {
      setDetailOrder(fallback);
      setDetailOpen(true);
    }
  };

  const openServiceOrder = async () => {
    if (createdOs) {
      await showOrder(createdOs.id, detailOrder || undefined);
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

      const mappedItems = services.map((item) => ({
        item_type: "service" as const,
        item_id: item.item_id,
        name: item.name,
        sku: item.sku || null,
        unit: item.unit || "un",
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        total_price: lineTotal(item),
      }));

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
        items: mappedItems,
      });
      if (!order) return;
      setCreatedOs({ id: order.id, code: order.code });
      await showOrder(order.id, { ...order, items: mappedItems });
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-hidden border-0 p-0 sm:rounded-xl [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader className="bg-slate-800 px-6 py-4 pr-12">
            <DialogTitle className="text-center text-base font-semibold tracking-wide text-white">
              Venda #{sale.sale_number}
            </DialogTitle>
          </DialogHeader>

          <div className="border-b bg-background px-6 py-4">
            <Button
              className="h-16 w-full bg-orange-500 text-xl font-semibold text-white hover:bg-orange-600"
              onClick={onNewSale}
            >
              <Plus className="mr-2 h-6 w-6" />
              Nova venda
            </Button>
          </div>

          <div className="max-h-[calc(92vh-10.5rem)] space-y-5 overflow-y-auto bg-background px-6 py-6">
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

            <div className="grid gap-2 sm:grid-cols-2">
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

      {detailOrder ? (
        <PosOpenedServiceOrder
          order={detailOrder}
          open={detailOpen}
          organizationName={organizationName}
          onOpenChange={setDetailOpen}
          onOrderChange={setDetailOrder}
        />
      ) : null}
    </>
  );
}
