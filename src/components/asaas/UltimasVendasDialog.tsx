import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePosSales } from "@/hooks/usePosSales";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import type { PosSale } from "@/types/pos";
import { formatMoney, monthRangeIso, type CobrancaFormPrefill } from "./cobrancaTypes";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UltimasVendasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGerarBoleto: (prefill: CobrancaFormPrefill) => void;
}

export function UltimasVendasDialog({
  open,
  onOpenChange,
  onGerarBoleto,
}: UltimasVendasDialogProps) {
  const initial = monthRangeIso();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSale, setLoadingSale] = useState<string | null>(null);
  const { listSalesDetailed } = usePosSales();
  const { activeOrgId } = useActiveOrganization();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSalesDetailed({
        payment_method: "boleto",
        date_from: from,
        date_to: to,
        limit: 50,
        offset: 0,
        status: "completed",
      });
      setSales(result.data || []);
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, listSalesDetailed]);

  useEffect(() => {
    if (!open) return;
    const range = monthRangeIso();
    setFrom(range.from);
    setTo(range.to);
  }, [open]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleGerar = async (sale: PosSale) => {
    setLoadingSale(sale.id);
    try {
      let cpf: string | undefined;
      let email: string | undefined;
      let phone = sale.customer_phone || undefined;
      let name = sale.customer_name || "Cliente";

      if (sale.lead_id && activeOrgId) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, name, phone, email, cpf_cnpj")
          .eq("id", sale.lead_id)
          .eq("organization_id", activeOrgId)
          .maybeSingle();
        if (lead) {
          name = lead.name || name;
          phone = lead.phone || phone;
          email = lead.email || undefined;
          cpf = lead.cpf_cnpj || undefined;
        }
      }

      const boletoPayment = (sale.payments || []).find((p) => p.method === "boleto");
      const valor = Number(boletoPayment?.amount ?? sale.payment_amount ?? sale.total) || 0;
      const descricao = [
        `Venda ${sale.sale_number}`,
        name,
        sale.notes || "",
      ].filter(Boolean).join(" - ");

      onGerarBoleto({
        leadId: sale.lead_id || undefined,
        posSaleId: sale.id,
        descricao,
        valor,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        customerCpfCnpj: cpf,
        referenciaExterna: `sale:${sale.id}`,
      });
      onOpenChange(false);
    } finally {
      setLoadingSale(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Últimas vendas</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Filtrar</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">a</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Aplicar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Apenas vendas com forma de pagamento Boleto.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando vendas...
            </div>
          ) : sales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhuma venda com boleto no período.
            </p>
          ) : (
            sales.map((sale) => {
              const name = sale.customer_name || "Cliente";
              const boletoPayment = (sale.payments || []).find((p) => p.method === "boleto");
              const valor = Number(boletoPayment?.amount ?? sale.payment_amount ?? sale.total) || 0;
              const created = sale.created_at || sale.sold_at
                ? format(parseISO(sale.sold_at || sale.created_at), "dd/MM/yy", { locale: ptBR })
                : "";
              return (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 text-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      Venda {sale.sale_number} — {name}
                    </p>
                    <p className="text-xs text-slate-300">
                      {formatMoney(valor)}
                      {created ? ` · em ${created}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-full"
                    disabled={loadingSale === sale.id}
                    onClick={() => handleGerar(sale)}
                  >
                    {loadingSale === sale.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Gerar Boleto"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
