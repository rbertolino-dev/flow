import { useState } from "react";
import { useEvolutionConfig } from "@/hooks/useEvolutionConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Webhook, CheckCircle, AlertCircle, HelpCircle, ExternalLink, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { WebhookTestPanel } from "@/components/crm/WebhookTestPanel";
import { SendTestMessagePanel } from "@/components/crm/SendTestMessagePanel";

export default function Settings() {
  const { config, loading, saveConfig, configureWebhook, testConnection, verifyIntegration } = useEvolutionConfig();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    api_url: config?.api_url || '',
    api_key: config?.api_key || '',
    instance_name: config?.instance_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin) + '/functions/v1/evolution-webhook';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const success = await saveConfig(formData);
    if (success) {
      // Após salvar, configurar o webhook automaticamente
      await configureWebhook();
    }
    setSaving(false);
  };

  const handleTestConnection = async () => {
    await testConnection();
  };

  const handleVerifyIntegration = async () => {
    setVerifying(true);
    const results = await verifyIntegration();
    setVerificationResults(results);
    setVerifying(false);
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="p-6 border-b border-border">
        <h1 className="text-3xl font-bold mb-2">Configurações</h1>
        <p className="text-muted-foreground">
          Configure a integração com Evolution API para receber mensagens do WhatsApp
        </p>
      </div>

      <div className="p-6 max-w-4xl space-y-6">
        {/* Tutorial Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Tutorial de Configuração
            </CardTitle>
            <CardDescription>
              Siga este guia passo a passo para configurar a Evolution API e começar a receber leads automaticamente via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                    <span>O que é Evolution API?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <p className="text-muted-foreground">
                    Evolution API é uma solução open-source que permite integrar o WhatsApp com aplicações através de APIs REST. 
                    Ela funciona como uma ponte entre o WhatsApp Web e sua aplicação.
                  </p>
                  <Alert>
                    <AlertTitle>Principais recursos</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Envio e recebimento de mensagens</li>
                        <li>Webhooks para eventos em tempo real</li>
                        <li>Suporte a múltiplas instâncias</li>
                        <li>Gerenciamento de grupos</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                    <span>Como obter uma instância Evolution API</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Opção 1: Hospedagem própria</h4>
                    <p className="text-sm text-muted-foreground">
                      Você pode hospedar a Evolution API no seu próprio servidor seguindo a documentação oficial.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://doc.evolution-api.com/v2/pt/get-started/introduction" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Documentação Evolution API
                      </a>
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Opção 2: Serviços gerenciados</h4>
                    <p className="text-sm text-muted-foreground">
                      Existem diversos provedores que oferecem Evolution API como serviço gerenciado, facilitando a configuração inicial.
                    </p>
                  </div>

                  <Alert>
                    <AlertTitle>Requisitos mínimos</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                        <li>Servidor com Node.js 18+ ou Docker</li>
                        <li>Banco de dados (PostgreSQL ou MongoDB)</li>
                        <li>URL pública acessível (HTTPS recomendado)</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                    <span>Criar e configurar uma instância</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <p className="font-semibold text-sm">1. Criar instância via API</p>
                      <p className="text-sm text-muted-foreground">Faça uma requisição POST para criar uma nova instância:</p>
                      <pre className="p-3 bg-background rounded text-xs overflow-x-auto">
{`POST https://sua-api.com/instance/create
Headers:
  apikey: SUA_API_KEY_GLOBAL

Body:
{
  "instanceName": "minha-instancia",
  "token": "token-opcional",
  "qrcode": true
}`}
                      </pre>
                    </div>

                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <p className="font-semibold text-sm">2. Conectar WhatsApp</p>
                      <p className="text-sm text-muted-foreground">
                        Após criar a instância, você receberá um QR Code. Escaneie-o com o WhatsApp para conectar.
                      </p>
                    </div>

                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <p className="font-semibold text-sm">3. Verificar conexão</p>
                      <pre className="p-3 bg-background rounded text-xs overflow-x-auto">
{`GET https://sua-api.com/instance/connectionState/minha-instancia
Headers:
  apikey: SUA_API_KEY`}
                      </pre>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
                    <span>Configurar no CRM</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <Alert>
                    <AlertTitle>Informações necessárias</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                        <li><strong>URL da API:</strong> O endereço base da sua Evolution API (ex: https://api.exemplo.com)</li>
                        <li><strong>API Key:</strong> A chave de autenticação global ou da instância</li>
                        <li><strong>Nome da Instância:</strong> O nome único que você criou para sua instância</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Preencha os campos no formulário abaixo com estas informações. 
                      Ao salvar, o sistema configurará automaticamente o webhook para receber mensagens.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">5</span>
                    <span>Como funciona a integração</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="p-4 border-l-4 border-primary bg-muted/50 rounded">
                      <p className="font-semibold text-sm mb-2">📱 Nova mensagem recebida</p>
                      <p className="text-sm text-muted-foreground">
                        Quando alguém envia uma mensagem para seu WhatsApp, a Evolution API envia os dados para o webhook do CRM.
                      </p>
                    </div>

                    <div className="p-4 border-l-4 border-primary bg-muted/50 rounded">
                      <p className="font-semibold text-sm mb-2">🔍 Verificação de lead</p>
                      <p className="text-sm text-muted-foreground">
                        O sistema verifica se já existe um lead com aquele número de telefone.
                      </p>
                    </div>

                    <div className="p-4 border-l-4 border-primary bg-muted/50 rounded">
                      <p className="font-semibold text-sm mb-2">✨ Lead novo</p>
                      <p className="text-sm text-muted-foreground">
                        Se não existir, cria um novo lead na etapa "Novo Lead" com o nome do contato e número.
                      </p>
                    </div>

                    <div className="p-4 border-l-4 border-primary bg-muted/50 rounded">
                      <p className="font-semibold text-sm mb-2">💬 Atividade registrada</p>
                      <p className="text-sm text-muted-foreground">
                        A mensagem é registrada como atividade no histórico do lead, incluindo horário e conteúdo.
                      </p>
                    </div>

                    <div className="p-4 border-l-4 border-primary bg-muted/50 rounded">
                      <p className="font-semibold text-sm mb-2">🔔 Notificação em tempo real</p>
                      <p className="text-sm text-muted-foreground">
                        O CRM é atualizado automaticamente e você vê o novo lead ou atividade imediatamente.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">6</span>
                    <span>Solução de problemas</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-sm mb-1">❌ Erro: "Cannot configure webhook"</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                        <li>Verifique se a URL da API está correta</li>
                        <li>Confirme que a API Key é válida</li>
                        <li>Certifique-se de que a instância existe e está conectada</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-sm mb-1">❌ Leads não estão sendo criados</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                        <li>Verifique se o WhatsApp está conectado (ícone verde)</li>
                        <li>Confirme se o webhook está configurado corretamente na Evolution API</li>
                        <li>Teste enviando uma mensagem e verificando os logs</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-sm mb-1">❌ Status mostra "Desconectado"</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                        <li>Escaneie o QR Code novamente no WhatsApp</li>
                        <li>Verifique se o telefone tem internet estável</li>
                        <li>Reinicie a instância na Evolution API se necessário</li>
                      </ul>
                    </div>
                  </div>

                  <Alert>
                    <AlertTitle>Precisa de ajuda?</AlertTitle>
                    <AlertDescription>
                      Consulte a documentação completa da Evolution API ou entre em contato com o suporte.
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Evolution API
                </CardTitle>
                <CardDescription className="mt-2">
                  Configure sua instância da Evolution API para receber mensagens automaticamente
                </CardDescription>
              </div>
              {config?.is_connected ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Desconectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api_url">URL da API</Label>
                <Input
                  id="api_url"
                  placeholder="https://sua-api.com"
                  value={formData.api_url}
                  onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  URL base da sua instância Evolution API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  placeholder="Sua API Key"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Chave de API para autenticação
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instance_name">Nome da Instância</Label>
                <Input
                  id="instance_name"
                  placeholder="minha-instancia"
                  value={formData.instance_name}
                  onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Nome da instância do WhatsApp na Evolution API
                </p>
              </div>

              {config?.qr_code && (
                <div className="space-y-2">
                  <Label>QR Code</Label>
                  <div className="border rounded-lg p-4 bg-white">
                    <img 
                      src={config.qr_code} 
                      alt="QR Code WhatsApp" 
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Escaneie este QR Code com o WhatsApp para conectar
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Configuração
                </Button>
                
                {config && (
                  <>
                    <Button type="button" variant="outline" onClick={handleTestConnection}>
                      Testar Conexão
                    </Button>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={handleVerifyIntegration}
                      disabled={verifying}
                    >
                      {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verificar Integração Completa
                    </Button>
                  </>
                )}
              </div>

              {verificationResults && verificationResults.steps.length > 0 && (
                <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    {verificationResults.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    Resultados da Verificação
                  </h3>
                  <div className="space-y-2">
                    {verificationResults.steps.map((step: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5">
                          {step.status === "success" && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          {step.status === "error" && (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          {step.status === "warning" && (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                          )}
                          {step.status === "loading" && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{step.step}</p>
                          {step.message && (
                            <p className="text-muted-foreground text-xs">{step.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {config && (
              <div className="mt-6 p-4 border border-primary/20 bg-primary/5 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Webhook className="h-5 w-5 text-primary" />
                    URL do Webhook
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copyWebhookUrl}
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Esta é a URL pública do seu webhook. Use-a para configurar na Evolution API:
                </p>
                <div className="relative">
                  <code className="block p-3 bg-background border rounded-md text-xs break-all font-mono">
                    {webhookUrl}
                  </code>
                </div>
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    💡 <strong>Dica:</strong> O webhook é configurado automaticamente ao salvar as configurações. 
                    Use o botão "Verificar Integração Completa" para confirmar que tudo está funcionando.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Test Message Panel */}
        {config && <SendTestMessagePanel config={config} />}

        {/* Webhook Test Panel */}
        {config && <WebhookTestPanel config={config} />}
      </div>
    </div>
  );
}