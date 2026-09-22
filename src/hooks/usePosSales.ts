import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import type {
  FinalizeSalePayload,
  FinalizeSaleResult,
  ListSalesOptions,
  ListSalesResult,
  PosCashSession,
  PosSale,
  UpdateSaleItemsPayload,
  UpdateSalePayload,
} from "@/types/pos";

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function usePosSales() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const callPos = useCallback(
    async (
      pathQuery: string,
      options?: { method?: string; body?: unknown }
    ) => {
      if (!activeOrgId) throw new Error("Organização não selecionada");

      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Organization-Id": activeOrgId,
      };

      const response = await fetch(
        `${supabaseUrl}/functions/v1/pos-sales${pathQuery}`,
        {
          method: options?.method || "GET",
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Erro ${response.status}`);
      }
      return result;
    },
    [activeOrgId]
  );

  const listSalesDetailed = useCallback(
    async (opts?: ListSalesOptions): Promise<ListSalesResult> => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ action: "list_sales" });
        if (opts?.search) params.set("search", opts.search);
        if (opts?.sale_code) params.set("sale_code", opts.sale_code);
        if (opts?.date_from) params.set("date_from", opts.date_from);
        if (opts?.date_to) params.set("date_to", opts.date_to);
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.offset) params.set("offset", String(opts.offset));
        if (opts?.include_items) params.set("include_items", "1");
        if (opts?.customer_field) params.set("customer_field", opts.customer_field);
        if (opts?.customer_query) params.set("customer_query", opts.customer_query);
        if (opts?.sold_by) params.set("sold_by", opts.sold_by);
        if (opts?.payment_method) params.set("payment_method", opts.payment_method);
        if (opts?.origin) params.set("origin", opts.origin);
        if (opts?.price_min != null && !Number.isNaN(opts.price_min)) {
          params.set("price_min", String(opts.price_min));
        }
        if (opts?.price_max != null && !Number.isNaN(opts.price_max)) {
          params.set("price_max", String(opts.price_max));
        }
        if (opts?.with_invoice) params.set("with_invoice", "1");
        const result = await callPos(`?${params.toString()}`);
        return {
          data: (result.data || []) as PosSale[],
          summary: {
            sales_count: Number(result.summary?.sales_count || 0),
            sales_total: Number(result.summary?.sales_total || 0),
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [callPos]
  );

  const listSales = useCallback(
    async (opts?: ListSalesOptions): Promise<PosSale[]> => {
      const result = await listSalesDetailed(opts);
      return result.data;
    },
    [listSalesDetailed]
  );

  const getOpenCashSession = useCallback(async () => {
    const result = await callPos("?action=open_cash_session");
    return (result.data || null) as PosCashSession | null;
  }, [callPos]);

  const openCash = useCallback(
    async (openingAmount = 0) => {
      const result = await callPos("", {
        method: "POST",
        body: { action: "open_cash", opening_amount: openingAmount },
      });
      return result.data as PosCashSession;
    },
    [callPos]
  );

  const closeCash = useCallback(
    async (sessionId: string, closingAmount = 0, notes?: string) => {
      const result = await callPos("", {
        method: "POST",
        body: {
          action: "close_cash",
          session_id: sessionId,
          closing_amount: closingAmount,
          notes: notes || null,
        },
      });
      toast({ title: "Caixa fechado" });
      return result.data as PosCashSession;
    },
    [callPos, toast]
  );

  const finalizeSale = useCallback(
    async (payload: FinalizeSalePayload): Promise<FinalizeSaleResult> => {
      setLoading(true);
      try {
        const result = await callPos("", {
          method: "POST",
          body: { action: "finalize_sale", ...payload },
        });
        toast({
          title: "Venda finalizada",
          description: `Venda #${result.data.sale_number} — R$ ${Number(result.data.total).toFixed(2)}`,
        });
        return result.data as FinalizeSaleResult;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao finalizar venda";
        toast({
          title: "Erro ao finalizar",
          description: message,
          variant: "destructive",
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [callPos, toast]
  );

  const getSale = useCallback(
    async (saleId: string): Promise<PosSale> => {
      const params = new URLSearchParams({ action: "get_sale", id: saleId });
      const result = await callPos(`?${params.toString()}`);
      return result.data as PosSale;
    },
    [callPos]
  );

  const updateSale = useCallback(
    async (payload: UpdateSalePayload): Promise<PosSale> => {
      setLoading(true);
      try {
        const result = await callPos("", {
          method: "POST",
          body: { action: "update_sale", ...payload },
        });
        toast({ title: "Venda atualizada" });
        return result.data as PosSale;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao atualizar venda";
        toast({ title: "Erro", description: message, variant: "destructive" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [callPos, toast]
  );

  const cancelSale = useCallback(
    async (saleId: string): Promise<PosSale> => {
      setLoading(true);
      try {
        const result = await callPos("", {
          method: "POST",
          body: { action: "cancel_sale", sale_id: saleId },
        });
        toast({ title: "Venda excluída", description: "Estoque revertido" });
        return result.data as PosSale;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao excluir venda";
        toast({ title: "Erro", description: message, variant: "destructive" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [callPos, toast]
  );

  const updateSaleItems = useCallback(
    async (payload: UpdateSaleItemsPayload): Promise<PosSale> => {
      setLoading(true);
      try {
        const result = await callPos("", {
          method: "POST",
          body: { action: "update_sale_items", ...payload },
        });
        toast({ title: "Itens atualizados" });
        return result.data as PosSale;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao trocar produtos";
        toast({ title: "Erro", description: message, variant: "destructive" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [callPos, toast]
  );

  return {
    loading,
    listSales,
    listSalesDetailed,
    getSale,
    getOpenCashSession,
    openCash,
    closeCash,
    finalizeSale,
    updateSale,
    cancelSale,
    updateSaleItems,
  };
}
