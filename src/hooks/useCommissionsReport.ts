import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { usePosSales } from "@/hooks/usePosSales";
import { useToast } from "@/hooks/use-toast";
import { monthRange } from "@/lib/finance";
import type { PosSale } from "@/types/pos";
import type { ServiceOrder } from "@/types/serviceOrder";
import {
  buildOsCommissionRows,
  buildSalesCommissionRows,
  commissionPayableSourceId,
  type CommissionOsRow,
  type CommissionSalesRow,
} from "@/lib/commissionsReport";

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

function toIsoStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).toISOString();
}

function toIsoEnd(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).toISOString();
}

type FinanceRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>;
};

export function useCommissionsReport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { listSalesDetailed } = usePosSales();

  const initial = monthRange();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [salesTotalShown, setSalesTotalShown] = useState<number | null>(null);
  const [osTotalShown, setOsTotalShown] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!activeOrgId || !dateFrom || !dateTo || dateFrom > dateTo) {
      setSales([]);
      setOrders([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    setSalesTotalShown(null);
    setOsTotalShown(null);
    try {
      const allSales: PosSale[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await listSalesDetailed({
          date_from: toIsoStart(dateFrom),
          date_to: toIsoEnd(dateTo),
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          include_items: false,
        });
        allSales.push(...result.data);
        if (result.data.length < PAGE_SIZE) break;
      }
      setSales(allSales);

      const { data: osData, error: osError } = await supabase
        .from("service_orders")
        .select(
          "id, organization_id, code, total, has_commission, commission_value, collaborator_user_id, collaborator_name, responsible_user_id, responsible_name, is_closed, closed_at, ends_at, deleted_at",
        )
        .eq("organization_id", activeOrgId)
        .eq("is_closed", true)
        .eq("has_commission", true)
        .is("deleted_at", null);
      if (osError) throw osError;
      setOrders((osData || []) as ServiceOrder[]);
      setLoaded(true);
    } catch (error) {
      console.error("Erro ao carregar comissões:", error);
      setSales([]);
      setOrders([]);
      toast({
        title: "Relatório de comissões",
        description: error instanceof Error ? error.message : "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, dateFrom, dateTo, listSalesDetailed, toast]);

  const salesRows: CommissionSalesRow[] = useMemo(
    () => (loaded ? buildSalesCommissionRows(sales, dateFrom, dateTo) : []),
    [loaded, sales, dateFrom, dateTo],
  );

  const osRows: CommissionOsRow[] = useMemo(
    () => (loaded ? buildOsCommissionRows(orders, dateFrom, dateTo) : []),
    [loaded, orders, dateFrom, dateTo],
  );

  const createPayable = useCallback(
    async (kind: "vendas" | "os", row: { userKey: string; userName: string; commissionSum: number }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");
      if (row.commissionSum <= 0.009) {
        toast({ title: "Sem comissão", description: "Não há valor para lançar.", variant: "destructive" });
        return;
      }
      const sourceId = commissionPayableSourceId(kind, row.userKey, dateFrom, dateTo);
      setPayingKey(`${kind}:${row.userKey}`);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const client = supabase as unknown as FinanceRpc;
        const created = await client.rpc("upsert_financial_entry", {
          p_organization_id: activeOrgId,
          p_direction: "pagar",
          p_amount: row.commissionSum,
          p_due_date: dateTo,
          p_source_type: "comissao",
          p_source_id: sourceId,
          p_status: "open",
          p_settlement_status: "confirmado",
          p_lead_id: null,
          p_description:
            kind === "vendas"
              ? `Comissão vendas ${dateFrom} a ${dateTo} — ${row.userName}`
              : `Comissão OS ${dateFrom} a ${dateTo} — ${row.userName}`,
          p_contact_name: row.userName,
          p_billing_name: row.userName,
          p_category: "Comissão",
          p_account: "Caixa",
          p_origin_label: "Comissão",
          p_paid_at: null,
          p_created_by: userData.user?.id || null,
          p_competence_date: dateTo,
        });
        if (created.error) throw new Error(created.error.message);
        toast({
          title: "Conta a pagar criada",
          description: `${row.userName}: ${row.commissionSum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        });
        navigate("/financeiro/pagar");
      } catch (error) {
        console.error("Erro ao criar conta a pagar de comissão:", error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Não foi possível criar a conta a pagar",
          variant: "destructive",
        });
      } finally {
        setPayingKey(null);
      }
    },
    [activeOrgId, dateFrom, dateTo, navigate, toast],
  );

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    loading,
    loaded,
    salesRows,
    osRows,
    load,
    createPayable,
    payingKey,
    salesTotalShown,
    setSalesTotalShown,
    osTotalShown,
    setOsTotalShown,
  };
}
