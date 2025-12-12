import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Archive } from "lucide-react";
import { EvolutionInstanceCard } from "@/components/crm/EvolutionInstanceCard";
import { EvolutionInstanceDialog } from "@/components/crm/EvolutionInstanceDialog";
import { EvolutionStatusScanner } from "@/components/crm/EvolutionStatusScanner";
import { ArchivedLeadsPanel } from "@/components/crm/ArchivedLeadsPanel";
import { WhatsAppNumberValidator } from "@/components/crm/WhatsAppNumberValidator";
import { EvolutionApiDiagnostics } from "@/components/crm/EvolutionApiDiagnostics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tag as TagIcon, Layers, Pencil, Trash2, MessageSquare, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { MessageTemplateManager } from "@/components/crm/MessageTemplateManager";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { ChatwootConfigPanel } from "@/components/crm/ChatwootConfigPanel";
import { FacebookConfigPanel } from "@/components/crm/FacebookConfigPanel";
import { GoogleCalendarIntegrationPanel } from "@/components/calendar/GoogleCalendarIntegrationPanel";
import { MercadoPagoIntegrationPanel } from "@/components/mercado-pago/MercadoPagoIntegrationPanel";
import { AsaasIntegrationPanel } from "@/components/crm/AsaasIntegrationPanel";
import { GmailIntegrationPanel } from "@/components/crm/GmailIntegrationPanel";
import { BubbleIntegrationPanel } from "@/components/crm/BubbleIntegrationPanel";
import { BubbleLeadsSyncPanel } from "@/components/crm/BubbleLeadsSyncPanel";
import { HubSpotIntegrationPanel } from "@/components/crm/HubSpotIntegrationPanel";
import { HubSpotListsImportPanel } from "@/components/crm/HubSpotListsImportPanel";
import { UsersPanel } from "@/components/users/UsersPanel";
import { IntegrationsOnboarding } from "@/components/crm/IntegrationsOnboarding";
import { InstanceDisconnectionAlerts } from "@/components/crm/InstanceDisconnectionAlerts";

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("integrations");
  const { 
    configs, 
    loading, 
    createConfig, 
    updateConfig, 
    deleteConfig, 
    toggleWebhook,
    configureWebhook,
    testConnection,
    refetch
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

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingConfig(null); // Limpar estado ao fechar
    }
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

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") {
      navigate('/broadcast');
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
          <div className="p-3 sm:p-4 lg:p-6 border-b border-border">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Configurações</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie suas integrações e configurações do sistema
            </p>
          </div>

          {/* Alertas de desconexão */}
          <div className="p-3 sm:p-4 lg:p-6">
            <InstanceDisconnectionAlerts instances={configs} enabled={true} />
          </div>

      <div className="p-3 sm:p-4 lg:p-6 max-w-6xl space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-1 overflow-x-auto">
            <TabsTrigger value="integrations" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Integrações</span>
              <span className="sm:hidden">Integrações</span>
            </TabsTrigger>
            <TabsTrigger value="evolution" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="chatwoot" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Chatwoot</span>
              <span className="sm:hidden">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="facebook" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Facebook/Instagram</span>
              <span className="sm:hidden">FB/IG</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Funil & Etiquetas</span>
              <span className="sm:hidden">Funil</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs sm:text-sm">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs sm:text-sm">
              <Archive className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Arquivados</span>
              <span className="sm:hidden">Arquivo</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm">
              <UserCog className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Usuários</span>
              <span className="sm:hidden">Usuários</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-6 mt-6">
            <div className="space-y-6">
              <IntegrationsOnboarding onTabChange={setActiveTab} />
              
              <div>
                <h2 className="text-xl font-semibold mb-2">Integrações de Sistemas</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Gerencie todas as integrações e conexões com sistemas externos. Todas as configurações são por organização.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                {/* Google Calendar */}
                <GoogleCalendarIntegrationPanel />

                {/* Gmail */}
                <GmailIntegrationPanel />

                {/* Mercado Pago */}
                <MercadoPagoIntegrationPanel />

                {/* Asaas */}
                <AsaasIntegrationPanel />

                {/* Bubble.io */}
                <BubbleIntegrationPanel />

                {/* HubSpot */}
                <HubSpotIntegrationPanel />
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Sincronização de Dados</h3>
                <div className="grid gap-6 md:grid-cols-1">
                  {/* Sincronização de Leads do Bubble */}
                  <BubbleLeadsSyncPanel />
                  
                  {/* Importação de Listas do HubSpot */}
                  <HubSpotListsImportPanel />
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs sm:text-sm">
                  <strong>Importante:</strong> Todas as credenciais e configurações são armazenadas de forma segura e isoladas por organização. 
                  Cada organização possui suas próprias integrações independentes.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="evolution" className="space-y-4 sm:space-y-6">
            <EvolutionApiDiagnostics />
            
            <WhatsAppNumberValidator configs={configs} />

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Instâncias WhatsApp</CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                      Gerencie suas conexões com o WhatsApp
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingConfig(null);
                    setDialogOpen(true);
                  }} size="sm" className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Instância
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {configs.length === 0 ? (
                  <Alert>
                    <AlertDescription className="text-xs sm:text-sm">
                      Nenhuma instância configurada. Clique em "Nova Instância" para adicionar sua primeira conexão.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <EvolutionStatusScanner configs={configs} />
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
                      {configs.map((config) => (
                        <EvolutionInstanceCard
                          key={config.id}
                          config={config}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onToggleWebhook={toggleWebhook}
                          onTest={testConnection}
                          onConfigureWebhook={configureWebhook}
                          onRefresh={refetch}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription className="text-xs sm:text-sm">
                <strong>Dica:</strong> Você pode ativar ou desativar o webhook para cada instância individualmente. 
                Quando desativado, mensagens recebidas naquela instância não serão processadas pelo CRM.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="chatwoot" className="space-y-6">
            <ChatwootConfigPanel />
          </TabsContent>

          <TabsContent value="facebook" className="space-y-6">
            <FacebookConfigPanel />
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

              <TabsContent value="archived" className="space-y-6">
                <ArchivedLeadsPanel />
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <UsersPanel />
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
          const success = await createConfig(data);
          if (success) {
            setDialogOpen(false);
            setEditingConfig(null);
          }
          return success;
        }}
        onUpdate={async (id, data) => {
          const success = await updateConfig(id, data);
          if (success) {
            setDialogOpen(false);
            setEditingConfig(null);
          }
          return success;
        }}
        onRefetch={refetch}
      />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
