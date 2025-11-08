import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, TestTube2, Webhook, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { EvolutionInstanceDetails } from "./EvolutionInstanceDetails";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { useToast } from "@/hooks/use-toast";

interface EvolutionInstanceCardProps {
  config: EvolutionConfig;
  onEdit: (config: EvolutionConfig) => void;
  onDelete: (id: string) => void;
  onToggleWebhook: (id: string, enabled: boolean) => void;
  onTest: (config: EvolutionConfig) => void;
  onConfigureWebhook: (config: EvolutionConfig) => void;
}

export function EvolutionInstanceCard({
  config,
  onEdit,
  onDelete,
  onToggleWebhook,
  onTest,
  onConfigureWebhook,
}: EvolutionInstanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [realStatus, setRealStatus] = useState<boolean | null>(null);
  const { toast } = useToast();

  const checkRealStatus = async () => {
    setTesting(true);
    try {
      const response = await fetch(`${config.api_url}/instance/connectionState/${config.instance_name}`, {
        headers: {
          'apikey': config.api_key
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao verificar status');
      }

      const data = await response.json();
      const isConnected = data.state === 'open';
      setRealStatus(isConnected);

      toast({
        title: isConnected ? "Conectado ✓" : "Desconectado ✗",
        description: isConnected 
          ? "A instância está conectada e funcional" 
          : "A instância não está conectada ao WhatsApp",
        variant: isConnected ? "default" : "destructive"
      });
    } catch (error) {
      setRealStatus(false);
      toast({
        title: "Erro ao verificar status",
        description: "Não foi possível conectar à API Evolution",
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
                <Badge variant="secondary" className="gap-1 w-fit">
                  <XCircle className="h-3 w-3" />
                  Desconectado
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{config.api_url}</p>
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

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs sm:text-sm"
          onClick={() => onConfigureWebhook(config)}
        >
          <Webhook className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          <span className="hidden sm:inline">Configurar Webhook</span>
          <span className="sm:hidden">Webhook</span>
        </Button>

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
    </div>
  );
}
