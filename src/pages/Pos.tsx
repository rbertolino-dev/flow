import { useCallback, useEffect, useMemo, useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useServices } from "@/hooks/useServices";
import { usePosSales } from "@/hooks/usePosSales";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import type { PosCartItem, PosPaymentLine, PosSale } from "@/types/pos";
import {
  History,
  Plus,
  Search,
  Package,
  Trash2,
  ShoppingCart,
  ScanBarcode,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function stockLabel(qty: number | null | undefined) {
  const n = Number(qty ?? 0);
  if (n < 0) return `Estoque negativo em ${n} Un`;
  if (n === 0) return "Estoque zerado";
  return `Qntd em estoque: ${n} Un`;
}

function stockClass(qty: number | null | undefined) {
  const n = Number(qty ?? 0);
  if (n < 0) return "text-amber-600";
  if (n === 0) return "text-destructive";
  return "text-muted-foreground";
}

interface LeadOption {
  id: string;
  name: string;
  phone: string;
}

export default function Pos() {
  const { activeOrgId } = useActiveOrganization();
  const { products, loading: productsLoading, refetch: refetchProducts } = useProducts();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { loading: posLoading, listSales, finalizeSale, getOpenCashSession, openCash } =
    usePosSales();

  const [catalogTab, setCatalogTab] = useState<"products" | "services">("products");
  const [search, setSearch] = useState("");
  const [exactSearch, setExactSearch] = useState(false);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [addCommission, setAddCommission] = useState(false);
  const [payments, setPayments] = useState<PosPaymentLine[]>([]);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState<string>("");

  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [searchingLeads, setSearchingLeads] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<PosSale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;
    void (async () => {
      const session = await getOpenCashSession();
      if (!session) {
        try {
          await openCash(0);
        } catch {
          // caixa será aberto no finalize se necessário
        }
      }
    })();
  }, [activeOrgId, getOpenCashSession, openCash]);

  useEffect(() => {
    if (!activeOrgId || leadQuery.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingLeads(true);
      try {
        const q = leadQuery.trim();
        const { data } = await supabase
          .from("leads")
          .select("id, name, phone")
          .eq("organization_id", activeOrgId)
          .is("deleted_at", null)
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(8);
        setLeadOptions((data || []) as LeadOption[]);
      } catch {
        setLeadOptions([]);
      } finally {
        setSearchingLeads(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [leadQuery, activeOrgId]);

  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((p) => {
      const hay = `${p.name} ${p.sku || ""} ${p.category || ""}`.toLowerCase();
      if (exactSearch) {
        return (
          p.name.toLowerCase() === q ||
          (p.sku || "").toLowerCase() === q ||
          (p.sku || "").toLowerCase().includes(q)
        );
      }
      return hay.includes(q);
    });
  }, [products, search, exactSearch]);

  const filteredServices = useMemo(() => {
    const active = services.filter((s) => s.is_active);
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((s) => {
      const hay = `${s.name} ${s.category || ""}`.toLowerCase();
      return exactSearch ? s.name.toLowerCase() === q : hay.includes(q);
    });
  }, [services, search, exactSearch]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.quantity * i.unit_price - i.discount_amount, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - discount);
  const paymentsSum = payments.reduce((s, p) => s + p.amount, 0);

  const addProductToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.item_type === "product" && i.item_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `product-${product.id}`,
          item_type: "product",
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || "un",
          quantity: 1,
          unit_price: Number(product.price),
          discount_amount: 0,
          stock_quantity: product.stock_quantity,
        },
      ];
    });
  };

  const addServiceToCart = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.item_type === "service" && i.item_id === service.id);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `service-${service.id}`,
          item_type: "service",
          item_id: service.id,
          name: service.name,
          unit: "un",
          quantity: 1,
          unit_price: Number(service.price),
          discount_amount: 0,
        },
      ];
    });
  };

  const updateCartQty = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.key !== key));
      return;
    }
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)));
  };

  const removeCartItem = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  const addPayment = () => {
    if (!paymentMethodDraft || total <= 0) return;
    const remaining = Math.max(0, total - paymentsSum);
    if (remaining <= 0) return;
    setPayments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: paymentMethodDraft,
        amount: Number(remaining.toFixed(2)),
      },
    ]);
    setPaymentMethodDraft("");
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const resetSale = () => {
    setCart([]);
    setDiscount(0);
    setNotes("");
    setAddCommission(false);
    setPayments([]);
    setSelectedLead(null);
    setLeadQuery("");
    setSearch("");
  };

  const handleFinalizeClick = async () => {
    if (!cart.length || posLoading) return;

    let finalPayments = [...payments];
    if (!finalPayments.length) {
      if (!paymentMethodDraft) return;
      finalPayments = [
        {
          id: crypto.randomUUID(),
          method: paymentMethodDraft,
          amount: Number(total.toFixed(2)),
        },
      ];
    } else if (Math.abs(paymentsSum - total) > 0.05) {
      if (!paymentMethodDraft) return;
      finalPayments.push({
        id: crypto.randomUUID(),
        method: paymentMethodDraft,
        amount: Number((total - paymentsSum).toFixed(2)),
      });
    }

    try {
      await finalizeSale({
        items: cart.map((i) => ({
          item_type: i.item_type,
          item_id: i.item_id,
          name: i.name,
          sku: i.sku,
          unit: i.unit,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
        })),
        payments: finalPayments.map((p) => ({ method: p.method, amount: p.amount })),
        discount_amount: discount,
        notes: notes || null,
        add_commission: addCommission,
        lead_id: selectedLead?.id || null,
        customer_name: selectedLead?.name || null,
        customer_phone: selectedLead?.phone || null,
      });
      resetSale();
      await refetchProducts();
    } catch {
      // toast já exibido no hook
    }
  };

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await listSales({ limit: 50 });
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [listSales]);

  const canFinalize =
    cart.length > 0 &&
    total >= 0 &&
    (payments.length > 0 || !!paymentMethodDraft) &&
    !posLoading;

  return (
    <CRMLayout activeView="pdv" onViewChange={() => {}}>
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => void openHistory()}>
            <History className="mr-2 h-4 w-4" />
            Histórico de vendas
          </Button>

          <div className="relative flex min-w-[240px] max-w-md flex-1 items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Contato</span>
            <div className="relative flex-1">
              <Input
                placeholder="Buscar cliente..."
                value={selectedLead ? selectedLead.name : leadQuery}
                onChange={(e) => {
                  setSelectedLead(null);
                  setLeadQuery(e.target.value);
                }}
                className="pr-8"
              />
              {selectedLead && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedLead(null);
                    setLeadQuery("");
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {!selectedLead && leadOptions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {leadOptions.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setSelectedLead(lead);
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
              {searchingLeads && (
                <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              title="Novo contato (vá ao CRM)"
              onClick={() => window.open("/crm", "_blank")}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_380px]">
          {/* Catalog */}
          <div className="flex min-h-0 flex-col border-r">
            <Tabs
              value={catalogTab}
              onValueChange={(v) => setCatalogTab(v as "products" | "services")}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b px-4 pt-3">
                <TabsList>
                  <TabsTrigger value="products">Produtos</TabsTrigger>
                  <TabsTrigger value="services">Serviços</TabsTrigger>
                </TabsList>
                <div className="mt-3 flex flex-wrap items-center gap-2 pb-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Busque por nome, código ou descrição"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant={exactSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExactSearch((v) => !v)}
                  >
                    Busca Exata
                  </Button>
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              <TabsContent value="products" className="mt-0 min-h-0 flex-1 overflow-y-auto p-0">
                {productsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                ) : (
                  <ul className="divide-y">
                    {filteredProducts.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50"
                          onClick={() => addProductToCart(p.id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium leading-snug">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Código: {p.sku || "—"}
                            </p>
                            <p className={cn("text-xs", stockClass(p.stock_quantity))}>
                              {stockLabel(p.stock_quantity)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-primary">
                            {formatMoney(Number(p.price))} {p.unit || "Un"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="services" className="mt-0 min-h-0 flex-1 overflow-y-auto p-0">
                {servicesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredServices.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhum serviço encontrado.</p>
                ) : (
                  <ul className="divide-y">
                    {filteredServices.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50"
                          onClick={() => addServiceToCart(s.id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            {s.category && (
                              <p className="text-xs text-muted-foreground">{s.category}</p>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-primary">
                            {formatMoney(Number(s.price))} Un
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Summary */}
          <div className="flex min-h-0 flex-col bg-muted/20">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-semibold">Resumo</h2>
              <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3 p-4">
              <div className="rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                <div className="flex justify-between text-sm opacity-90">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm opacity-90">
                  <span>Desconto</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 w-24 border-primary-foreground/30 bg-primary-foreground/10 text-right text-primary-foreground"
                  />
                </div>
                <div className="mt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>

              <Button
                variant="secondary"
                className="w-full bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Itens Inventário {cart.length}
              </Button>

              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span>
                      {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{formatMoney(p.amount)}</span>
                      <button type="button" onClick={() => removePayment(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select value={paymentMethodDraft} onValueChange={setPaymentMethodDraft}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicione uma ou mais formas de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addPayment}
                    disabled={!paymentMethodDraft || total - paymentsSum <= 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Textarea
                placeholder="Observações"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />

              <div className="flex items-center justify-between">
                <Label htmlFor="add-commission">Adicionar comissão</Label>
                <Switch
                  id="add-commission"
                  checked={addCommission}
                  onCheckedChange={setAddCommission}
                />
              </div>
            </div>

            <div className="mt-auto border-t p-4">
              <Button
                className="w-full"
                size="lg"
                disabled={!canFinalize}
                onClick={() => void handleFinalizeClick()}
              >
                {posLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  "Finalizar"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Itens da venda ({cart.length})</DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item no carrinho.</p>
          ) : (
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
              {cart.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-2 border-b pb-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(item.unit_price)} / {item.unit || "un"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        type="number"
                        min={0.001}
                        step="1"
                        className="h-8 w-20"
                        value={item.quantity}
                        onChange={(e) =>
                          updateCartQty(item.key, Number(e.target.value) || 0)
                        }
                      />
                      <span className="text-sm font-medium">
                        {formatMoney(item.quantity * item.unit_price - item.discount_amount)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCartItem(item.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button onClick={() => setCartOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de vendas</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
          ) : (
            <ul data-testid="pdv-sales-history" className="max-h-[60vh] divide-y overflow-y-auto">
              {history.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      #{sale.sale_number}
                      {sale.customer_name ? ` — ${sale.customer_name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleString("pt-BR")}
                      {sale.sold_by_name ? ` · ${sale.sold_by_name}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold">{formatMoney(Number(sale.total))}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
