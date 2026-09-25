import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { paymentsMatchTotal, roundMoney } from "@/lib/posFinanceSchedule";
import type { PosSaleItem } from "@/types/pos";
import type { Service } from "@/types/budget-module";

export type PosReturnPayload = {
  sale_id: string;
  returned_items: Array<{ item_id: string; quantity: number }>;
  replacement_items: Array<{
    item_type: "product" | "service";
    item_id: string | null;
    name: string;
    sku?: string | null;
    unit?: string | null;
    quantity: number;
    unit_price: number;
  }>;
  settlement_method: string;
  settle_now: boolean;
};

type Props = {
  open: boolean;
  saleId: string;
  items: PosSaleItem[];
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: PosReturnPayload) => void;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PosReturnExchangeDialog({
  open,
  saleId,
  items,
  loading,
  onOpenChange,
  onConfirm,
}: Props) {
  const { products } = useProducts({ enabled: open });
  const { activeOrgId } = useActiveOrganization();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [replacementId, setReplacementId] = useState("");
  const [replacementQty, setReplacementQty] = useState("1");
  const [method, setMethod] = useState("dinheiro");
  const [settleNow, setSettleNow] = useState(true);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const item of items) next[item.id] = "0";
    setQty(next);
    setReplacementId("");
    setReplacementQty("1");
    setMethod("dinheiro");
    setSettleNow(true);
    // Reinicia só ao abrir. Não depende da identidade da lista, senão a digitação volta a zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saleId]);

  useEffect(() => {
    if (!open || !activeOrgId) return;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-services?active_only=true`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
      });
      if (!response.ok) return;
      const body = await response.json();
      setServices((body?.data || []) as Service[]);
    };
    void load();
  }, [open, activeOrgId]);

  const returnedAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Math.max(0, Number(qty[item.id] || 0));
      return sum + Math.min(quantity, Number(item.quantity)) * Number(item.unit_price);
    }, 0);
  }, [items, qty]);

  const replacement = useMemo(() => {
    if (!replacementId) return null;
    const [kind, id] = replacementId.split(":");
    if (kind === "product") {
      const product = products.find((item) => item.id === id);
      if (!product) return null;
      return {
        item_type: "product" as const,
        item_id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        unit_price: Number(product.price),
      };
    }
    const service = services.find((item) => item.id === id);
    if (!service) return null;
    return {
      item_type: "service" as const,
      item_id: service.id,
      name: service.name,
      sku: null,
      unit: "un",
      unit_price: Number(service.price || 0),
    };
  }, [replacementId, products, services]);

  const replacementQuantity = Math.max(0, Number(replacementQty) || 0);
  const replacementAmount = replacement ? roundMoney(replacement.unit_price * replacementQuantity) : 0;
  const difference = roundMoney(replacementAmount - returnedAmount);
  const needsSettlement = Math.abs(difference) > 0.01;
  const canConfirm = returnedAmount > 0.009 && (!replacement || replacementQuantity > 0) && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolução ou troca</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
              <span>{item.name}</span>
              <span className="text-muted-foreground">de {Number(item.quantity)}</span>
              <Input
                className="w-24"
                inputMode="decimal"
                aria-label={`Quantidade a devolver de ${item.name}`}
                value={qty[item.id] || "0"}
                onChange={(event) => setQty((current) => ({ ...current, [item.id]: event.target.value }))}
              />
            </div>
          ))}
          <p className="text-sm">Valor devolvido: {money(returnedAmount)}</p>
          <div className="space-y-1">
            <Label>Incluir na troca</Label>
            <Select value={replacementId || "none"} onValueChange={(value) => setReplacementId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Somente devolução" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Somente devolução</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={`product:${product.id}`}>
                    {product.name}
                  </SelectItem>
                ))}
                {services.map((service) => (
                  <SelectItem key={service.id} value={`service:${service.id}`}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {replacement ? (
            <div className="space-y-1">
              <Label>Quantidade nova</Label>
              <Input value={replacementQty} onChange={(event) => setReplacementQty(event.target.value)} className="w-24" />
              <p className="text-sm text-muted-foreground">Novo valor: {money(replacementAmount)}</p>
            </div>
          ) : null}
          {needsSettlement ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm">
                {difference < 0
                  ? `Diferença a devolver: ${money(Math.abs(difference))}`
                  : `Diferença a receber: ${money(difference)}`}
              </p>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label="Forma da diferença">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={settleNow} onCheckedChange={setSettleNow} id="settle-now" />
                <Label htmlFor="settle-now">{difference < 0 ? "Pagar agora" : "Receber agora"}</Label>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            disabled={!canConfirm || (needsSettlement && !paymentsMatchTotal(Math.abs(difference), Math.abs(difference)))}
            onClick={() => {
              const returned = items
                .map((item) => ({
                  item_id: item.id,
                  quantity: Math.min(Number(item.quantity), Math.max(0, Number(qty[item.id] || 0))),
                }))
                .filter((item) => item.quantity > 0);
              onConfirm({
                sale_id: saleId,
                returned_items: returned,
                replacement_items: replacement && replacementQuantity > 0
                  ? [{ ...replacement, quantity: replacementQuantity }]
                  : [],
                settlement_method: method,
                settle_now: settleNow,
              });
            }}
          >
            {loading ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
