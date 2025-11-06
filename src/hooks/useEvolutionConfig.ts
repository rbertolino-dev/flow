import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EvolutionConfig {
  id: string;
  user_id: string;
  api_url: string;
  api_key: string | null;
  instance_name: string;
  phone_number: string | null;
  is_connected: boolean;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
}

export function useEvolutionConfig() {
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('evolution-config-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_config'
        },
        () => {
          fetchConfig();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Helpers for Evolution API integration
  const normalizeApiUrl = (url: string) => {
    try {
      const u = new URL(url);
      // Remove trailing slash and common dashboard suffixes like /manager
      let base = u.origin + u.pathname.replace(/\/$/, '');
      base = base.replace(/\/(manager|dashboard|app)$/, '');
      return base;
    } catch {
      return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/, '');
    }
  };

  const buildApiPath = (path: string) => {
    const base = normalizeApiUrl(config?.api_url || '');
    const sep = path.startsWith('/') ? '' : '/';
    return `${base}${sep}${path}`;
  };

  const parseJsonSafe = async (response: Response) => {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) return response.json();
    const text = await response.text();
    throw new Error(`Resposta não JSON da API. Verifique a URL base. Prévia: ${text.slice(0, 120)}`);
  };

  const fetchConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('evolution_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setConfig(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configuração",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configData: {
    api_url: string;
    api_key: string;
    instance_name: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const configPayload = {
        user_id: user.id,
        api_url: normalizeApiUrl(configData.api_url),
        api_key: configData.api_key,
        instance_name: configData.instance_name,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Atualizar configuração existente
        const { error } = await (supabase as any)
          .from('evolution_config')
          .update(configPayload)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Criar nova configuração
        const { error } = await (supabase as any)
          .from('evolution_config')
          .insert(configPayload);

        if (error) throw error;
      }

      // Verificar se foi salvo no banco
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: savedConfig, error: checkError } = await (supabase as any)
        .from('evolution_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (checkError || !savedConfig) {
        throw new Error("Erro ao verificar salvamento no banco de dados");
      }

      toast({
        title: "✅ Configuração salva",
        description: "As configurações foram salvas e verificadas no banco de dados.",
      });

      await fetchConfig();
      return true;
    } catch (error: any) {
      toast({
        title: "❌ Erro ao salvar configuração",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const configureWebhook = async (override?: { api_url: string; api_key?: string | null; instance_name: string; }) => {
    const cfg = override || config;
    if (!cfg) return false;

    try {
      const functionsBase = (import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin;
      const webhookUrl = `${functionsBase}/functions/v1/evolution-webhook`;

      const response = await fetch(`${normalizeApiUrl(cfg.api_url)}/webhook/set/${cfg.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.api_key || '',
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
        description: "O webhook foi configurado com sucesso na Evolution API.",
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

  const testConnection = async () => {
    if (!config) return { success: false, details: null };

    try {
      const response = await fetch(buildApiPath(`/instance/connectionState/${config.instance_name}`), {
        headers: {
          'apikey': config.api_key || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await parseJsonSafe(response);

      const isConnected = data.state === 'open';
      
      toast({
        title: isConnected ? "✅ Conexão bem-sucedida" : "⚠️ WhatsApp desconectado",
        description: isConnected 
          ? `Instância "${config.instance_name}" está conectada e funcionando`
          : `Status: ${data.state || 'Desconhecido'}. Escaneie o QR Code para conectar.`,
        variant: isConnected ? "default" : "destructive",
      });

      return {
        success: true,
        details: {
          state: data.state,
          instance: data.instance,
          connected: isConnected,
        }
      };
    } catch (error: any) {
      toast({
        title: "❌ Erro ao testar conexão",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, details: null };
    }
  };

  const verifyIntegration = async () => {
    if (!config) {
      toast({
        title: "❌ Configuração não encontrada",
        description: "Configure a Evolution API primeiro.",
        variant: "destructive",
      });
      return { success: false, steps: [] };
    }

    const steps = [];

    // Step 1: Test API Connection
    steps.push({ step: "Testando conexão com API...", status: "loading" });
    
    try {
      const response = await fetch(buildApiPath(`/instance/connectionState/${config.instance_name}`), {
        headers: {
          'apikey': config.api_key || '',
        },
      });

      if (!response.ok) {
        steps[0] = { step: "Conexão com API", status: "error", message: `HTTP ${response.status}` };
        toast({
          title: "❌ Falha na conexão",
          description: "Verifique a URL da API e a API Key.",
          variant: "destructive",
        });
        return { success: false, steps };
      }

      const data = await parseJsonSafe(response);
      steps[0] = { 
        step: "Conexão com API", 
        status: "success", 
        message: "API respondendo corretamente" 
      };

      // Step 2: Check WhatsApp Connection
      const whatsappState = data.instance?.state || data.state;
      const isConnected = whatsappState === 'open';
      steps.push({
        step: "Status do WhatsApp",
        status: isConnected ? "success" : "warning",
        message: isConnected ? "WhatsApp conectado" : `Status: ${whatsappState || 'Desconhecido'}`,
      });

      // Step 3: Check Webhook Configuration
      steps.push({ step: "Verificando webhook...", status: "loading" });
      
      try {
        const webhookResponse = await fetch(buildApiPath(`/webhook/find/${config.instance_name}`), {
          headers: {
            'apikey': config.api_key || '',
          },
        });

        if (webhookResponse.ok) {
          const webhookData = await parseJsonSafe(webhookResponse);
          const webhookConfigured = webhookData?.url?.includes('evolution-webhook');
          
          steps[2] = {
            step: "Configuração do webhook",
            status: webhookConfigured ? "success" : "warning",
            message: webhookConfigured 
              ? "Webhook configurado corretamente" 
              : "Webhook não configurado ou URL incorreta",
          };
        } else {
          steps[2] = {
            step: "Configuração do webhook",
            status: "warning",
            message: "Não foi possível verificar o webhook",
          };
        }
      } catch {
        steps[2] = {
          step: "Configuração do webhook",
          status: "warning",
          message: "Não foi possível verificar o webhook",
        };
      }

      // Step 4: Database Connection
      steps.push({
        step: "Conexão com banco de dados",
        status: "success",
        message: "Configuração salva no banco",
      });

      const allSuccess = steps.every(s => s.status === "success");
      
      toast({
        title: allSuccess ? "✅ Integração funcionando!" : "⚠️ Integração parcial",
        description: allSuccess 
          ? "Todos os testes passaram com sucesso. Pronto para receber leads!"
          : "Alguns itens precisam de atenção. Verifique os detalhes.",
        variant: allSuccess ? "default" : "destructive",
      });

      return { success: allSuccess, steps };

    } catch (error: any) {
      steps[0] = { step: "Conexão com API", status: "error", message: error.message };
      toast({
        title: "❌ Erro na verificação",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, steps };
    }
  };

  return {
    config,
    loading,
    saveConfig,
    configureWebhook,
    testConnection,
    verifyIntegration,
    refetch: fetchConfig,
  };
}