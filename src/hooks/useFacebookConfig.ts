import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FacebookConfig {
  id: string;
  organization_id: string;
  account_name: string;
  page_access_token: string;
  page_id: string;
  page_name: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  instagram_access_token: string | null;
  enabled: boolean;
  messenger_enabled: boolean;
  instagram_enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useFacebookConfig = (organizationId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todas as configurações da organização (pode ter múltiplas páginas)
  const { data: configs, isLoading } = useQuery({
    queryKey: ['facebook-configs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('facebook_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FacebookConfig[];
    },
    enabled: !!organizationId,
  });

  const testConnection = useMutation({
    mutationFn: async ({ 
      pageAccessToken, 
      pageId, 
      instagramAccountId 
    }: { 
      pageAccessToken: string; 
      pageId: string;
      instagramAccountId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('facebook-test-connection', {
        body: { pageAccessToken, pageId, instagramAccountId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "✅ Conexão estabelecida com sucesso!",
        description: data.page?.name ? `Página: ${data.page.name}` : undefined
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "❌ Erro ao conectar com Facebook/Instagram", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (configData: {
      account_name: string;
      page_access_token: string;
      page_id: string;
      page_name?: string;
      instagram_account_id?: string;
      instagram_username?: string;
      instagram_access_token?: string;
      enabled?: boolean;
      messenger_enabled?: boolean;
      instagram_enabled?: boolean;
      id?: string; // Para update
    }) => {
      if (!organizationId) throw new Error('Organization ID não encontrado');

      const payload = {
        ...configData,
        organization_id: organizationId,
      };

      // Se tiver ID, fazer update, senão insert
      const { data, error } = configData.id
        ? await supabase
            .from('facebook_configs')
            .update(payload)
            .eq('id', configData.id)
            .select()
            .single()
        : await supabase
            .from('facebook_configs')
            .insert(payload)
            .select()
            .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-configs', organizationId] });
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

  const deleteConfig = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from('facebook_configs')
        .delete()
        .eq('id', configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-configs', organizationId] });
      toast({ title: "✅ Configuração removida com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "❌ Erro ao remover configuração", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  return {
    configs: configs || [],
    isLoading,
    testConnection,
    saveConfig,
    deleteConfig,
  };
};

