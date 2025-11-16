import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useAgents } from "@/hooks/useAgents";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Agent, AgentFormValues, AgentStatus } from "@/types/agents";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { OpenAIConfigDialog } from "@/components/agents/OpenAIConfigDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Wand2, Upload, X, Info, Zap, Key, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const statusLabel: Record<AgentStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

const defaultForm: AgentFormValues = {
  name: "",
  description: "",
  language: "pt-BR",
  model: "gpt-4o-mini",
  prompt_instructions:
    "Você é um agente especializado em atendimento via WhatsApp. Responda sempre em português e mantenha o tom profissional e cordial.",
  temperature: 0.6,
  test_mode: true,
  allow_fallback: false,
};

const AgentsDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { agents, stats, loading, createAgent, updateAgent, deleteAgent, syncAgent } = useAgents();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [openaiConfigOpen, setOpenaiConfigOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<AgentFormValues>(defaultForm);
  const [availableModels, setAvailableModels] = useState<string[]>([
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
  ]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (activeOrgId) {
      fetchOpenAIModels(activeOrgId);
    }
  }, [activeOrgId]);

  const fetchOpenAIModels = async (organizationId: string) => {
    setLoadingModels(true);
    try {
      const { data, error } = await supabase.functions.invoke("openai-list-models", {
        body: { organizationId },
      });
      
      if (!error && data?.models) {
        setAvailableModels(data.models);
      }
    } catch (err) {
      console.error("Erro ao buscar modelos:", err);
      // Mantém lista padrão em caso de erro
    } finally {
      setLoadingModels(false);
    }
  };

  const handleInputChange = (
    field: keyof AgentFormValues,
    value: string | number | boolean
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateAgent = async () => {
    setIsSubmitting(true);
    try {
      const agentData = { ...formValues };
      
      // Se houver arquivos, adicionar ao metadata
      if (uploadedFiles.length > 0) {
        agentData.metadata = {
          ...agentData.metadata,
          files: uploadedFiles.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
          })),
        };
      }
      
      if (editingAgent) {
        await updateAgent(editingAgent.id, agentData);
        toast({
          title: "Agente atualizado",
          description: "As alterações foram salvas com sucesso.",
        });
      } else {
        await createAgent(agentData);
      }
      
      setFormValues(defaultForm);
      setUploadedFiles([]);
      setEditingAgent(null);
      setIsDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setFormValues({
      name: agent.name,
      description: agent.description || "",
      language: agent.language || "pt-BR",
      model: agent.model || "gpt-4o-mini",
      prompt_instructions: agent.prompt_instructions || "",
      guardrails: agent.guardrails || "",
      few_shot_examples: agent.few_shot_examples || "",
      temperature: agent.temperature || 0.6,
      test_mode: agent.test_mode ?? true,
      allow_fallback: agent.allow_fallback ?? false,
      evolution_config_id: agent.evolution_config_id || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o agente "${agentName}"?`)) {
      return;
    }
    try {
      await deleteAgent(agentId);
    } catch (err) {
      console.error("Erro ao excluir agente:", err);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setFormValues(defaultForm);
      setEditingAgent(null);
    }
  };

  const handleViewChange = (view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp" | "phonebook" | "workflows" | "agents") => {
    if (view === "kanban") navigate('/');
    else if (view === "calls") navigate('/');
    else if (view === "contacts") navigate('/');
    else if (view === "settings") navigate('/settings');
    else if (view === "users") navigate('/users');
    else if (view === "broadcast") navigate('/broadcast');
    else if (view === "whatsapp") navigate('/whatsapp');
    else if (view === "phonebook") navigate('/lista-telefonica');
    else if (view === "workflows") navigate('/workflows');
    else if (view === "agents") navigate('/agents');
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="agents" onViewChange={handleViewChange}>
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes Inteligentes</h1>
          <p className="text-muted-foreground">
            Centralize a criação e sincronização de agentes com OpenAI e Evolution.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setOpenaiConfigOpen(true)}>
            <Key className="mr-2 h-4 w-4" />
            Configurar OpenAI
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Wand2 className="mr-2 h-4 w-4" />
                Novo agente
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar agente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={formValues.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Assistente Comercial"
                />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formValues.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Responsável por qualificar leads e responder dúvidas."
                />
              </div>
              <div className="grid gap-2">
                <Label>Idioma</Label>
                <Input
                  value={formValues.language}
                  onChange={(e) => handleInputChange("language", e.target.value)}
                  placeholder="pt-BR"
                />
              </div>
              <div className="grid gap-2">
                <Label>Modelo OpenAI</Label>
                <Select
                  value={formValues.model}
                  onValueChange={(value) => handleInputChange("model", value)}
                  disabled={loadingModels}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Instruções básicas</Label>
                <Textarea
                  value={formValues.prompt_instructions}
                  onChange={(e) =>
                    handleInputChange("prompt_instructions", e.target.value)
                  }
                  rows={4}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Guardrails (Regras Obrigatórias)</Label>
                <Textarea
                  value={formValues.guardrails || ""}
                  onChange={(e) =>
                    handleInputChange("guardrails", e.target.value)
                  }
                  placeholder="- NUNCA invente informações que você não tem&#10;- Se não souber, diga 'Não tenho essa informação'&#10;- NUNCA forneça preços sem confirmar no sistema"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Regras que o agente DEVE seguir sempre. Ajuda a evitar erros.
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label>Exemplos de Boas Respostas (Few-Shot)</Label>
                <Textarea
                  value={formValues.few_shot_examples || ""}
                  onChange={(e) =>
                    handleInputChange("few_shot_examples", e.target.value)
                  }
                  placeholder="Cliente: Qual o prazo de entrega?&#10;Agente: O prazo varia de 5-7 dias úteis. Posso verificar para seu CEP, qual é?&#10;&#10;Cliente: Quanto custa?&#10;Agente: Vou consultar o preço atualizado. Um momento..."
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Exemplos de perguntas e respostas ideais para treinar o agente.
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Temperatura</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={formValues.temperature}
                  onChange={(e) =>
                    handleInputChange("temperature", Number(e.target.value))
                  }
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Arquivos de Conhecimento</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={handleFileUpload}
                      multiple
                      accept=".pdf,.txt,.doc,.docx,.md"
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload de Arquivos
                    </Button>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted p-2 rounded text-sm"
                        >
                          <span className="truncate">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Arquivos suportados: PDF, TXT, DOC, DOCX, MD (apenas metadata salvo)
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border rounded-md px-4 py-3">
                <div>
                  <Label>Modo de testes</Label>
                  <p className="text-sm text-muted-foreground">
                    Se ativo, respostas reais não serão enviadas aos clientes.
                  </p>
                </div>
                <Switch
                  checked={Boolean(formValues.test_mode)}
                  onCheckedChange={(checked) =>
                    handleInputChange("test_mode", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between border rounded-md px-4 py-3">
                <div>
                  <Label>Fallback automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Permite redirecionar para operador humano em caso de erro.
                  </p>
                </div>
                <Switch
                  checked={Boolean(formValues.allow_fallback)}
                  onCheckedChange={(checked) =>
                    handleInputChange("allow_fallback", checked)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <span>Instância Evolution (opcional)</span>
                  <Badge variant="outline" className="text-xs">WhatsApp</Badge>
                </Label>
                <Select
                  value={formValues.evolution_config_id}
                  onValueChange={(value) =>
                    handleInputChange("evolution_config_id", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância do WhatsApp" />
                  </SelectTrigger>
                  <SelectContent>
                    {evolutionConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vincule este agente a uma instância do WhatsApp para respostas automáticas
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateAgent}
                disabled={isSubmitting || !formValues.name}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingAgent ? "Salvar alterações" : "Criar agente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-blue-200 bg-blue-50 shadow-md">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-2 flex-1">
              <CardTitle className="text-blue-900 text-lg">📖 Como funciona a integração?</CardTitle>
              <CardDescription className="text-blue-800 text-sm">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium mb-1">1️⃣ Criar Agente no Formulário</p>
                    <p className="text-sm">Clique em "Novo agente" → Preencha nome, instruções, guardrails, exemplos e selecione a instância do WhatsApp (campo no final do formulário).</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">2️⃣ Sincronizar com OpenAI</p>
                    <p className="text-sm">
                      Na tabela abaixo, clique no botão <strong>"OpenAI"</strong> do agente criado. Certifique-se de que a variável <code>OPENAI_API_KEY</code> está configurada no Lovable Cloud (botão "Configurar OpenAI" explica).
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">3️⃣ Sincronizar com Evolution (WhatsApp)</p>
                    <p className="text-sm">Na tabela, clique no botão <strong>"Evolution"</strong>. Isso vincula o agente à instância do WhatsApp que você selecionou no formulário.</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">4️⃣ Pronto! Agente Ativo</p>
                    <p className="text-sm">Após sincronizar, o agente responde automaticamente no WhatsApp. O sistema valida respostas e loga conversas para análise.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium">
                      Tudo integrado! Após sincronizar, o agente funciona automaticamente no WhatsApp.
                    </p>
                  </div>
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total de agentes</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-3xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rascunhos</CardDescription>
            <CardTitle className="text-3xl">{stats.drafts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agentes configurados</CardTitle>
            <CardDescription>
              Sincronize sempre que alterar instruções ou modelos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Carregando agentes...</p>
              </div>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Nenhum agente criado ainda. Clique em "Novo agente" para começar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Instância Evolution</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {agent.description || "Sem descrição"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          agent.status === "active" ? "default" : "secondary"
                        }
                      >
                        {statusLabel[agent.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{agent.model}</TableCell>
                    <TableCell>
                      {agent.evolution_instance_id
                        ? agent.evolution_instance_id
                        : "Não sincronizado"}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditAgent(agent)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAgent(agent.id, agent.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncAgent(agent.id, "openai")}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        OpenAI
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!agent.evolution_config_id}
                        onClick={() => syncAgent(agent.id, "evolution")}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Evolution
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* OpenAI Config Dialog */}
      <OpenAIConfigDialog
        open={openaiConfigOpen}
        onOpenChange={setOpenaiConfigOpen}
      />
    </div>
      </CRMLayout>
    </AuthGuard>
  );
};

export default AgentsDashboard;

