import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "./useActiveOrganization";

interface BubbleQueryParams {
  query_type: string;
  endpoint: string;
  constraints?: any;
  skipCache?: boolean;
}

interface BubbleQueryHistory {
  id: string;
  organization_id: string;
  query_type: string;
  query_params: any;
  response_data: any;
  created_at: string;
}

export function useBubbleQueries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  // Buscar histórico de consultas
  const { data: queryHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["bubble-query-history", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("bubble_query_history")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as BubbleQueryHistory[];
    },
    enabled: !!activeOrgId,
  });

  // Executar consulta (com cache automático)
  const executeQuery = useMutation({
    mutationFn: async (params: BubbleQueryParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke('bubble-query-data', {
        body: params,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bubble-query-history", activeOrgId] });
      
      if (data.cached) {
        toast({
          title: "Dados do cache",
          description: "Retornando dados salvos nas últimas 24h (economia de custos)",
        });
      } else {
        toast({
          title: "Consulta realizada",
          description: "Dados atualizados do Bubble.io",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na consulta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Limpar cache antigo (opcional)
  const clearOldCache = useMutation({
    mutationFn: async (daysOld: number = 7) => {
      if (!activeOrgId) throw new Error("Organização não selecionada");

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from("bubble_query_history")
        .delete()
        .eq("organization_id", activeOrgId)
        .lt("created_at", cutoffDate.toISOString());

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bubble-query-history", activeOrgId] });
      toast({
        title: "Cache limpo",
        description: "Consultas antigas foram removidas",
      });
    },
  });

  return {
    queryHistory,
    isLoadingHistory,
    executeQuery: executeQuery.mutate,
    isExecuting: executeQuery.isPending,
    clearOldCache: clearOldCache.mutate,
    isClearing: clearOldCache.isPending,
  };
}
