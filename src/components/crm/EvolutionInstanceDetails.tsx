import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, FileText, Webhook as WebhookIcon, Upload, MessageSquare } from "lucide-react";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { EvolutionLogsPanel } from "./EvolutionLogsPanel";
import { WebhookLogsPanel } from "./WebhookLogsPanel";
import { ImportContactsPanel } from "./ImportContactsPanel";
import { SendTestMessagePanel } from "./SendTestMessagePanel";
import { WebhookTestPanel } from "./WebhookTestPanel";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EvolutionInstanceDetailsProps {
  config: EvolutionConfig;
}

export function EvolutionInstanceDetails({ config }: EvolutionInstanceDetailsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const functionsBase = ((import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin);
  const webhookUrl = `${functionsBase}/functions/v1/evolution-webhook?secret=${encodeURIComponent(config.webhook_secret || config.api_key || '')}`;

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast({
        title: "URL copiada!",
        description: "A URL do webhook foi copiada para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a URL. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">
          Detalhes da Instância: {config.instance_name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="webhook" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="import">Importar</TabsTrigger>
            <TabsTrigger value="test">Testar</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger>
          </TabsList>

          <TabsContent value="webhook" className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyWebhookUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure esta URL no webhook da sua instância WhatsApp
              </p>
            </div>

            <WebhookLogsPanel />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <EvolutionLogsPanel />
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <ImportContactsPanel />
          </TabsContent>

          <TabsContent value="test" className="space-y-4">
            <SendTestMessagePanel config={config} />
          </TabsContent>

          <TabsContent value="diagnostics" className="space-y-4">
            <WebhookTestPanel config={config} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
