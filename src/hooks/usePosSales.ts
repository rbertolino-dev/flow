import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import type {
  FinalizeSalePayload,
  FinalizeSaleResult,
  PosCashSession,
  PosSale,
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

  const listSales = useCallback(
    async (opts?: { search?: string; limit?: number; offset?: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ action: "list_sales" });
        if (opts?.search) params.set("search", opts.search);
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.offset) params.set("offset", String(opts.offset));
        const result = await callPos(`?${params.toString()}`);
        return (result.data || []) as PosSale[];
      } finally {
        setLoading(false);
      }
    },
    [callPos]
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

  return {
    loading,
    listSales,
    getOpenCashSession,
    openCash,
    finalizeSale,
  };
}
