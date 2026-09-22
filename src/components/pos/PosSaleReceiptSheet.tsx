import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePosSales } from "@/hooks/usePosSales";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { printPosA4, printPosCupom } from "@/lib/posPrint";
import type { PosCartItem, PosSale, PosSaleItem } from "@/types/pos";
import { Loader2, Pencil, Printer, FileText } from "lucide-react";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTimeShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} - ${hh}:${mi}`;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function paymentLabel(method: string): string {
  try {
    return getPaymentMethodLabel(method as PaymentMethod);
  } catch {
    return method;
  }
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700">
      {title}
    </div>
  );
}

function printRomaneio(
  sale: PosSale,
  type: "entrega" | "montagem"
) {
  const title =
    type === "entrega" ? "Romaneio de Entrega" : "Romaneio de Montagem";
  const items = sale.items || [];
  const rows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd">${i.name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${Number(i.quantity)}x</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${formatMoney(Number(i.unit_price))}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${formatMoney(Number(i.total_price))}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>${title} — #${sale.sale_number}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; border-bottom: 2px solid #333; padding: 6px 8px; }
    .total { margin-top: 16px; font-size: 15px; font-weight: bold; }
    .sign { margin-top: 48px; display: flex; gap: 48px; }
    .sign div { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; text-align: center; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    Venda #${sale.sale_number}<br/>
    Cliente: ${sale.customer_name || "—"}<br/>
    Data: ${formatDateTimeShort(sale.sold_at || sale.created_at)}<br/>
    Responsável: ${sale.sold_by_name || "—"}
    ${sale.notes ? `<br/>Obs.: ${sale.notes}` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qtd</th>
        <th style="text-align:right">Unit.</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: ${formatMoney(Number(sale.total))}</div>
  <div class="sign">
    <div>Assinatura do responsável</div>
    <div>Assinatura do cliente</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function saleToPrintPayload(
  sale: PosSale,
  organization?: { name?: string | null; cnpj?: string | null; address?: string | null }
) {
  const items: PosCartItem[] = (sale.items || []).map((i: PosSaleItem) => ({
    key: i.id,
    item_type: i.item_type,
    item_id: i.item_id || i.id,
    name: i.name,
    sku: i.sku,
    unit: i.unit,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    discount_amount: Number(i.discount_amount || 0),
  }));
  const payments = (sale.payments || []).map((p) => ({
    id: p.id,
    method: p.method,
    amount: Number(p.amount),
  }));
  return {
    sale: {
      id: sale.id,
      sale_number: Number(sale.sale_number),
      total: Number(sale.total),
      subtotal: Number(sale.subtotal),
      discount_amount: Number(sale.discount_amount || 0),
      commission_amount: Number(sale.commission_amount || 0),
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      sold_at: sale.sold_at || sale.created_at,
      sold_by_name: sale.sold_by_name,
      notes: sale.notes,
    },
    items,
    payments,
    organizationName: organization?.name || undefined,
    organization,
  };
}

interface PosSaleReceiptSheetProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function PosSaleReceiptSheet({
  saleId,
  open,
  onOpenChange,
  onChanged,
}: PosSaleReceiptSheetProps) {
  const { toast } = useToast();
  const { activeOrgId, activeOrganization } = useActiveOrganization();
  const { getSale, updateSale, cancelSale, updateSaleItems, loading } =
    usePosSales();

  const [sale, setSale] = useState<PosSale | null>(null);
  const [orgPrintInfo, setOrgPrintInfo] = useState<{
    name?: string | null;
    cnpj?: string | null;
    address?: string | null;
  }>({});
  const [fetching, setFetching] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const [editDateOpen, setEditDateOpen] = useState(false);
  const [soldAtLocal, setSoldAtLocal] = useState("");

  const [alterOpen, setAlterOpen] = useState(false);
  const [alterCustomer, setAlterCustomer] = useState("");
  const [alterNotes, setAlterNotes] = useState("");
  const [alterSoldAt, setAlterSoldAt] = useState("");
  const [alterSupplier, setAlterSupplier] = useState("");

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapQty, setSwapQty] = useState<Record<string, string>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadSale = useCallback(async () => {
    if (!saleId) return;
    setFetching(true);
    try {
      const data = await getSale(saleId);
      setSale(data);
      setNotes(data.notes || "");
      setNotesDirty(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar venda";
      toast({ title: "Erro", description: message, variant: "destructive" });
      onOpenChange(false);
    } finally {
      setFetching(false);
    }
  }, [saleId, getSale, toast, onOpenChange]);

  useEffect(() => {
    if (open && saleId) {
      void loadSale();
    }
    if (!open) {
      setSale(null);
      setNotes("");
      setNotesDirty(false);
    }
  }, [open, saleId, loadSale]);

  useEffect(() => {
    if (!activeOrgId) {
      setOrgPrintInfo({});
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("name, cnpj, address")
        .eq("id", activeOrgId)
        .maybeSingle();
      setOrgPrintInfo({
        name: data?.name || activeOrganization?.name || null,
        cnpj: (data as { cnpj?: string | null } | null)?.cnpj || null,
        address: (data as { address?: string | null } | null)?.address || null,
      });
    })();
  }, [activeOrgId, activeOrganization?.name]);

  const products = useMemo(
    () => (sale?.items || []).filter((i) => i.item_type === "product"),
    [sale]
  );
  const services = useMemo(
    () => (sale?.items || []).filter((i) => i.item_type === "service"),
    [sale]
  );

  const itemsSectionTitle = useMemo(() => {
    if (products.length && services.length) return null; // two sections
    if (services.length && !products.length) return "Serviços";
    if (products.length && !services.length) return "Produtos";
    return "Itens";
  }, [products.length, services.length]);

  const saveNotes = async () => {
    if (!sale || !notesDirty) return;
    try {
      const updated = await updateSale({
        sale_id: sale.id,
        notes: notes.trim() || null,
      });
      setSale((prev) => (prev ? { ...prev, ...updated, items: prev.items, payments: prev.payments } : prev));
      setNotesDirty(false);
      onChanged?.();
    } catch {
      // toast já no hook
    }
  };

  const handleSaveSoldAt = async () => {
    if (!sale || !soldAtLocal) return;
    try {
      const iso = new Date(soldAtLocal).toISOString();
      const updated = await updateSale({ sale_id: sale.id, sold_at: iso });
      setSale((prev) =>
        prev ? { ...prev, ...updated, items: prev.items, payments: prev.payments } : prev
      );
      setEditDateOpen(false);
      onChanged?.();
    } catch {
      // toast já no hook
    }
  };

  const openAlter = () => {
    if (!sale) return;
    setAlterCustomer(sale.customer_name || "");
    setAlterNotes(sale.notes || "");
    setAlterSoldAt(toDatetimeLocalValue(sale.sold_at || sale.created_at));
    setAlterSupplier(sale.supplier_name || "");
    setAlterOpen(true);
  };

  const handleAlterSave = async () => {
    if (!sale) return;
    try {
      const updated = await updateSale({
        sale_id: sale.id,
        customer_name: alterCustomer.trim() || null,
        notes: alterNotes.trim() || null,
        sold_at: alterSoldAt ? new Date(alterSoldAt).toISOString() : undefined,
        supplier_name: alterSupplier.trim() || null,
      });
      setSale((prev) =>
        prev ? { ...prev, ...updated, items: prev.items, payments: prev.payments } : prev
      );
      setNotes(alterNotes.trim());
      setNotesDirty(false);
      setAlterOpen(false);
      onChanged?.();
    } catch {
      // toast já no hook
    }
  };

  const openSwap = () => {
    if (!sale) return;
    const map: Record<string, string> = {};
    for (const item of sale.items || []) {
      map[item.id] = String(Number(item.quantity));
    }
    setSwapQty(map);
    setSwapOpen(true);
  };

  const handleSwapSave = async () => {
    if (!sale) return;
    const items = (sale.items || []).map((i) => ({
      id: i.id,
      quantity: Number(swapQty[i.id] ?? i.quantity),
    }));
    try {
      const updated = await updateSaleItems({ sale_id: sale.id, items });
      setSale(updated);
      setSwapOpen(false);
      onChanged?.();
    } catch {
      // toast já no hook
    }
  };

  const handleDelete = async () => {
    if (!sale) return;
    try {
      await cancelSale(sale.id);
      setDeleteOpen(false);
      onOpenChange(false);
      onChanged?.();
    } catch {
      // toast já no hook
    }
  };

  const renderItemRows = (items: PosSaleItem[]) =>
    items.map((item) => (
      <div
        key={item.id}
        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-sm last:border-0"
      >
        <span className="truncate text-gray-800">{item.name}</span>
        <span className="tabular-nums text-gray-600">{Number(item.quantity)}x</span>
        <span className="min-w-[5.5rem] text-right tabular-nums text-gray-700">
          {formatMoney(Number(item.unit_price))}
        </span>
      </div>
    ));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-md p-0 sm:max-w-md"
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="space-y-0 border-b px-4 pb-3 pt-4 text-left">
              <div className="pr-8">
                <span className="inline-flex rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">
                  Comprovante de venda
                </span>
              </div>
              <SheetTitle className="sr-only">Comprovante de venda</SheetTitle>
            </SheetHeader>

            {fetching || !sale ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 space-y-0 overflow-y-auto pb-6">
                {/* Resumo */}
                <div className="space-y-1 px-4 py-4">
                  <p className="text-3xl font-semibold tabular-nums text-gray-500">
                    {sale.sale_number}
                  </p>
                  <p className="text-sm text-gray-600">
                    Cliente:{" "}
                    <span className="text-gray-800">
                      {sale.customer_name || ""}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Valor:{" "}
                    <span className="font-medium tabular-nums text-gray-700">
                      {formatMoney(Number(sale.total))}
                    </span>
                  </p>
                </div>

                {/* Informações da venda */}
                <SectionHeader title="Informações da venda" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-sm">
                  <div>
                    <button
                      type="button"
                      className="mb-0.5 flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                      onClick={() => {
                        setSoldAtLocal(
                          toDatetimeLocalValue(sale.sold_at || sale.created_at)
                        );
                        setEditDateOpen(true);
                      }}
                    >
                      Data da venda
                      <Pencil className="h-3 w-3 text-blue-600" />
                    </button>
                    <p className="text-gray-800">
                      {formatDateTimeShort(sale.sold_at || sale.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-gray-500">Data de registro</p>
                    <p className="text-gray-800">
                      {formatDateTimeShort(sale.created_at)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-0.5 text-xs text-gray-500">
                      Quem realizou a venda
                    </p>
                    <p className="text-gray-500">
                      {sale.sold_by_name || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-0.5 text-xs text-gray-500">Observações</p>
                    <Textarea
                      placeholder="Digite"
                      value={notes}
                      rows={2}
                      className="min-h-[60px] resize-none border-gray-200 text-sm"
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setNotesDirty(true);
                      }}
                      onBlur={() => void saveNotes()}
                    />
                  </div>
                </div>

                {/* Itens */}
                {itemsSectionTitle ? (
                  <>
                    <SectionHeader title={itemsSectionTitle} />
                    <div>{renderItemRows(sale.items || [])}</div>
                  </>
                ) : (
                  <>
                    {services.length > 0 && (
                      <>
                        <SectionHeader title="Serviços" />
                        <div>{renderItemRows(services)}</div>
                      </>
                    )}
                    {products.length > 0 && (
                      <>
                        <SectionHeader title="Produtos" />
                        <div>{renderItemRows(products)}</div>
                      </>
                    )}
                  </>
                )}

                {/* Formas de pagamento */}
                <SectionHeader title="Formas de pagamento" />
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {(sale.payments || []).length === 0 ? (
                    <span className="text-sm text-gray-400">—</span>
                  ) : (
                    (sale.payments || []).map((p) => (
                      <span
                        key={p.id}
                        className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white"
                        title={formatMoney(Number(p.amount))}
                      >
                        {paymentLabel(p.method)}
                      </span>
                    ))
                  )}
                </div>

                {/* Fornecedor */}
                <SectionHeader title="Fornecedor" />
                <div className="px-4 py-3 text-sm text-gray-500">
                  {sale.supplier_name || "—"}
                </div>

                {/* Ações 2x2 */}
                <div className="grid grid-cols-2 gap-2 px-4 pt-2">
                  <Button
                    type="button"
                    className="h-11 bg-slate-900 text-white hover:bg-slate-800"
                    onClick={() => printPosCupom(saleToPrintPayload(sale, orgPrintInfo))}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir cupom
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => printPosA4(saleToPrintPayload(sale, orgPrintInfo))}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Comprovante A4
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 bg-gray-300 text-gray-800 hover:bg-gray-400"
                    onClick={() => printRomaneio(sale, "entrega")}
                  >
                    Romaneio de Entrega
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 bg-gray-300 text-gray-800 hover:bg-gray-400"
                    onClick={() => printRomaneio(sale, "montagem")}
                  >
                    Romaneio de Montagem
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 bg-gray-300 text-gray-800 hover:bg-gray-400"
                    onClick={openSwap}
                  >
                    Trocar Produtos
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 bg-gray-300 text-gray-800 hover:bg-gray-400"
                    onClick={openAlter}
                  >
                    Alterar Venda
                  </Button>
                </div>

                {/* Excluir */}
                <div className="px-4 pt-3">
                  <Button
                    type="button"
                    className="h-11 w-full bg-red-600 text-base font-semibold text-white hover:bg-red-700"
                    onClick={() => setDeleteOpen(true)}
                    disabled={loading || sale.status === "cancelled"}
                  >
                    Excluir venda
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Editar data da venda */}
      <Dialog open={editDateOpen} onOpenChange={setEditDateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data da venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Data e hora</Label>
            <Input
              type="datetime-local"
              value={soldAtLocal}
              onChange={(e) => setSoldAtLocal(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveSoldAt()} disabled={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alterar venda */}
      <Dialog open={alterOpen} onOpenChange={setAlterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input
                value={alterCustomer}
                onChange={(e) => setAlterCustomer(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1">
              <Label>Data da venda</Label>
              <Input
                type="datetime-local"
                value={alterSoldAt}
                onChange={(e) => setAlterSoldAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input
                value={alterSupplier}
                onChange={(e) => setAlterSupplier(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={alterNotes}
                onChange={(e) => setAlterNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlterOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleAlterSave()} disabled={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trocar produtos */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trocar produtos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ajuste a quantidade dos itens. Use 0 para remover. O estoque será
            recalculado automaticamente.
          </p>
          <div className="space-y-3">
            {(sale?.items || []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.item_type === "service" ? "Serviço" : "Produto"} ·{" "}
                    {formatMoney(Number(item.unit_price))}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  className="w-24"
                  value={swapQty[item.id] ?? ""}
                  onChange={(e) =>
                    setSwapQty((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSwapSave()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda #{sale?.sale_number} será cancelada e o estoque dos
              produtos será revertido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Excluir venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
