import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Webhook, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ChatwootWebhookSetupProps {
  organizationId: string;
}

export const ChatwootWebhookSetup = ({ organizationId }: ChatwootWebhookSetupProps) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedOrgId, setCopiedOrgId] = useState(false);

  const webhookUrl = "https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/chatwoot-webhook";

  const copyToClipboard = async (text: string, type: 'url' | 'orgId') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedOrgId(true);
        setTimeout(() => setCopiedOrgId(false), 2000);
      }
      toast.success('Copiado para área de transferência!');
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <CardTitle>Configuração do Webhook</CardTitle>
        </div>
        <CardDescription>
          Configure o webhook no Chatwoot para receber mensagens em tempo real e criar leads automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL do Webhook */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">URL do Webhook</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(webhookUrl, 'url')}
              className="h-8"
            >
              {copiedUrl ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="relative">
            <code className="block p-3 bg-muted rounded-md text-xs break-all border">
              {webhookUrl}
            </code>
          </div>
        </div>

        {/* Organization ID */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Seu Organization ID</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(organizationId, 'orgId')}
              className="h-8"
            >
              {copiedOrgId ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="relative">
            <code className="block p-3 bg-primary/10 rounded-md text-xs break-all border border-primary/20 font-mono">
              {organizationId}
            </code>
          </div>
        </div>

        {/* Instruções */}
        <Alert className="bg-primary/5 border-primary/20">
          <AlertDescription className="text-sm space-y-3">
            <div>
              <p className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                Acesse o Chatwoot
              </p>
              <p className="ml-8 text-muted-foreground">
                Vá em <strong>Settings → Integrations → Webhooks</strong>
              </p>
            </div>

            <div>
              <p className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                Adicione novo Webhook
              </p>
              <p className="ml-8 text-muted-foreground">
                Cole a <strong>URL do Webhook</strong> acima no campo URL
              </p>
            </div>

            <div>
              <p className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                Selecione os Eventos
              </p>
              <div className="ml-8 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">☑ message_created</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">☑ conversation_updated</Badge>
                </div>
              </div>
            </div>

            <div>
              <p className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">4</span>
                Configure Custom Attributes
              </p>
              <div className="ml-8 space-y-2 text-muted-foreground">
                <p>Vá em <strong>Settings → Custom Attributes → Conversations</strong></p>
                <p>Crie um atributo chamado <code className="bg-muted px-1 rounded">organization_id</code></p>
                <p>Configure para que todas conversas recebam automaticamente o valor:</p>
                <code className="block mt-1 p-2 bg-muted rounded text-xs">{organizationId}</code>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Resultado */}
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-green-700 dark:text-green-300">
                Resultado Esperado
              </p>
              <p className="text-sm text-green-600/80 dark:text-green-400/80">
                ✓ Mensagens do Chatwoot criam leads automaticamente no funil<br />
                ✓ Atualizações em tempo real via WebSocket<br />
                ✓ Custo reduzido em 99.3% (sem polling HTTP)
              </p>
            </div>
          </div>
        </div>

        {/* Link para documentação */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open('https://www.chatwoot.com/docs/product/channels/live-chat/webhooks', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver Documentação do Chatwoot
        </Button>
      </CardContent>
    </Card>
  );
};
