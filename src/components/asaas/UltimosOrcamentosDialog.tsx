import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBudgets } from "@/hooks/useBudgets";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import type { Budget } from "@/types/budget";
import { formatMoney, monthRangeIso, type CobrancaFormPrefill } from "./cobrancaTypes";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UltimosOrcamentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGerarBoleto: (prefill: CobrancaFormPrefill) => void;
}

function serviceSummary(budget: Budget): string {
  const services = Array.isArray(budget.services) ? budget.services : [];
  if (services.length > 0) return services.map((s) => s.name).filter(Boolean).join(", ");
  const products = Array.isArray(budget.products) ? budget.products : [];
  if (products.length > 0) return products.map((p) => p.name).filter(Boolean).join(", ");
  return budget.observations || "";
}

export function UltimosOrcamentosDialog({
  open,
  onOpenChange,
  onGerarBoleto,
}: UltimosOrcamentosDialogProps) {
  const initial = monthRangeIso();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loadingLead, setLoadingLead] = useState<string | null>(null);
  const { activeOrgId } = useActiveOrganization();

  const filters = useMemo(
    () => ({
      approved_only: true,
      date_from: from ? `${from}T00:00:00` : undefined,
      date_to: to ? `${to}T23:59:59` : undefined,
      page: 1,
      page_size: 50,
    }),
    [from, to],
  );

  const { budgets, loading } = useBudgets(open ? filters : undefined);

  useEffect(() => {
    if (!open) return;
    const range = monthRangeIso();
    setFrom(range.from);
    setTo(range.to);
  }, [open]);

  const handleGerar = async (budget: Budget) => {
    setLoadingLead(budget.id);
    try {
      let cpf: string | undefined;
      let email = budget.client_data?.email || budget.lead?.email;
      let phone = budget.client_data?.phone || budget.lead?.phone;
      let name = budget.client_data?.name || budget.lead?.name || "Cliente";

      if (budget.lead_id && activeOrgId) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, name, phone, email, cpf_cnpj")
          .eq("id", budget.lead_id)
          .eq("organization_id", activeOrgId)
          .maybeSingle();
        if (lead) {
          name = lead.name || name;
          phone = lead.phone || phone;
          email = lead.email || email;
          cpf = lead.cpf_cnpj || undefined;
        }
      }

      const summary = serviceSummary(budget);
      const descricao = [
        `Orçamento ${budget.budget_number}`,
        name,
        summary,
      ].filter(Boolean).join(" - ");

      onGerarBoleto({
        leadId: budget.lead_id,
        budgetId: budget.id,
        descricao,
        valor: Number(budget.total) || 0,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        customerCpfCnpj: cpf,
        referenciaExterna: `budget:${budget.id}`,
      });
      onOpenChange(false);
    } finally {
      setLoadingLead(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Últimos orçamentos criados</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Filtrar</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">a</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando orçamentos...
            </div>
          ) : budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum orçamento aprovado no período.
            </p>
          ) : (
            budgets.map((budget) => {
              const name = budget.client_data?.name || budget.lead?.name || "Cliente";
              const summary = serviceSummary(budget);
              const created = budget.created_at
                ? format(parseISO(budget.created_at), "dd/MM/yy", { locale: ptBR })
                : "";
              return (
                <div
                  key={budget.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 text-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {name}
                      {summary ? ` - ${summary}` : ""}
                    </p>
                    <p className="text-xs text-slate-300">
                      #{budget.budget_number} · {formatMoney(Number(budget.total) || 0)}
                      {created ? ` · em ${created}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-full"
                    disabled={loadingLead === budget.id}
                    onClick={() => handleGerar(budget)}
                  >
                    {loadingLead === budget.id ? (
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
