import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, TestTube2, Webhook, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { EvolutionInstanceDetails } from "./EvolutionInstanceDetails";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";

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

  return (
    <div className="space-y-0">
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {config.instance_name}
              {config.is_connected ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Desconectado
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{config.api_url}</p>
            {config.phone_number && (
              <p className="text-xs text-muted-foreground">Tel: {config.phone_number}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(config)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(config.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={`webhook-${config.id}`} className="flex items-center gap-2 cursor-pointer">
            <Webhook className="h-4 w-4" />
            Webhook Ativo
          </Label>
          <Switch
            id={`webhook-${config.id}`}
            checked={config.webhook_enabled}
            onCheckedChange={(checked) => onToggleWebhook(config.id, checked)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onTest(config)}
          >
            <TestTube2 className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onConfigureWebhook(config)}
          >
            <Webhook className="h-4 w-4 mr-2" />
            Configurar Webhook
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Ocultar Detalhes
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Ver Logs, Webhook e Importar
            </>
          )}
        </Button>
      </CardContent>
    </Card>

    {expanded && <EvolutionInstanceDetails config={config} />}
    </div>
  );
}
