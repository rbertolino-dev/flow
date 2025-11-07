import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { EvolutionInstanceCard } from "@/components/crm/EvolutionInstanceCard";
import { EvolutionInstanceDialog } from "@/components/crm/EvolutionInstanceDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tag as TagIcon, Layers, Pencil, Trash2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { MessageTemplateManager } from "@/components/crm/MessageTemplateManager";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";

export default function Settings() {
  const navigate = useNavigate();
  const { 
    configs, 
    loading, 
    createConfig, 
    updateConfig, 
    deleteConfig, 
    toggleWebhook,
    configureWebhook,
    testConnection 
  } = useEvolutionConfigs();
  
  const { stages, createStage, updateStage, deleteStage, cleanDuplicateStages } = usePipelineStages();
  const { tags, createTag, updateTag, deleteTag } = useTags();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EvolutionConfig | null>(null);

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

  const handleEdit = (config: EvolutionConfig) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta instância?")) {
      await deleteConfig(id);
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

  const handleViewChange = (view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast-campaigns');
    } else if (view === "whatsapp") {
      navigate('/whatsapp');
    } else if (view === "settings") {
      // já estamos aqui
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <CRMLayout activeView="settings" onViewChange={handleViewChange}>
          <div className="h-full w-full flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CRMLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <CRMLayout activeView="settings" onViewChange={handleViewChange}>
        <div className="h-full bg-background overflow-y-auto">
          <div className="p-6 border-b border-border">
            <h1 className="text-3xl font-bold mb-2">Configurações</h1>
            <p className="text-muted-foreground">
              Gerencie suas integrações e configurações do sistema
            </p>
          </div>

      <div className="p-6 max-w-6xl space-y-6">
        <Tabs defaultValue="evolution" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="evolution">Evolution API</TabsTrigger>
            <TabsTrigger value="pipeline">Funil & Etiquetas</TabsTrigger>
            <TabsTrigger value="templates">
              <MessageSquare className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="google-calendar">Google Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="evolution" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Instâncias Evolution API</CardTitle>
                    <CardDescription>
                      Gerencie suas conexões com o WhatsApp via Evolution API
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingConfig(null);
                    setDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Instância
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {configs.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Nenhuma instância configurada. Clique em "Nova Instância" para adicionar sua primeira conexão.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {configs.map((config) => (
                      <EvolutionInstanceCard
                        key={config.id}
                        config={config}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleWebhook={toggleWebhook}
                        onTest={testConnection}
                        onConfigureWebhook={configureWebhook}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription>
                <strong>Dica:</strong> Você pode ativar ou desativar o webhook para cada instância individualmente. 
                Quando desativado, mensagens recebidas naquela instância não serão processadas pelo CRM.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Pipeline Stages */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      <CardTitle>Etapas do Funil</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={cleanDuplicateStages}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Limpar Duplicatas
                      </Button>
                      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={() => {
                            setEditingStage(null);
                            setStageName("");
                            setStageColor("#3b82f6");
                          }}>
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
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="stage-name">Nome</Label>
                              <Input
                                id="stage-name"
                                value={stageName}
                                onChange={(e) => setStageName(e.target.value)}
                                placeholder="Ex: Contato Feito"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="stage-color">Cor</Label>
                              <Input
                                id="stage-color"
                                type="color"
                                value={stageColor}
                                onChange={(e) => setStageColor(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSaveStage}>
                              {editingStage ? "Salvar" : "Criar"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stages.map((stage) => (
                      <div
                        key={stage.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
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
                            variant="ghost"
                            size="icon"
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
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStage(stage.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TagIcon className="h-5 w-5" />
                      <CardTitle>Etiquetas</CardTitle>
                    </div>
                    <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => {
                          setEditingTag(null);
                          setTagName("");
                          setTagColor("#10b981");
                        }}>
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
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="tag-name">Nome</Label>
                            <Input
                              id="tag-name"
                              value={tagName}
                              onChange={(e) => setTagName(e.target.value)}
                              placeholder="Ex: VIP"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tag-color">Cor</Label>
                            <Input
                              id="tag-color"
                              type="color"
                              value={tagColor}
                              onChange={(e) => setTagColor(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleSaveTag}>
                            {editingTag ? "Salvar" : "Criar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <div key={tag.id} className="group relative">
                        <Badge
                          style={{ backgroundColor: tag.color }}
                          className="pr-8"
                        >
                          {tag.name}
                        </Badge>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              setEditingTag(tag);
                              setTagName(tag.name);
                              setTagColor(tag.color);
                              setTagDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <MessageTemplateManager />
              </TabsContent>

              <TabsContent value="google-calendar" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuração do Google Calendar</CardTitle>
                    <CardDescription>
                      Configure as credenciais OAuth2 do Google Calendar para agendar eventos diretamente do CRM
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertDescription>
                        <strong>Como configurar:</strong>
                        <ol className="list-decimal list-inside space-y-2 mt-2">
                          <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                          <li>Crie um projeto ou selecione um existente</li>
                          <li>Ative a API do Google Calendar</li>
                          <li>Crie credenciais OAuth 2.0 (Client ID e Client Secret)</li>
                          <li>Configure a URL de redirecionamento: <code className="bg-muted px-1 py-0.5 rounded">https://developers.google.com/oauthplayground</code></li>
                          <li>Use o <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OAuth 2.0 Playground</a> para gerar o Refresh Token</li>
                          <li>Cole as credenciais abaixo e salve no Lovable Cloud</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input 
                          placeholder="Seu Client ID do Google"
                          disabled
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">
                          Configure em: Lovable Cloud → Secrets → GOOGLE_CALENDAR_CLIENT_ID
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Client Secret</Label>
                        <Input 
                          type="password"
                          placeholder="Seu Client Secret do Google"
                          disabled
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">
                          Configure em: Lovable Cloud → Secrets → GOOGLE_CALENDAR_CLIENT_SECRET
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Refresh Token</Label>
                        <Input 
                          type="password"
                          placeholder="Refresh Token do OAuth Playground"
                          disabled
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">
                          Configure em: Lovable Cloud → Secrets → GOOGLE_CALENDAR_REFRESH_TOKEN
                        </p>
                      </div>

                      <Alert>
                        <AlertDescription>
                          Para adicionar os secrets, clique no botão abaixo para acessar o Lovable Cloud.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
        </Tabs>
      </div>

      <EvolutionInstanceDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingConfig(null);
        }}
        editingConfig={editingConfig}
        onSave={async (data) => {
          await createConfig(data);
          setDialogOpen(false);
          setEditingConfig(null);
          return true;
        }}
        onUpdate={async (id, data) => {
          await updateConfig(id, data);
          setDialogOpen(false);
          setEditingConfig(null);
          return true;
        }}
      />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
