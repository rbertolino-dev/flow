import { useState, useEffect, useMemo } from "react";
import { useN8nConfig, N8nWorkflow, N8nWorkflowExecution } from "@/hooks/useN8nConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Trash2, 
  TestTube, 
  Plus, 
  Play, 
  Pause, 
  RefreshCw, 
  Eye, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Workflow,
  Zap,
  Sparkles,
  FileText,
  ExternalLink,
  Copy,
  Search,
  Filter
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { N8N_TEMPLATES, N8nTemplate, fixTemplateConnections } from "@/lib/n8nTemplates";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function N8nIntegration() {
  const { 
    config, 
    isLoading, 
    saveConfig, 
    isSaving, 
    deleteConfig, 
    isDeleting,
    testConnection,
    listWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    deactivateWorkflow,
    executeWorkflow,
    getExecution,
  } = useN8nConfig();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();
  
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // Workflow states
  const [selectedWorkflow, setSelectedWorkflow] = useState<N8nWorkflow | null>(null);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<N8nWorkflowExecution | null>(null);
  const [testInputData, setTestInputData] = useState("{}");
  
  // IA Generation states
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<N8nWorkflow | null>(null);
  
  // Template states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<N8nTemplate | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [templateSearch, setTemplateSearch] = useState("");
  
  // Search and filter states
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Carregar valores quando config estiver disponível
  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url);
      setApiKey(config.api_key);
    }
  }, [config]);

  // Query para listar workflows
  const { data: workflows = [], isLoading: isLoadingWorkflows, refetch: refetchWorkflows } = useQuery({
    queryKey: ["n8n-workflows", config?.id],
    queryFn: async () => {
      if (!config) return [];
      return listWorkflows();
    },
    enabled: !!config && config.connection_status === 'connected',
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Filtrar workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(workflowSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" ? w.active : !w.active);
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      // Ordenar por nome
      return a.name.localeCompare(b.name);
    });
  }, [workflows, workflowSearch, statusFilter]);

  // Filtrar templates
  const filteredTemplates = useMemo(() => {
    return N8N_TEMPLATES.filter(t => {
      const matchesCategory = templateCategory === "all" || t.category === templateCategory;
      const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(templateSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [templateCategory, templateSearch]);

  const handleSaveConfig = () => {
    if (!apiUrl || !apiKey) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha a URL da API e a chave da API",
        variant: "destructive",
      });
      return;
    }
    saveConfig({ api_url: apiUrl, api_key: apiKey });
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await testConnection();
      toast({
        title: "✅ Conexão bem-sucedida",
        description: result.message,
      });
      refetchWorkflows();
    } catch (error: any) {
      toast({
        title: "❌ Erro na conexão",
        description: error.message || "Não foi possível conectar ao n8n",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const workflowData: Partial<N8nWorkflow> = {
        name: `Novo Workflow ${new Date().toLocaleString()}`,
        nodes: [],
        connections: {},
      };
      const created = await createWorkflow(workflowData);
      toast({
        title: "✅ Workflow criado",
        description: `Workflow "${created.name}" criado com sucesso`,
      });
      setWorkflowDialogOpen(false);
      // Aguardar um pouco antes de refetch para garantir que o n8n processou
      setTimeout(() => {
        refetchWorkflows();
      }, 1000);
    } catch (error: any) {
      console.error("Erro ao criar workflow:", error);
      toast({
        title: "❌ Erro ao criar workflow",
        description: error.message || "Não foi possível criar o workflow",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await deleteWorkflow(workflowId);
      toast({
        title: "Workflow deletado",
        description: "O workflow foi removido com sucesso",
      });
      refetchWorkflows();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar workflow",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleWorkflow = async (workflow: N8nWorkflow) => {
    try {
      if (workflow.active) {
        await deactivateWorkflow(workflow.id);
        toast({
          title: "Workflow desativado",
          description: "O workflow foi desativado com sucesso",
        });
      } else {
        await activateWorkflow(workflow.id);
        toast({
          title: "Workflow ativado",
          description: "O workflow foi ativado com sucesso",
        });
      }
      refetchWorkflows();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateWithAI = async () => {
    if (!workflowDescription.trim()) {
      toast({
        title: "Descrição necessária",
        description: "Por favor, descreva o workflow que deseja criar",
        variant: "destructive",
      });
      return;
    }

    if (!activeOrgId) {
      toast({
        title: "Organização não encontrada",
        description: "Por favor, selecione uma organização",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('n8n-generate-workflow', {
        body: {
          description: workflowDescription,
          organization_id: activeOrgId,
        },
      });

      if (error) throw error;

      if (!data.success || !data.workflow) {
        throw new Error(data.error || "Erro ao gerar workflow");
      }

      setGeneratedWorkflow(data.workflow);
      toast({
        title: "✅ Workflow gerado!",
        description: `Workflow criado com ${data.workflow.nodes?.length || 0} nodes`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar workflow",
        description: error.message || "Não foi possível gerar o workflow",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateGeneratedWorkflow = async () => {
    if (!generatedWorkflow) return;

    try {
      const created = await createWorkflow(generatedWorkflow);
      toast({
        title: "✅ Workflow criado!",
        description: `Workflow "${created.name}" gerado por IA foi criado no n8n com sucesso`,
      });
      setAiDialogOpen(false);
      setWorkflowDescription("");
      setGeneratedWorkflow(null);
      // Aguardar um pouco antes de refetch para garantir que o n8n processou
      setTimeout(() => {
        refetchWorkflows();
      }, 1000);
    } catch (error: any) {
      console.error("Erro ao criar workflow gerado:", error);
      toast({
        title: "❌ Erro ao criar workflow",
        description: error.message || "Não foi possível criar o workflow gerado",
        variant: "destructive",
      });
    }
  };

  const handleCreateFromTemplate = async (template: N8nTemplate) => {
    try {
      const fixedWorkflow = fixTemplateConnections(template.workflow);
      const workflowData = {
        ...fixedWorkflow,
        name: `${template.name} - ${new Date().toLocaleString('pt-BR')}`,
      };
      const created = await createWorkflow(workflowData);
      toast({
        title: "✅ Workflow criado!",
        description: `Workflow "${created.name}" criado a partir do template "${template.name}"`,
      });
      setTemplateDialogOpen(false);
      setSelectedTemplate(null);
      setTimeout(() => {
        refetchWorkflows();
      }, 1000);
    } catch (error: any) {
      console.error("Erro ao criar workflow do template:", error);
      toast({
        title: "❌ Erro ao criar workflow",
        description: error.message || "Não foi possível criar o workflow do template",
        variant: "destructive",
      });
    }
  };

  const handleTestWorkflow = async (workflow: N8nWorkflow) => {
    try {
      let inputData = {};
      try {
        inputData = JSON.parse(testInputData);
      } catch {
        toast({
          title: "JSON inválido",
          description: "Por favor, insira um JSON válido",
          variant: "destructive",
        });
        return;
      }

      const execution = await executeWorkflow(workflow.id, inputData);
      setCurrentExecution(execution);
      setExecutionDialogOpen(true);
      
      // Polling para atualizar status da execução
      const pollExecution = async () => {
        try {
          const updated = await getExecution(execution.id);
          setCurrentExecution(updated);
          if (!updated.finished) {
            setTimeout(pollExecution, 2000);
          }
        } catch (error) {
          console.error("Erro ao buscar execução:", error);
        }
      };
      
      if (!execution.finished) {
        setTimeout(pollExecution, 2000);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao executar workflow",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      case 'disconnected':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Desconectado</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> Desconhecido</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  // Verificar se há erro de tabela não encontrada
  const hasTableError = config === null && !isLoading && activeOrgId;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integração n8n</h1>
          <p className="text-muted-foreground mt-2">
            Conecte-se ao n8n para criar e gerenciar workflows de automação
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-2" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="workflows" disabled={!config}>
            <Workflow className="w-4 h-4 mr-2" />
            Workflows
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da API n8n</CardTitle>
              <CardDescription>
                Configure a conexão com sua instância do n8n
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium">Status da conexão:</span>
                  {getStatusBadge(config.connection_status)}
                  {config.last_connection_test && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Último teste: {new Date(config.last_connection_test).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="api-url">URL da API n8n</Label>
                <Input
                  id="api-url"
                  placeholder="https://seu-n8n.exemplo.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL base da sua instância do n8n (ex: https://n8n.exemplo.com)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Chave da API</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Sua chave da API n8n"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Chave da API gerada nas configurações do n8n
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4 mr-2" />
                      Salvar Configuração
                    </>
                  )}
                </Button>

                {config && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection || !config}
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-4 h-4 mr-2" />
                          Testar Conexão
                        </>
                      )}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A configuração do n8n será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteConfig()}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>

              {!config && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {hasTableError ? (
                      <>
                        <strong>Atenção:</strong> A tabela n8n_configs não foi encontrada. 
                        Por favor, aplique a migração <code>20250129000000_create_n8n_config.sql</code> no banco de dados primeiro.
                      </>
                    ) : (
                      "Configure a conexão com o n8n para começar a gerenciar workflows."
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          {!config ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure a conexão com o n8n primeiro para gerenciar workflows.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Workflows</CardTitle>
                      <CardDescription>
                        Gerencie seus workflows de automação do n8n
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => refetchWorkflows()}
                        disabled={isLoadingWorkflows}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingWorkflows ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">
                            <FileText className="w-4 h-4 mr-2" />
                            Templates
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <FileText className="w-5 h-5" />
                              Templates de Workflows
                            </DialogTitle>
                            <DialogDescription>
                              Escolha um template pré-configurado para começar rapidamente
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {/* Filtros de templates */}
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Buscar templates..."
                                  value={templateSearch}
                                  onChange={(e) => setTemplateSearch(e.target.value)}
                                  className="pl-9"
                                />
                              </div>
                              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                                <SelectTrigger className="w-full sm:w-48">
                                  <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Todas as categorias</SelectItem>
                                  <SelectItem value="Integração">Integração</SelectItem>
                                  <SelectItem value="Automação">Automação</SelectItem>
                                  <SelectItem value="Notificação">Notificação</SelectItem>
                                  <SelectItem value="Processamento">Processamento</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Grid de templates */}
                            <ScrollArea className="h-[400px]">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.map((template) => (
                                  <Card 
                                    key={template.id}
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => setSelectedTemplate(template)}
                                  >
                                    <CardHeader>
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-2xl">{template.icon}</span>
                                          <div>
                                            <CardTitle className="text-base">{template.name}</CardTitle>
                                            <Badge variant="outline" className="mt-1">
                                              {template.category}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <p className="text-sm text-muted-foreground mb-3">
                                        {template.description}
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {template.tags.map((tag) => (
                                          <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                      <div className="mt-3 text-xs text-muted-foreground">
                                        {template.workflow.nodes?.length || 0} nodes
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </ScrollArea>

                            {filteredTemplates.length === 0 && (
                              <div className="text-center py-8 text-sm text-muted-foreground">
                                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhum template encontrado com os filtros aplicados</p>
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button
                              onClick={() => selectedTemplate && handleCreateFromTemplate(selectedTemplate)}
                              disabled={!selectedTemplate}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Criar do Template
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="default" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                            <Sparkles className="w-4 h-4 mr-2" />
                            Gerar com IA
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-purple-600" />
                              Gerar Workflow com Inteligência Artificial
                            </DialogTitle>
                            <DialogDescription>
                              Descreva o workflow que deseja criar e a IA irá gerar automaticamente a estrutura completa do n8n
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Descrição do Workflow</Label>
                              <Textarea
                                value={workflowDescription}
                                onChange={(e) => setWorkflowDescription(e.target.value)}
                                placeholder="Ex: Quando receber um email, extrair o assunto, buscar informações no banco de dados e enviar uma mensagem no Slack com os resultados..."
                                rows={6}
                                className="resize-none"
                              />
                              <p className="text-xs text-muted-foreground">
                                Seja específico sobre: triggers (webhook, schedule, manual), ações (HTTP requests, banco de dados, integrações), e fluxo lógico
                              </p>
                            </div>

                            {generatedWorkflow && (
                              <div className="space-y-2 p-4 bg-muted rounded-lg">
                                <div className="flex items-center justify-between">
                                  <Label className="text-base font-semibold">Workflow Gerado</Label>
                                  <Badge className="bg-green-500">
                                    {generatedWorkflow.nodes?.length || 0} nodes
                                  </Badge>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <p><strong>Nome:</strong> {generatedWorkflow.name}</p>
                                  <p><strong>Nodes:</strong> {generatedWorkflow.nodes?.map((n: any) => n.name || n.type).join(", ") || "N/A"}</p>
                                </div>
                                <Alert>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    Revise o workflow gerado antes de criar. Você poderá editá-lo no n8n após a criação.
                                  </AlertDescription>
                                </Alert>
                              </div>
                            )}

                            {!generatedWorkflow && (
                              <Alert>
                                <Sparkles className="h-4 w-4" />
                                <AlertDescription>
                                  A IA irá criar um workflow completo baseado na sua descrição, incluindo triggers, nodes e conexões.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                          <DialogFooter>
                            {generatedWorkflow ? (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setGeneratedWorkflow(null);
                                    setWorkflowDescription("");
                                  }}
                                >
                                  Gerar Novamente
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setAiDialogOpen(false);
                                    setGeneratedWorkflow(null);
                                    setWorkflowDescription("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button onClick={handleCreateGeneratedWorkflow}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Criar Workflow no n8n
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setAiDialogOpen(false);
                                    setWorkflowDescription("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={handleGenerateWithAI}
                                  disabled={isGenerating || !workflowDescription.trim()}
                                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                                >
                                  {isGenerating ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Gerando...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Gerar Workflow
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            Criar Manual
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Criar Novo Workflow</DialogTitle>
                            <DialogDescription>
                              Um novo workflow será criado no n8n. Você poderá editá-lo diretamente no n8n.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setWorkflowDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleCreateWorkflow}>
                              Criar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingWorkflows ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 mb-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-32" />
                      </div>
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : workflows.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-12 text-center">
                      <Workflow className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">Nenhum workflow encontrado</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Comece criando um workflow manualmente, usando um template ou gerando com IA
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" onClick={() => setWorkflowDialogOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Criar Manual
                        </Button>
                        <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                          <FileText className="w-4 h-4 mr-2" />
                          Usar Template
                        </Button>
                        <Button 
                          variant="default" 
                          className="bg-gradient-to-r from-purple-600 to-blue-600"
                          onClick={() => setAiDialogOpen(true)}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Gerar com IA
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Filtros e busca */}
                      <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar workflows..."
                            value={workflowSearch}
                            onChange={(e) => setWorkflowSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                          <SelectTrigger className="w-full sm:w-40">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="active">Ativos</SelectItem>
                            <SelectItem value="inactive">Inativos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {filteredWorkflows.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center">
                          <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-sm text-muted-foreground">
                            Nenhum workflow encontrado com os filtros aplicados
                          </p>
                        </div>
                      ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Nodes</TableHead>
                          <TableHead>Atualizado</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWorkflows.map((workflow) => (
                          <TableRow key={workflow.id}>
                            <TableCell className="font-medium">{workflow.name}</TableCell>
                            <TableCell>
                              {workflow.active ? (
                                <Badge className="bg-green-500">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Pause className="w-3 h-3 mr-1" />
                                  Inativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{workflow.nodes?.length || 0}</TableCell>
                            <TableCell>
                              {workflow.updatedAt 
                                ? new Date(workflow.updatedAt).toLocaleString('pt-BR')
                                : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedWorkflow(workflow);
                                        setTestInputData("{}");
                                      }}
                                    >
                                      <Zap className="w-4 h-4 mr-1" />
                                      Testar
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Testar Workflow: {workflow.name}</DialogTitle>
                                      <DialogDescription>
                                        Execute o workflow com dados de entrada personalizados
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Dados de Entrada (JSON)</Label>
                                        <Textarea
                                          value={testInputData}
                                          onChange={(e) => setTestInputData(e.target.value)}
                                          rows={10}
                                          className="font-mono text-sm"
                                          placeholder='{"key": "value"}'
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        variant="outline"
                                        onClick={() => setTestInputData("{}")}
                                      >
                                        Limpar
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          handleTestWorkflow(workflow);
                                          setTestInputData("{}");
                                        }}
                                      >
                                        <Play className="w-4 h-4 mr-2" />
                                        Executar
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleWorkflow(workflow)}
                                >
                                  {workflow.active ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Deletar workflow?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita. O workflow "{workflow.name}" será removido permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteWorkflow(workflow.id)}>
                                        Deletar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de resultado da execução */}
      <Dialog open={executionDialogOpen} onOpenChange={setExecutionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado da Execução</DialogTitle>
            <DialogDescription>
              Detalhes da execução do workflow
            </DialogDescription>
          </DialogHeader>
          {currentExecution && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID da Execução</Label>
                  <p className="text-sm font-mono">{currentExecution.id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">
                    {currentExecution.finished ? (
                      <Badge className="bg-green-500">Finalizado</Badge>
                    ) : (
                      <Badge variant="secondary">Em execução...</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label>Iniciado em</Label>
                  <p className="text-sm">
                    {new Date(currentExecution.startedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                {currentExecution.stoppedAt && (
                  <div>
                    <Label>Finalizado em</Label>
                    <p className="text-sm">
                      {new Date(currentExecution.stoppedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Dados da Execução</Label>
                <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                  {JSON.stringify(currentExecution.data || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setExecutionDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

