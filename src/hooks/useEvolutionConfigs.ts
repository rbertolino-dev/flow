import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { extractConnectionState, evolutionApiUrlForFetch, normalizeApiUrl as normalizeApiUrlLib } from "@/lib/evolutionStatus";
import { fetchEvolutionConnectionStateByConfigId } from "@/lib/evolutionConnectionStateProxy";

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
  proxy_host?: string | null;
  proxy_port?: string | null;
  proxy_protocol?: string | null;
  proxy_username?: string | null;
  proxy_password?: string | null;
}

export function useEvolutionConfigs() {
  const [configs, setConfigs] = useState<EvolutionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const fetchConfigs = useCallback(async () => {
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
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      void fetchConfigs();
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
          void fetchConfigs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrgId, fetchConfigs]);

  const normalizeApiUrl = (url: string) => normalizeApiUrlLib(url);

  const createConfig = async (configData: {
    api_url: string;
    api_key: string;
    instance_name: string;
    proxy_host?: string;
    proxy_port?: string;
    proxy_protocol?: string;
    proxy_username?: string;
    proxy_password?: string;
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
      
      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        organization_id: activeOrgId,
        api_url: normalizedUrl,
        api_key: cleanedApiKey,
        instance_name: cleanedInstanceName,
        webhook_enabled: true,
      };
      if (configData.proxy_host?.trim()) insertPayload.proxy_host = configData.proxy_host.trim();
      if (configData.proxy_port?.trim()) insertPayload.proxy_port = configData.proxy_port.trim();
      if (configData.proxy_protocol?.trim()) insertPayload.proxy_protocol = configData.proxy_protocol.trim();
      if (configData.proxy_username?.trim()) insertPayload.proxy_username = configData.proxy_username.trim();
      if (configData.proxy_password?.trim()) insertPayload.proxy_password = configData.proxy_password.trim();

      const { data: newConfig, error } = await (supabase as any)
        .from('evolution_config')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Erro ao criar instância:', error);
        throw error;
      }

      console.log('✅ Instância criada com sucesso');

      // Checagem imediata de status para atualizar is_connected (evita mostrar "desconectado" se já estiver conectada na Evolution)
      if (newConfig?.id) {
        try {
          const r = await fetchEvolutionConnectionStateByConfigId(newConfig.id);
          if (r.evolutionOk && r.body) {
            const isConnected = extractConnectionState(r.body) === true;
            if (isConnected) {
              await (supabase as any)
                .from('evolution_config')
                .update({ is_connected: true, updated_at: new Date().toISOString() })
                .eq('id', newConfig.id);
            }
          }
        } catch (checkErr) {
          console.warn('⚠️ Checagem de status pós-criação ignorada:', checkErr);
        }
      }

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
      if (configData.proxy_host !== undefined) updateData.proxy_host = configData.proxy_host?.trim() || null;
      if (configData.proxy_port !== undefined) updateData.proxy_port = configData.proxy_port?.trim() || null;
      if (configData.proxy_protocol !== undefined) updateData.proxy_protocol = configData.proxy_protocol?.trim() || null;
      if (configData.proxy_username !== undefined) updateData.proxy_username = configData.proxy_username?.trim() || null;
      if (configData.proxy_password !== undefined) updateData.proxy_password = configData.proxy_password?.trim() || null;
      
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
      // Validar dados antes de enviar
      if (!config.api_url || !config.instance_name) {
        throw new Error('URL da API e nome da instância são obrigatórios');
      }

      if (!config.api_key) {
        throw new Error('API Key é obrigatória para configurar webhook');
      }

      // Verificar se a instância está conectada antes de configurar webhook
      // Usar extractConnectionState para normalizar diferentes formatos de resposta
      try {
        const r = await fetchEvolutionConnectionStateByConfigId(config.id);
        if (r.edgeError || r.proxyError) {
          if (config.is_connected) {
            console.warn('⚠️ Não foi possível verificar status via servidor. Continuando com webhook...', r.edgeError || r.proxyError);
          } else {
            throw new Error('Não foi possível verificar status da conexão. Verifique se a instância está conectada.');
          }
        } else if (r.evolutionOk && r.body) {
          const isConnected = extractConnectionState(r.body) === true;
          if (!isConnected) {
            if (config.is_connected) {
              console.warn('⚠️ Status local indica conectado, mas API retornou desconectado. Tentando configurar webhook mesmo assim...');
            } else {
              throw new Error('A instância não está conectada. Conecte o WhatsApp antes de configurar o webhook.');
            }
          }
        } else {
          if (config.is_connected) {
            console.warn('⚠️ Não foi possível verificar status da conexão, mas status local indica conectado. Continuando...');
          } else {
            throw new Error('Não foi possível verificar status da conexão. Verifique se a instância está conectada.');
          }
        }
      } catch (checkError: any) {
        if (checkError.message.includes('não está conectada') || checkError.message.includes('Não foi possível verificar')) {
          throw checkError;
        }
        // Se config.is_connected está true, tentar mesmo assim (pode ser erro temporário da API)
        if (config.is_connected) {
          console.warn('⚠️ Erro ao verificar conexão, mas status local indica conectado. Continuando...', checkError.message);
        } else {
          throw new Error('Erro ao verificar conexão. Verifique se a instância está conectada.');
        }
      }

      // Obter URL base do Supabase corretamente
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL não está configurado. Verifique as variáveis de ambiente.');
      }

      const secret = config.webhook_secret || config.api_key || '';
      const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?secret=${encodeURIComponent(secret)}`;

      // Validar tamanho da URL (algumas APIs têm limite)
      if (webhookUrl.length > 2048) {
        throw new Error('A URL do webhook é muito longa. Tente usar um webhook_secret mais curto.');
      }

      const apiUrl = evolutionApiUrlForFetch(config.api_url);
      const endpoint = `${apiUrl}/webhook/set/${config.instance_name}`;

      console.log('🔧 Configurando webhook:', {
        endpoint,
        webhookUrl: webhookUrl.substring(0, 100) + '...',
        webhookUrlLength: webhookUrl.length,
        instanceName: config.instance_name,
        hasApiKey: !!config.api_key,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key,
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

      // Capturar resposta de erro completa
      if (!response.ok) {
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;
        let errorDetails: any = null;
        
        try {
          const errorData = await response.text();
          if (errorData) {
            try {
              const parsed = JSON.parse(errorData);
              errorMessage = parsed.message || parsed.error || parsed.detail || errorMessage;
              errorDetails = parsed;
            } catch {
              errorMessage = errorData.length > 200 ? errorData.substring(0, 200) + '...' : errorData;
            }
          }
        } catch (e) {
          // Se não conseguir ler o erro, usar mensagem padrão
        }
        
        console.error('❌ Erro ao configurar webhook:', {
          status: response.status,
          statusText: response.statusText,
          message: errorMessage,
          endpoint,
          errorDetails,
          webhookUrlLength: webhookUrl.length,
          instanceName: config.instance_name,
        });

        // Mensagens mais específicas baseadas no status
        if (response.status === 400) {
          // Bad Request - pode ser URL inválida, instância não existe, ou payload incorreto
          let specificMessage = 'Requisição inválida. ';
          
          if (errorMessage.includes('instance') || errorMessage.includes('not found')) {
            specificMessage += 'A instância pode não existir ou não estar conectada. Verifique se o WhatsApp está conectado.';
          } else if (errorMessage.includes('url') || errorMessage.includes('webhook')) {
            specificMessage += 'A URL do webhook pode estar inválida ou muito longa.';
          } else if (errorMessage.includes('apikey') || errorMessage.includes('key')) {
            specificMessage += 'A API Key pode estar inválida ou expirada. Verifique as credenciais.';
          } else {
            specificMessage += errorMessage || 'Verifique se a instância existe e está conectada.';
          }
          
          throw new Error(specificMessage);
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('API Key inválida ou sem permissão. Verifique as credenciais.');
        } else if (response.status === 404) {
          throw new Error('Instância não encontrada. Verifique se o nome da instância está correto e se o WhatsApp está conectado.');
        } else {
          throw new Error(`Erro ao configurar webhook: ${errorMessage}`);
        }
      }

      const responseData = await response.json().catch(() => ({}));
      console.log('✅ Webhook configurado com sucesso:', responseData);

      toast({
        title: "✅ Webhook configurado",
        description: `Webhook configurado para instância ${config.instance_name}.`,
      });

      return true;
    } catch (error: any) {
      console.error('❌ Erro completo ao configurar webhook:', error);
      toast({
        title: "❌ Erro ao configurar webhook",
        description: error.message || 'Erro desconhecido ao configurar webhook',
        variant: "destructive",
      });
      return false;
    }
  };

  const testConnection = async (config: EvolutionConfig) => {
    try {
      const result = await fetchEvolutionConnectionStateByConfigId(config.id);

      if (result.edgeError || result.proxyError) {
        const reason = result.proxyError === 'timeout' ? 'Tempo esgotado' : (result.edgeError || result.proxyError || 'Erro de rede');
        toast({
          title: '❌ Falha ao conectar',
          description: reason,
          variant: 'destructive',
        });
        return { success: false, httpStatus: null, details: reason, isConnected: false };
      }

      const status = result.evolutionHttpStatus ?? 0;

      if (!result.evolutionOk) {
        const text = typeof result.body === 'string' ? result.body : JSON.stringify(result.body ?? '');
        const reason = status === 401
          ? 'API Key inválida'
          : status === 404
          ? 'Instância não encontrada'
          : `Erro HTTP ${status}`;

        toast({
          title: '❌ Falha ao conectar',
          description: `${reason}. ${String(text).slice(0, 100)}`,
          variant: 'destructive',
        });

        await supabase.from('evolution_config').update({ is_connected: false, updated_at: new Date().toISOString() }).eq('id', config.id);
        return { success: false, httpStatus: status, details: text };
      }

      const normalized = extractConnectionState(result.body);
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
      return { success: true, httpStatus: status, details: result.body, isConnected };
    } catch (error: any) {
      console.warn('⚠️ Erro ao testar conexão (via servidor):', {
        message: error?.message,
        instance: config.instance_name,
      });
      
      toast({
        title: '❌ Erro ao testar conexão',
        description: error.message || 'Erro desconhecido ao conectar com Evolution API',
        variant: 'destructive',
      });
      return { success: false, httpStatus: null, details: error.message, isConnected: false };
    }
  };

  const refreshStatuses = useCallback(async () => {
    const results = await Promise.allSettled(
      configs.map(async (cfg) => {
        try {
          const r = await fetchEvolutionConnectionStateByConfigId(cfg.id);
          if (r.edgeError || r.proxyError) {
            return { id: cfg.id, ok: false, error: r.edgeError || r.proxyError };
          }
          if (!r.evolutionOk) {
            return { id: cfg.id, ok: false, error: `HTTP ${r.evolutionHttpStatus}` };
          }
          const normalized = extractConnectionState(r.body);
          const isConnected = normalized === true;
          if (cfg.is_connected !== isConnected) {
            await supabase
              .from('evolution_config')
              .update({ is_connected: isConnected, updated_at: new Date().toISOString() })
              .eq('id', cfg.id);
          }
          return { id: cfg.id, ok: isConnected };
        } catch (e: any) {
          return { id: cfg.id, ok: false, error: e?.message || 'Erro' };
        }
      })
    );

    await fetchConfigs();
    const connected = results.filter((r: any) => r.status === 'fulfilled' && r.value.ok).length;
    const total = results.length;
    return { connected, total };
  }, [configs, fetchConfigs]);

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
