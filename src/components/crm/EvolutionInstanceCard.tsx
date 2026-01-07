import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, TestTube2, Webhook, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, Key, Wifi } from "lucide-react";
import { useState, useEffect } from "react";
import { EvolutionInstanceDetails } from "./EvolutionInstanceDetails";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { useToast } from "@/hooks/use-toast";
import { extractConnectionState } from "@/lib/evolutionStatus";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { ReconnectInstanceDialog } from "./ReconnectInstanceDialog";

interface EvolutionInstanceCardProps {
  config: EvolutionConfig;
  onEdit: (config: EvolutionConfig) => void;
  onDelete: (id: string) => void;
  onToggleWebhook: (id: string, enabled: boolean) => void;
  onTest: (config: EvolutionConfig) => void;
  onConfigureWebhook: (config: EvolutionConfig) => void;
  onRefresh?: () => void;
}

export function EvolutionInstanceCard({
  config,
  onEdit,
  onDelete,
  onToggleWebhook,
  onTest,
  onConfigureWebhook,
  onRefresh,
}: EvolutionInstanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [realStatus, setRealStatus] = useState<boolean | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkHasProvider();
  }, []);

  const checkHasProvider = async () => {
    try {
      const orgId = await getUserOrganizationId();
      if (!orgId) return;

      const { data, error } = await supabase.rpc('organization_has_evolution_provider' as any, {
        _org_id: orgId,
      });

      if (!error && data) {
        setHasProvider(true);
      }
    } catch (error) {
      // Silenciosamente falhar - não é crítico
      console.error('Erro ao verificar provider:', error);
    }
  };

  const syncApiKey = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Iniciando sincronização da API Key para:', config.instance_name);
      
      // Tentar múltiplos endpoints para buscar a instância
      const endpoints = [
        `${config.api_url}/instance/fetchInstances?instanceName=${config.instance_name}`,
        `${config.api_url}/instance/fetchInstances/${config.instance_name}`,
        `${config.api_url}/instance/fetchInstances`,
      ];

      let instanceData: any = null;
      let responseData: any = null;

      // Tentar cada endpoint até conseguir dados
      for (const endpoint of endpoints) {
        try {
          console.log('📡 Tentando endpoint:', endpoint);
          const response = await fetch(endpoint, {
            headers: {
              'apikey': config.api_key || ''
            }
          });

          if (!response.ok) {
            console.log(`⚠️ Endpoint ${endpoint} retornou status ${response.status}`);
            continue;
          }

          responseData = await response.json();
          console.log('📦 Resposta recebida do endpoint:', endpoint, responseData);

          // Tentar extrair a instância de diferentes formatos
          if (Array.isArray(responseData)) {
            instanceData = responseData.find((i: any) => 
              i.instance?.instanceName === config.instance_name || 
              i.instanceName === config.instance_name ||
              i.name === config.instance_name
            );
          } else if (responseData.instance?.instanceName === config.instance_name) {
            instanceData = responseData;
          } else if (responseData.instanceName === config.instance_name) {
            instanceData = responseData;
          } else if (responseData.name === config.instance_name) {
            instanceData = responseData;
          }

          if (instanceData) {
            console.log('✅ Instância encontrada:', instanceData);
            break;
          }
        } catch (endpointError) {
          console.error(`❌ Erro no endpoint ${endpoint}:`, endpointError);
          continue;
        }
      }

      if (!instanceData) {
        console.error('❌ Instância não encontrada em nenhum endpoint. Última resposta:', responseData);
        throw new Error('Instância não encontrada na Evolution API. Verifique se o nome da instância está correto.');
      }

      // Tentar extrair apikey de múltiplas localizações possíveis
      const newApiKey = 
        instanceData.instance?.apikey || 
        instanceData.instance?.token ||
        instanceData.instance?.api_key ||
        instanceData.apikey || 
        instanceData.token ||
        instanceData.api_key ||
        instanceData.hash?.apikey;

      if (!newApiKey) {
        console.error('❌ API Key não encontrada. Estrutura da instância:', instanceData);
        throw new Error('API Key não encontrada na instância. A estrutura de resposta da API pode ter mudado.');
      }

      console.log('🔑 Nova API Key encontrada:', newApiKey.substring(0, 15) + '...');

      // Verificar se a API Key é diferente
      if (newApiKey === config.api_key) {
        toast({
          title: "API Key já está atualizada ✓",
          description: "A API Key no banco já corresponde à da Evolution API",
        });
        return;
      }

      // Atualizar no banco de dados
      const { error } = await supabase
        .from('evolution_config')
        .update({ 
          api_key: newApiKey,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) {
        console.error('❌ Erro ao atualizar no banco:', error);
        throw error;
      }

      console.log('✅ API Key atualizada no banco com sucesso');

      toast({
        title: "API Key sincronizada ✓",
        description: "A API Key foi atualizada com sucesso",
      });

      // Refresh para atualizar a tela
      onRefresh?.();
    } catch (error: any) {
      console.error('❌ Erro completo ao sincronizar:', error);
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Não foi possível sincronizar a API Key",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const checkRealStatus = async () => {
    setTesting(true);
    try {
      // Normalizar URL da API usando a mesma função que outros lugares usam
      const normalizeApiUrl = (url: string) => {
        try {
          const u = new URL(url);
          let base = u.origin + u.pathname.replace(/\/$/, '');
          base = base.replace(/\/(manager|dashboard|app)$/i, '');
          return base;
        } catch {
          return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/i, '');
        }
      };
      
      const baseUrl = normalizeApiUrl(config.api_url);
      const url = `${baseUrl}/instance/connectionState/${config.instance_name}`;
      
      console.log(`🔍 Verificando status real da instância ${config.instance_name}...`);
      console.log(`📍 API URL original: ${config.api_url}`);
      console.log(`📍 API URL normalizada: ${baseUrl}`);
      console.log(`📍 URL completa: ${url}`);
      
      if (!config.api_url || !config.instance_name) {
        throw new Error('URL da API ou nome da instância não configurados');
      }
      
      const response = await fetch(url, {
        headers: {
          'apikey': config.api_key || ''
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 404) {
          errorMessage = `Instância "${config.instance_name}" não encontrada na Evolution API. Verifique:\n- Se o nome da instância está correto (case-sensitive)\n- Se a URL da API está correta: ${baseUrl}\n- Se a instância existe na Evolution API`;
        } else if (response.status === 401) {
          errorMessage = `API Key inválida ou expirada. Verifique a API Key configurada.`;
        } else if (response.status === 403) {
          errorMessage = `Acesso negado. Verifique se a API Key tem permissão para acessar esta instância.`;
        }
        
        console.error(`❌ Erro HTTP ${response.status}:`, errorText);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`📦 Resposta da API:`, data);
      
      const isConnected = extractConnectionState(data) === true;
      console.log(`✅ Status extraído: ${isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
      
      setRealStatus(isConnected);

      // ATUALIZAR NO BANCO se o status mudou
      if (isConnected !== config.is_connected) {
        console.log(`🔄 Atualizando status no banco: ${config.is_connected} → ${isConnected}`);
        
        const { error: updateError } = await supabase
          .from('evolution_config')
          .update({ 
            is_connected: isConnected,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id);

        if (updateError) {
          console.error('❌ Erro ao atualizar status no banco:', updateError);
          toast({
            title: "Status verificado, mas erro ao atualizar",
            description: `Status real: ${isConnected ? 'Conectado' : 'Desconectado'}, mas não foi possível atualizar no banco.`,
            variant: "default"
          });
        } else {
          console.log('✅ Status atualizado no banco com sucesso!');
          // Atualizar lista para refletir mudança
          onRefresh?.();
          
          toast({
            title: isConnected ? "✅ Conectado e atualizado!" : "❌ Desconectado e atualizado",
            description: isConnected 
              ? "A instância está conectada e o status foi atualizado no sistema" 
              : "A instância não está conectada e o status foi atualizado no sistema",
            variant: isConnected ? "default" : "destructive"
          });
        }
      } else {
        // Status já está correto no banco
        toast({
          title: isConnected ? "✅ Conectado" : "❌ Desconectado",
          description: isConnected 
            ? "A instância está conectada e o status está correto" 
            : "A instância não está conectada ao WhatsApp",
          variant: isConnected ? "default" : "destructive"
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao verificar status:', error);
      setRealStatus(false);
      
      // Se estava marcado como conectado mas não conseguiu verificar, pode estar desconectado
      if (config.is_connected) {
        console.log('⚠️ Instância estava marcada como conectada, mas verificação falhou. Atualizando para desconectado...');
        
        const { error: updateError } = await supabase
          .from('evolution_config')
          .update({ 
            is_connected: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id);
          
        if (!updateError) {
          onRefresh?.();
        }
      }
      
      toast({
        title: "Erro ao verificar status",
        description: error.message || "Não foi possível conectar à API Evolution",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const displayStatus = realStatus !== null ? realStatus : config.is_connected;

  return (
    <div className="space-y-0">
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="truncate">{config.instance_name}</span>
              {displayStatus ? (
                <Badge variant="default" className="gap-1 w-fit">
                  <CheckCircle className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 w-fit">
                  <XCircle className="h-3 w-3" />
                  Desconectado
                </Badge>
              )}
            </CardTitle>
            {/* Esconder URL quando há provider configurado pelo super admin */}
            {!hasProvider && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{config.api_url}</p>
            )}
            {hasProvider && (
              <p className="text-xs sm:text-sm text-muted-foreground italic">
                Provider gerenciado pela administração
              </p>
            )}
            {config.phone_number && (
              <p className="text-xs text-muted-foreground">Tel: {config.phone_number}</p>
            )}
          </div>
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(config)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDelete(config.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={`webhook-${config.id}`} className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
            <Webhook className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Webhook Ativo</span>
            <span className="sm:hidden">Webhook</span>
          </Label>
          <Switch
            id={`webhook-${config.id}`}
            checked={config.webhook_enabled}
            onCheckedChange={(checked) => onToggleWebhook(config.id, checked)}
          />
        </div>

        {!displayStatus && (
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs sm:text-sm bg-primary"
            onClick={() => setShowReconnectDialog(true)}
          >
            <Wifi className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            Reconectar Instância
          </Button>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs sm:text-sm"
            onClick={checkRealStatus}
            disabled={testing}
          >
            {testing ? (
              <>
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="hidden sm:inline">Verificar Status Real</span>
                <span className="sm:hidden">Status</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs sm:text-sm"
            onClick={() => onTest(config)}
          >
            <TestTube2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            <span className="hidden sm:inline">Testar Conexão</span>
            <span className="sm:hidden">Testar</span>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs sm:text-sm"
            onClick={() => onConfigureWebhook(config)}
          >
            <Webhook className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            <span className="hidden sm:inline">Configurar Webhook</span>
            <span className="sm:hidden">Webhook</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs sm:text-sm"
            onClick={syncApiKey}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Key className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="hidden sm:inline">Sincronizar API Key</span>
                <span className="sm:hidden">Sync Key</span>
              </>
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs sm:text-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="hidden sm:inline">Ocultar Detalhes</span>
              <span className="sm:hidden">Ocultar</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="hidden sm:inline">Ver Logs, Webhook e Importar</span>
              <span className="sm:hidden">Detalhes</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>

    {expanded && <EvolutionInstanceDetails config={config} />}

    <ReconnectInstanceDialog
      open={showReconnectDialog}
      onOpenChange={setShowReconnectDialog}
      instance={config}
      onReconnected={() => {
        setShowReconnectDialog(false);
        onRefresh?.();
      }}
    />
    </div>
  );
}
