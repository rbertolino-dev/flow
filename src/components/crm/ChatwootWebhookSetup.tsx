import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Info, ExternalLink } from "lucide-react";

interface ChatwootWebhookSetupProps {
  organizationId: string;
}

export const ChatwootWebhookSetup = ({ organizationId }: ChatwootWebhookSetupProps) => {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <CardTitle>Webhook e Tempo Real</CardTitle>
        </div>
        <CardDescription>
          Entenda como funciona a integração em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Explicação Principal */}
        <Alert className="bg-green-500/10 border-green-500/20">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <AlertDescription className="space-y-3">
            <div>
              <p className="font-semibold text-green-700 dark:text-green-300 mb-2">
                ✓ Seu sistema já está configurado!
              </p>
              <p className="text-sm text-green-600/80 dark:text-green-400/80">
                Como o Chatwoot está conectado à mesma Evolution API que você já configurou nas Configurações, 
                o webhook da Evolution JÁ recebe todas as mensagens e cria os leads automaticamente no funil.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Como Funciona */}
        <Alert className="bg-primary/5 border-primary/20">
          <AlertDescription className="text-sm space-y-3">
            <div>
              <p className="font-semibold mb-2 flex items-center gap-2">
                📱 Fluxo Atual (já funcionando)
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

        {/* Informação Adicional */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-2">
            <p className="font-semibold">Observações importantes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
              <li>Todas as suas instâncias Evolution usam o mesmo webhook configurado</li>
              <li>O Chatwoot não precisa de webhook separado pois está conectado à Evolution</li>
              <li>As mensagens aparecem em tempo real tanto no Chatwoot quanto no funil</li>
              <li>O custo é otimizado pois não há polling HTTP (WebSocket da Evolution)</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Informação Técnica (para referência) */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Informações Técnicas</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Organization ID:</span>
              <code className="bg-background px-2 py-0.5 rounded">{organizationId}</code>
            </div>
            <div className="flex justify-between">
              <span>Webhook Evolution:</span>
              <code className="bg-background px-2 py-0.5 rounded text-[10px]">
                /functions/v1/evolution-webhook
              </code>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">Ativo ✓</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
