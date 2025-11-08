import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export interface EvolutionConfig {
  id: string;
  user_id: string;
  api_url: string;
  api_key: string | null;
  instance_name: string;
  phone_number: string | null;
  is_connected: boolean;
  qr_code: string | null;
  webhook_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useEvolutionConfigs() {
  const [configs, setConfigs] = useState<EvolutionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('evolution-configs-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_config'
        },
        () => {
          fetchConfigs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const normalizeApiUrl = (url: string) => {
    try {
      const u = new URL(url);
      let base = u.origin + u.pathname.replace(/\/$/, '');
      base = base.replace(/\/(manager|dashboard|app)$/, '');
      return base;
    } catch {
      return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/, '');
    }
  };

  const fetchConfigs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar todas as organizações que o usuário tem acesso
      const { data: userOrgs, error: orgsError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (orgsError) throw orgsError;

      if (!userOrgs || userOrgs.length === 0) {
        setConfigs([]);
        setLoading(false);
        return;
      }

      const orgIds = userOrgs.map(o => o.organization_id);

      // Buscar instâncias de todas as organizações que o usuário tem acesso
      const { data, error } = await (supabase as any)
        .from('evolution_config')
        .select('*')
        .in('organization_id', orgIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setConfigs(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createConfig = async (configData: {
    api_url: string;
    api_key: string;
    instance_name: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const orgId = await getUserOrganizationId();
      
      console.log('🔍 DEBUG - Organization ID:', orgId);
      console.log('🔍 DEBUG - User ID:', user.id);
      
      if (!orgId) {
        throw new Error("Você não pertence a nenhuma organização. Por favor, contate o administrador.");
      }
      
      // Normalizar e limpar dados
      const normalizedUrl = normalizeApiUrl(configData.api_url);
      const cleanedApiKey = configData.api_key.trim();
      const cleanedInstanceName = configData.instance_name.trim();
      
      console.log('➕ Criando nova instância:', {
        original_url: configData.api_url,
        normalized_url: normalizedUrl,
        instance_name: cleanedInstanceName,
        user_id: user.id,
        organization_id: orgId
      });
      
      // Verificar se o usuário realmente pertence a esta org
      const { data: memberCheck, error: memberError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .single();
      
      console.log('🔍 DEBUG - Member check:', { memberCheck, memberError });
      
      if (memberError || !memberCheck) {
        throw new Error('Você não tem permissão para criar instâncias nesta organização.');
      }
      
      const { error } = await (supabase as any)
        .from('evolution_config')
        .insert({
          user_id: user.id,
          organization_id: orgId,
          api_url: normalizedUrl,
          api_key: cleanedApiKey,
          instance_name: cleanedInstanceName,
          webhook_enabled: true,
        });

      if (error) {
        console.error('❌ Erro ao criar instância:', error);
        throw error;
      }

      console.log('✅ Instância criada com sucesso');

      toast({
        title: "✅ Instância criada",
        description: "Nova instância Evolution API foi adicionada.",
      });

      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('❌ Erro completo ao criar:', error);
      toast({
        title: "❌ Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateConfig = async (id: string, configData: Partial<EvolutionConfig>) => {
    try {
      console.log('🔧 updateConfig chamado:', { id, configData });
      
      // Normalizar e limpar todos os dados
      const updateData: any = {};
      
      if (configData.api_url !== undefined) {
        const normalizedUrl = normalizeApiUrl(configData.api_url);
        console.log('🔄 URL normalizada:', { original: configData.api_url, normalized: normalizedUrl });
        updateData.api_url = normalizedUrl;
      }
      
      if (configData.api_key !== undefined) {
        updateData.api_key = configData.api_key.trim();
      }
      
      if (configData.instance_name !== undefined) {
        updateData.instance_name = configData.instance_name.trim();
      }
      
      if (configData.webhook_enabled !== undefined) {
        updateData.webhook_enabled = configData.webhook_enabled;
      }
      
      updateData.updated_at = new Date().toISOString();
      
      console.log('💾 Dados a serem salvos:', updateData);
      
      const { error } = await (supabase as any)
        .from('evolution_config')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }

      console.log('✅ Atualização concluída com sucesso');

      toast({
        title: "✅ Instância atualizada",
        description: "As configurações foram atualizadas com sucesso.",
      });

      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      toast({
        title: "❌ Erro ao atualizar instância",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('evolution_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "✅ Instância removida",
        description: "A instância foi removida com sucesso.",
      });

      await fetchConfigs();
      return true;
    } catch (error: any) {
      toast({
        title: "❌ Erro ao remover instância",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const toggleWebhook = async (id: string, enabled: boolean) => {
    return updateConfig(id, { webhook_enabled: enabled });
  };

  const configureWebhook = async (config: EvolutionConfig) => {
    try {
      const functionsBase = (import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin;
      const webhookUrl = `${functionsBase}/functions/v1/evolution-webhook`;

      const response = await fetch(`${normalizeApiUrl(config.api_url)}/webhook/set/${config.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key || '',
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'messages.upsert',
            'connection.update',
            'qrcode.updated'
          ]
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao configurar webhook');
      }

      toast({
        title: "Webhook configurado",
        description: `Webhook configurado para instância ${config.instance_name}.`,
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao configurar webhook",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const testConnection = async (config: EvolutionConfig) => {
    try {
      const url = `${normalizeApiUrl(config.api_url)}/instance/connectionState/${config.instance_name}`;
      const response = await fetch(url, {
        headers: {
          'apikey': config.api_key || '',
        },
      });

      const status = response.status;

      if (!response.ok) {
        const text = await response.text();
        const reason = status === 401
          ? 'API Key inválida'
          : status === 404
          ? 'Instância não encontrada'
          : `Erro HTTP ${status}`;

        toast({
          title: '❌ Falha ao conectar',
          description: `${reason}. ${text.slice(0, 100)}`,
          variant: 'destructive',
        });

        return { success: false, httpStatus: status, details: text };
      }

      const data = await response.json();
      const isConnected = data.state === 'open';
      
      toast({
        title: isConnected ? '✅ Conectado' : '⚠️ Desconectado',
        description: isConnected
          ? `Instância "${config.instance_name}" está conectada`
          : `Status: ${data.state || 'Desconhecido'}`,
        variant: isConnected ? 'default' : 'destructive',
      });

      return { success: true, httpStatus: status, details: data, isConnected };
    } catch (error: any) {
      toast({
        title: '❌ Erro ao testar conexão',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, httpStatus: null, details: error.message, isConnected: false };
    }
  };

  return {
    configs,
    loading,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleWebhook,
    configureWebhook,
    testConnection,
    refetch: fetchConfigs,
  };
}
