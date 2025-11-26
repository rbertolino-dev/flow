import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "./useActiveOrganization";

export interface FieldMapping {
  bubble_field: string;
  lead_field: 'name' | 'phone' | 'email' | 'company' | 'value' | 'notes';
  default_value?: any;
}

export interface BubbleSyncConfig {
  endpoint: string;
  field_mappings: FieldMapping[];
  constraints?: any[];
  auto_sync?: boolean;
  last_sync_at?: string;
}

export interface BubbleDataType {
  name: string;
  fields: { name: string; type: string }[];
}

export interface SyncResult {
  success: boolean;
  dry_run: boolean;
  stats: {
    total_found: number;
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  errors: string[];
  last_sync_at: string;
}

export function useBubbleLeadsSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  // Buscar configuração de sincronização salva
  const { data: savedConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["bubble-sync-config", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;

      // Por enquanto, vamos salvar no localStorage
      // Futuramente pode ser uma tabela no banco
      const saved = localStorage.getItem(`bubble_sync_config_${activeOrgId}`);
      return saved ? JSON.parse(saved) as BubbleSyncConfig : null;
    },
    enabled: !!activeOrgId,
  });

  // Salvar configuração
  const saveConfig = useMutation({
    mutationFn: async (config: BubbleSyncConfig) => {
      if (!activeOrgId) throw new Error("Organização não selecionada");
      
      localStorage.setItem(`bubble_sync_config_${activeOrgId}`, JSON.stringify(config));
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bubble-sync-config", activeOrgId] });
      toast({
        title: "Configuração salva",
        description: "Configuração de sincronização salva com sucesso",
      });
    },
  });

  // Executar sincronização
  const syncLeads = useMutation({
    mutationFn: async ({ config, dry_run = false }: { config: BubbleSyncConfig; dry_run?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke('bubble-sync-leads', {
        body: { sync_config: config, dry_run },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data as SyncResult;
    },
    onSuccess: (data, variables) => {
      if (variables.dry_run) {
        toast({
          title: "Teste de sincronização",
          description: `Encontrados ${data.stats.total_found} registros. ${data.stats.created} seriam criados, ${data.stats.updated} atualizados.`,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["leads", activeOrgId] });
        toast({
          title: "Sincronização concluída",
          description: `${data.stats.created} leads criados, ${data.stats.updated} atualizados. ${data.stats.skipped} ignorados.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Buscar Data Types do Bubble
  const { data: dataTypes, isLoading: isLoadingDataTypes, refetch: refetchDataTypes } = useQuery({
    queryKey: ['bubble-data-types', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke('bubble-list-data-types', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (response.error) throw response.error;
      return response.data.data_types as BubbleDataType[];
    },
    enabled: false, // Só busca quando chamado manualmente
  });

  return {
    savedConfig,
    isLoadingConfig,
    saveConfig: saveConfig.mutate,
    isSavingConfig: saveConfig.isPending,
    syncLeads: syncLeads.mutate,
    isSyncing: syncLeads.isPending,
    lastSyncResult: syncLeads.data,
    dataTypes,
    isLoadingDataTypes,
    fetchDataTypes: refetchDataTypes,
  };
}

