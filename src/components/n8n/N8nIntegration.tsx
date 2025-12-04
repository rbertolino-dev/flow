import { useState, useEffect } from "react";
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
  Sparkles
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
        active: false,
        nodes: [],
        connections: {},
      };
      await createWorkflow(workflowData);
      toast({
        title: "Workflow criado",
        description: "O workflow foi criado com sucesso",
      });
      refetchWorkflows();
      setWorkflowDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao criar workflow",
        description: error.message,
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
      await createWorkflow(generatedWorkflow);
      toast({
        title: "Workflow criado!",
        description: "O workflow gerado por IA foi criado no n8n com sucesso",
      });
      setAiDialogOpen(false);
      setWorkflowDescription("");
      setGeneratedWorkflow(null);
      refetchWorkflows();
    } catch (error: any) {
      toast({
        title: "Erro ao criar workflow",
        description: error.message,
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
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : workflows.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum workflow encontrado. Crie um novo workflow para começar.
                      </AlertDescription>
                    </Alert>
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
                        {workflows.map((workflow) => (
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

