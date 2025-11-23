import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useChatwootConfig = (organizationId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['chatwoot-config', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      
      const { data, error } = await supabase
        .from('chatwoot_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const testConnection = useMutation({
    mutationFn: async ({ baseUrl, accountId, apiToken }: { 
      baseUrl: string; 
      accountId: number; 
      apiToken: string;
    }) => {
      const response = await fetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
        headers: { 'api_access_token': apiToken },
      });

      if (!response.ok) {
        throw new Error('Falha na conexão com Chatwoot');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Conexão com Chatwoot estabelecida com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "❌ Erro ao conectar com Chatwoot", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (configData: any) => {
      if (!organizationId) throw new Error('Organization ID não encontrado');

      const { data, error } = await supabase
        .from('chatwoot_configs')
        .upsert({
          ...configData,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatwoot-config', organizationId] });
      toast({ title: "✅ Configuração salva com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "❌ Erro ao salvar configuração", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const listInboxes = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('Organization ID não encontrado');

      const { data, error } = await supabase.functions.invoke('chatwoot-list-inboxes', {
        body: { organizationId },
      });

      if (error) throw error;
      return data.inboxes;
    },
  });

  return {
    config,
    isLoading,
    testConnection,
    saveConfig,
    listInboxes,
  };
};
