import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { extractConnectionState } from "@/lib/evolutionStatus";

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
  webhook_secret: string | null;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export function useEvolutionConfigs() {
  const [configs, setConfigs] = useState<EvolutionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (activeOrgId) {
      fetchConfigs();
    } else {
      setConfigs([]);
      setLoading(false);
    }

    if (!activeOrgId) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`evolution-configs-channel-${activeOrgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_config',
          filter: `organization_id=eq.${activeOrgId}`
        },
        () => {
          fetchConfigs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrgId]);

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
      if (!activeOrgId) {
        setConfigs([]);
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('evolution_config')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setConfigs(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar configurações Evolution:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
      setConfigs([]);
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

      if (!activeOrgId) {
        throw new Error("Você não pertence a nenhuma organização. Por favor, contate o administrador.");
      }
      
      console.log('🔍 DEBUG - Organization ID:', activeOrgId);
      console.log('🔍 DEBUG - User ID:', user.id);
      
      // Normalizar e limpar dados
      const normalizedUrl = normalizeApiUrl(configData.api_url);
      const cleanedApiKey = configData.api_key.trim();
      const cleanedInstanceName = configData.instance_name.trim();
      
      console.log('➕ Criando nova instância:', {
        original_url: configData.api_url,
        normalized_url: normalizedUrl,
        instance_name: cleanedInstanceName,
        user_id: user.id,
        organization_id: activeOrgId
      });
      
      // Verificar se o usuário realmente pertence a esta org
      const { data: memberCheck, error: memberError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', activeOrgId)
        .single();
      
      console.log('🔍 DEBUG - Member check:', { memberCheck, memberError });
      
      if (memberError || !memberCheck) {
        throw new Error('Você não tem permissão para criar instâncias nesta organização.');
      }
      
      const { error } = await (supabase as any)
        .from('evolution_config')
        .insert({
          user_id: user.id,
          organization_id: activeOrgId,
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
      // Atualização otimista: remover da lista imediatamente
      setConfigs(prevConfigs => prevConfigs.filter(c => c.id !== id));

      const { error } = await (supabase as any)
        .from('evolution_config')
        .delete()
        .eq('id', id);

      if (error) {
        // Se houver erro, reverter a remoção otimista
        await fetchConfigs();
        throw error;
      }

      toast({
        title: "✅ Instância removida",
        description: "A instância foi removida com sucesso desta organização.",
      });

      // Revalidar para garantir sincronização
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
      const secret = config.webhook_secret || config.api_key || '';
      const webhookUrl = `${functionsBase}/functions/v1/evolution-webhook?secret=${encodeURIComponent(secret)}`;

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
        signal: AbortSignal.timeout(8000),
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

        // Persistir como desconectado
        await supabase.from('evolution_config').update({ is_connected: false, updated_at: new Date().toISOString() }).eq('id', config.id);
        return { success: false, httpStatus: status, details: text };
      }

      const data = await response.json();
      const normalized = extractConnectionState(data);
      const isConnected = normalized === true;
      
      // Persistir estado detectado
      await supabase
        .from('evolution_config')
        .update({ 
          is_connected: isConnected,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);
      
      toast({
        title: isConnected ? '✅ Conectado' : '⚠️ Desconectado',
        description: isConnected
          ? `Instância "${config.instance_name}" está conectada`
          : `Status: ${String(normalized)}`,
        variant: isConnected ? 'default' : 'destructive',
      });

      await fetchConfigs();
      return { success: true, httpStatus: status, details: data, isConnected };
    } catch (error: any) {
      // Logar erro para diagnóstico - ERRO REAL, NÃO SILENCIAR
      console.error('❌ Erro ao testar conexão Evolution API:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        instance: config.instance_name,
        url: `${normalizeApiUrl(config.api_url)}/instance/connectionState/${config.instance_name}`
      });
      
      toast({
        title: '❌ Erro ao testar conexão',
        description: error.message || 'Erro desconhecido ao conectar com Evolution API',
        variant: 'destructive',
      });
      return { success: false, httpStatus: null, details: error.message, isConnected: false };
    }
  };

  const refreshStatuses = async () => {
    const results = await Promise.allSettled(
      configs.map(async (cfg) => {
        const base = normalizeApiUrl(cfg.api_url);
        const url = `${base}/instance/connectionState/${cfg.instance_name}`;
        try {
          const res = await fetch(url, { headers: { apikey: cfg.api_key || '' }, signal: AbortSignal.timeout(8000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const normalized = extractConnectionState(data);
          const isConnected = normalized === true;
          if (cfg.is_connected !== isConnected) {
            await supabase
              .from('evolution_config')
              .update({ is_connected: isConnected, updated_at: new Date().toISOString() })
              .eq('id', cfg.id);
          }
          return { id: cfg.id, ok: isConnected };
        } catch (e: any) {
          if (cfg.is_connected) {
            await supabase
              .from('evolution_config')
              .update({ is_connected: false, updated_at: new Date().toISOString() })
              .eq('id', cfg.id);
          }
          return { id: cfg.id, ok: false, error: e?.message || 'Erro' };
        }
      })
    );

    await fetchConfigs();
    const connected = results.filter((r: any) => r.status === 'fulfilled' && r.value.ok).length;
    const total = results.length;
    return { connected, total };
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
    refreshStatuses,
    refetch: fetchConfigs,
  };
}
