import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Info, AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChatwootWebhookSetupProps {
  organizationId: string;
}

export const ChatwootWebhookSetup = ({ organizationId }: ChatwootWebhookSetupProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  // Buscar configuração da Evolution API
  const { data: evolutionConfigs, isLoading: loadingEvolution, refetch: refetchEvolution } = useQuery({
    queryKey: ['evolution-configs', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evolution_config')
        .select('*')
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Buscar configuração do Chatwoot
  const { data: chatwootConfig, isLoading: loadingChatwoot, refetch: refetchChatwoot } = useQuery({
    queryKey: ['chatwoot-config', organizationId],
    queryFn: async () => {
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

  const isLoading = loadingEvolution || loadingChatwoot;

  // Análise do status
  const hasEvolutionWithWebhook = evolutionConfigs?.some(config => config.webhook_enabled);
  const hasChatwootEnabled = chatwootConfig?.enabled;
  const evolutionApiUrl = evolutionConfigs?.[0]?.api_url;
  const chatwootBaseUrl = chatwootConfig?.chatwoot_base_url;
  
  // Verificar se estão conectados
  const areConnected = hasEvolutionWithWebhook && hasChatwootEnabled;

  const handleRefresh = () => {
    refetchEvolution();
    refetchChatwoot();
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle>Status da Integração</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Verificação automática da configuração Evolution + Chatwoot
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Geral */}
        {areConnected ? (
          <Alert className="bg-green-500/10 border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertDescription className="space-y-2">
              <div>
                <p className="font-semibold text-green-700 dark:text-green-300 mb-2">
                  ✓ Sistema configurado corretamente!
                </p>
                <p className="text-sm text-green-600/80 dark:text-green-400/80">
                  Evolution API com webhook ativo e Chatwoot habilitado. Mensagens em tempo real funcionando!
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="space-y-2">
              <div>
                <p className="font-semibold mb-2">
                  ⚠️ Configuração incompleta
                </p>
                <p className="text-sm">
                  Verifique as configurações abaixo e corrija os itens pendentes.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}


        {/* Checklist Detalhado - Colapsável */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Checklist de Configuração:</p>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Mostrar Detalhes
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="space-y-3 mt-3">
            {/* Evolution API */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              {hasEvolutionWithWebhook ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1 min-w-0">
                <p className="font-medium text-sm">Evolution API com Webhook</p>
                {hasEvolutionWithWebhook ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {evolutionConfigs?.filter(c => c.webhook_enabled).length} instância(s) com webhook ativo
                    </p>
                    {evolutionApiUrl && (
                      <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                        {evolutionApiUrl}
                      </code>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Nenhuma instância Evolution com webhook habilitado. Configure em Configurações → WhatsApp
                  </p>
                )}
              </div>
              {hasEvolutionWithWebhook && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300 flex-shrink-0">
                  OK
                </Badge>
              )}
            </div>

            {/* Chatwoot */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              {hasChatwootEnabled ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1 min-w-0">
                <p className="font-medium text-sm">Chatwoot Habilitado</p>
                {hasChatwootEnabled ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Conta ID: {chatwootConfig?.chatwoot_account_id}
                    </p>
                    {chatwootBaseUrl && (
                      <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                        {chatwootBaseUrl}
                      </code>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Chatwoot não está habilitado. Configure em Configurações → Chatwoot
                  </p>
                )}
              </div>
              {hasChatwootEnabled && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300 flex-shrink-0">
                  OK
                </Badge>
              )}
            </div>

            {/* Conexão Evolution + Chatwoot */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              {areConnected ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1 min-w-0">
                <p className="font-medium text-sm">Integração Ativa</p>
                {areConnected ? (
                  <p className="text-xs text-muted-foreground">
                    Evolution e Chatwoot estão conectados e funcionando em tempo real
                  </p>
                ) : (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Ambos precisam estar habilitados para a integração funcionar
                  </p>
                )}
              </div>
              {areConnected && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300 flex-shrink-0">
                  OK
                </Badge>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Como Funciona */}
        <Alert className="bg-primary/5 border-primary/20">
          <AlertDescription className="text-sm space-y-3">
            <div>
              <p className="font-semibold mb-2 flex items-center gap-2">
                📱 Como Funciona
              </p>
              <div className="ml-4 space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-xl">1️⃣</span>
                  <span>Cliente envia mensagem no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">2️⃣</span>
                  <span>Evolution API recebe a mensagem</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">3️⃣</span>
                  <span>Evolution API notifica o Chatwoot</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">4️⃣</span>
                  <span>Evolution API também notifica nosso webhook</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    Lead criado automaticamente no funil!
                  </span>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>


        {/* Informação Técnica - Colapsável */}
        <Collapsible open={showTechnical} onOpenChange={setShowTechnical}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Informações Técnicas</p>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-8">
                {showTechnical ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-2">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Organization ID:</span>
                  <code className="bg-background px-2 py-0.5 rounded text-[10px]">{organizationId}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span>Instâncias Evolution:</span>
                  <Badge variant="outline" className="text-[10px] h-5">{evolutionConfigs?.length || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Webhook Evolution:</span>
                  <code className="bg-background px-2 py-0.5 rounded text-[10px]">
                    /v1/evolution-webhook
                  </code>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
