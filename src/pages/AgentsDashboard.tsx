import { useState, useEffect } from "react";
import { useAgents } from "@/hooks/useAgents";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { AgentFormValues, AgentStatus } from "@/types/agents";
import { Button } from "@/components/ui/button";
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
import { Loader2, RefreshCw, Wand2, Upload, X } from "lucide-react";
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
  const { agents, stats, loading, createAgent, syncAgent } = useAgents();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    fetchOpenAIModels();
  }, []);

  const fetchOpenAIModels = async () => {
    setLoadingModels(true);
    try {
      // Tentar buscar modelos via Edge Function
      const { data, error } = await supabase.functions.invoke("openai-list-models");
      
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
      
      await createAgent(agentData);
      setFormValues(defaultForm);
      setUploadedFiles([]);
      setIsDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes Inteligentes</h1>
          <p className="text-muted-foreground">
            Centralize a criação e sincronização de agentes com OpenAI e Evolution.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Wand2 className="mr-2 h-4 w-4" />
              Novo agente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
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
                    <div className="space-y-1">
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
                    Arquivos suportados: PDF, TXT, DOC, DOCX, MD
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
                <Label>Instância Evolution (opcional)</Label>
                <Select
                  value={formValues.evolution_config_id}
                  onValueChange={(value) =>
                    handleInputChange("evolution_config_id", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {evolutionConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateAgent}
                disabled={isSubmitting || !formValues.name}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar agente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
    </div>
  );
};

export default AgentsDashboard;

