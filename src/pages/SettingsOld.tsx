import { useState, useEffect } from "react";
import { useEvolutionConfig } from "@/hooks/useEvolutionConfig";
import { useAutoSync } from "@/hooks/useAutoSync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Webhook, CheckCircle, AlertCircle, HelpCircle, ExternalLink, Copy, Check, RefreshCw, Tag as TagIcon, Layers, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { WebhookTestPanel } from "@/components/crm/WebhookTestPanel";
import { SendTestMessagePanel } from "@/components/crm/SendTestMessagePanel";
import { WebhookLogsPanel } from "@/components/crm/WebhookLogsPanel";
import { EvolutionLogsPanel } from "@/components/crm/EvolutionLogsPanel";
import { ImportContactsPanel } from "@/components/crm/ImportContactsPanel";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Settings() {
  const { config, loading, saveConfig, configureWebhook, testConnection, verifyIntegration } = useEvolutionConfig();
  const { syncNow, isSyncing } = useAutoSync({ enabled: false });
  const { stages, createStage, updateStage, deleteStage } = usePipelineStages();
  const { tags, createTag, updateTag, deleteTag } = useTags();
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
  const [testResult, setTestResult] = useState<{ success: boolean; httpStatus: number | null; details: any } | null>(null);

  // Stage management
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#3b82f6");

  // Tag management
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#10b981");

  // Sync form with loaded config
  useEffect(() => {
    if (config) {
      setFormData({
        api_url: config.api_url || '',
        api_key: config.api_key || '',
        instance_name: config.instance_name || '',
      });
    }
  }, [config]);

  const functionsBase = ((import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin);
  const webhookUrl = `${functionsBase}/functions/v1/evolution-webhook?secret=${encodeURIComponent(config?.webhook_secret || config?.api_key || '')}`;

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
    // Após salvar, configurar o webhook automaticamente com os dados do formulário
    await configureWebhook({
      api_url: formData.api_url,
      api_key: formData.api_key,
      instance_name: formData.instance_name,
    });
  }
  setSaving(false);
};

  const handleTestConnection = async () => {
    const result = await testConnection();
    setTestResult(result as any);
  };

  const handleVerifyIntegration = async () => {
    setVerifying(true);
    const results = await verifyIntegration();
    setVerificationResults(results);
    setVerifying(false);
  };

  const handleManualSync = async () => {
    try {
      await syncNow();
      toast({
        title: "✅ Sincronização concluída",
        description: "Mensagens do WhatsApp foram buscadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "❌ Erro na sincronização",
        description: "Ocorreu um erro ao buscar mensagens.",
        variant: "destructive",
      });
    }
  };

  const handleSaveStage = async () => {
    if (!stageName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a etapa.",
        variant: "destructive",
      });
      return;
    }

    let success;
    if (editingStage) {
      success = await updateStage(editingStage.id, stageName, stageColor);
    } else {
      success = await createStage(stageName, stageColor);
    }

    if (success) {
      setStageDialogOpen(false);
      setEditingStage(null);
      setStageName("");
      setStageColor("#3b82f6");
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta etapa?")) {
      await deleteStage(id);
    }
  };

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a etiqueta.",
        variant: "destructive",
      });
      return;
    }

    let success;
    if (editingTag) {
      success = await updateTag(editingTag.id, tagName, tagColor);
    } else {
      success = await createTag(tagName, tagColor);
    }

    if (success) {
      setTagDialogOpen(false);
      setEditingTag(null);
      setTagName("");
      setTagColor("#10b981");
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta etiqueta?")) {
      await deleteTag(id);
    }
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
          Configure a integração com WhatsApp para receber mensagens
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
              Siga este guia passo a passo para configurar o WhatsApp e começar a receber leads automaticamente
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
                    <Button 
                      type="button" 
                      variant="default" 
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </Button>
                  </>
                )}
              </div>

              {testResult && (
                <div className="mt-4">
                  <Alert variant={testResult.success ? 'default' : 'destructive'}>
                    <AlertTitle>
                      {testResult.success ? 'Conexão OK' : 'Falha na conexão'}
                    </AlertTitle>
                    <AlertDescription>
                      {typeof testResult.httpStatus === 'number' ? `HTTP ${testResult.httpStatus}. ` : ''}
                      {typeof testResult.details === 'string' ? testResult.details : ''}
                    </AlertDescription>
                  </Alert>
                </div>
              )}


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

        {/* Evolution Logs Panel */}
        {config && <EvolutionLogsPanel />}

        {/* Webhook Logs Panel */}
        {config && <WebhookLogsPanel />}

        {/* Webhook Test Panel */}
        {config && <WebhookTestPanel config={config} />}

        {/* Pipeline & Tags Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Gerenciar Funil e Etiquetas
            </CardTitle>
            <CardDescription>
              Personalize as etapas do seu funil de vendas e crie etiquetas para organizar seus leads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="stages" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stages">Etapas do Funil</TabsTrigger>
                <TabsTrigger value="tags">Etiquetas</TabsTrigger>
              </TabsList>

              <TabsContent value="stages" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Configure as etapas do seu pipeline de vendas
                  </p>
                  <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm"
                        onClick={() => {
                          setEditingStage(null);
                          setStageName("");
                          setStageColor("#3b82f6");
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Etapa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingStage ? "Editar Etapa" : "Nova Etapa"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="stage-name">Nome da Etapa</Label>
                          <Input
                            id="stage-name"
                            value={stageName}
                            onChange={(e) => setStageName(e.target.value)}
                            placeholder="Ex: Proposta Enviada"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stage-color">Cor</Label>
                          <div className="flex gap-2">
                            <Input
                              id="stage-color"
                              type="color"
                              value={stageColor}
                              onChange={(e) => setStageColor(e.target.value)}
                              className="w-20 h-10"
                            />
                            <Input
                              value={stageColor}
                              onChange={(e) => setStageColor(e.target.value)}
                              placeholder="#3b82f6"
                            />
                          </div>
                        </div>
                        <Button onClick={handleSaveStage} className="w-full">
                          {editingStage ? "Atualizar" : "Criar"} Etapa
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-medium">{stage.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingStage(stage);
                            setStageName(stage.name);
                            setStageColor(stage.color);
                            setStageDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteStage(stage.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tags" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Crie etiquetas para categorizar seus leads
                  </p>
                  <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm"
                        onClick={() => {
                          setEditingTag(null);
                          setTagName("");
                          setTagColor("#10b981");
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Etiqueta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingTag ? "Editar Etiqueta" : "Nova Etiqueta"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="tag-name">Nome da Etiqueta</Label>
                          <Input
                            id="tag-name"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                            placeholder="Ex: VIP"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tag-color">Cor</Label>
                          <div className="flex gap-2">
                            <Input
                              id="tag-color"
                              type="color"
                              value={tagColor}
                              onChange={(e) => setTagColor(e.target.value)}
                              className="w-20 h-10"
                            />
                            <Input
                              value={tagColor}
                              onChange={(e) => setTagColor(e.target.value)}
                              placeholder="#10b981"
                            />
                          </div>
                        </div>
                        <Button onClick={handleSaveTag} className="w-full">
                          {editingTag ? "Atualizar" : "Criar"} Etiqueta
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium">{tag.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingTag(tag);
                            setTagName(tag.name);
                            setTagColor(tag.color);
                            setTagDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTag(tag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Importar Contatos */}
        <ImportContactsPanel />
      </div>
    </div>
  );
}