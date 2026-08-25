import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEvolutionConfigs, EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Archive, Tag as TagIcon, Layers, Pencil, Trash2, MessageSquare, UserCog, User, Wifi, AlertTriangle, Globe, ListPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EvolutionInstanceCard } from "@/components/crm/EvolutionInstanceCard";
import { EvolutionInstanceDialog } from "@/components/crm/EvolutionInstanceDialog";
import { EvolutionBulkCreateDialog } from "@/components/crm/EvolutionBulkCreateDialog";
import { EvolutionStatusScanner } from "@/components/crm/EvolutionStatusScanner";
import { SyncEvolutionProvidersButton } from "@/components/crm/SyncEvolutionProvidersButton";
import { EvolutionProviderBadge } from "@/components/crm/EvolutionProviderBadge";
import { useOrganizationEvolutionProviders } from "@/hooks/useOrganizationEvolutionProviders";
import { evolutionProviderLabel, urlsMatchEvolution } from "@/lib/evolutionProvider";
import { ArchivedLeadsPanel } from "@/components/crm/ArchivedLeadsPanel";
import { WhatsAppNumberValidator } from "@/components/crm/WhatsAppNumberValidator";
import { EvolutionApiDiagnostics } from "@/components/crm/EvolutionApiDiagnostics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { MessageTemplateManager } from "@/components/crm/MessageTemplateManager";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
// DESATIVADO: Funcionalidade não disponibilizada para clientes ainda
// import { ChatwootConfigPanel } from "@/components/crm/ChatwootConfigPanel";
// REMOVIDO: Facebook/Instagram não está mais disponível
// import { FacebookConfigPanel } from "@/components/crm/FacebookConfigPanel";
import { GoogleCalendarIntegrationPanel } from "@/components/calendar/GoogleCalendarIntegrationPanel";
import { MercadoPagoIntegrationPanel } from "@/components/mercado-pago/MercadoPagoIntegrationPanel";
import { AsaasIntegrationPanel } from "@/components/crm/AsaasIntegrationPanel";
import { GmailIntegrationPanel } from "@/components/crm/GmailIntegrationPanel";
// REMOVIDO: Bubble.io não está mais disponível
// import { BubbleIntegrationPanel } from "@/components/crm/BubbleIntegrationPanel";
// import { BubbleLeadsSyncPanel } from "@/components/crm/BubbleLeadsSyncPanel";
import { HubSpotIntegrationPanel } from "@/components/crm/HubSpotIntegrationPanel";
import { HubSpotListsImportPanel } from "@/components/crm/HubSpotListsImportPanel";
import { UsersPanel } from "@/components/users/UsersPanel";
import { UserProfilePanel } from "@/components/users/UserProfilePanel";
import { IntegrationsOnboarding } from "@/components/crm/IntegrationsOnboarding";
import { InstanceDisconnectionAlerts } from "@/components/crm/InstanceDisconnectionAlerts";
import { ConditionalIntegration } from "@/components/integrations/ConditionalIntegration";
import { useIntegrationAccess } from "@/hooks/useIntegrationAccess";
import { LandingPageConfigurator } from "@/components/landing-page/LandingPageConfigurator";

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("integrations");
  const { 
    configs, 
    loading, 
    createConfig, 
    updateConfig, 
    deleteConfig,
    deleteConfigs,
    toggleWebhook,
    configureWebhook,
    testConnection,
    refetch,
    refreshStatuses,
  } = useEvolutionConfigs();
  
  const { stages, createStage, updateStage, deleteStage, cleanDuplicateStages, countLeadsInStage } = usePipelineStages();
  const { tags, createTag, updateTag, deleteTag } = useTags();
  const { toast } = useToast();
  const { providers, organizationId } = useOrganizationEvolutionProviders();
  const [providerFilter, setProviderFilter] = useState("all");

  // Verificar acesso às integrações para controlar visibilidade das tabs
  const hasEvolutionAccess = useIntegrationAccess('evolution');
  const hasChatwootAccess = useIntegrationAccess('chatwoot');
  // REMOVIDO: Facebook/Instagram não está mais disponível
  // const hasFacebookAccess = useIntegrationAccess('facebook');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EvolutionConfig | null>(null);
  const [reconnectingInstance, setReconnectingInstance] = useState<EvolutionConfig | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const hasRefreshedStatuses = useRef(false);

  // Ao abrir a aba Integrações com instâncias, sincronizar status da Evolution API com o banco (corrige exibição quando instâncias estão conectadas na Evolution mas is_connected estava desatualizado)
  useEffect(() => {
    if (!hasEvolutionAccess || activeTab !== "integrations" || loading || configs.length === 0) return;
    if (hasRefreshedStatuses.current) return;
    hasRefreshedStatuses.current = true;
    refreshStatuses().catch(() => {});
  }, [activeTab, hasEvolutionAccess, loading, configs.length, refreshStatuses]);

  // Stage management
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#3b82f6");
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [leadsCountInDeletingStage, setLeadsCountInDeletingStage] = useState<number | null>(null);

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
      const success = await deleteConfig(id);
      if (success) {
        setSelectedInstanceIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const disconnectedConfigs = useMemo(
    () => configs.filter((c) => !c.is_connected),
    [configs]
  );

  const visibleConfigs = useMemo(() => {
    if (providerFilter === "all") return configs;
    const selected = providers.find((p) => p.provider_id === providerFilter);
    if (!selected) return configs;
    return configs.filter(
      (c) =>
        c.evolution_provider_id === selected.provider_id ||
        urlsMatchEvolution(c.api_url, selected.api_url),
    );
  }, [configs, providerFilter, providers]);

  const configsByProvider = useMemo(() => {
    const map = new Map<string, EvolutionConfig[]>();
    for (const config of visibleConfigs) {
      const label = evolutionProviderLabel(config.api_url, providers);
      const list = map.get(label) ?? [];
      list.push(config);
      map.set(label, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [visibleConfigs, providers]);

  const selectedCount = selectedInstanceIds.size;
  const allSelected = configs.length > 0 && selectedCount === configs.length;
  const someSelected = selectedCount > 0 && selectedCount < configs.length;
  const selectedConfigs = useMemo(
    () => configs.filter((c) => selectedInstanceIds.has(c.id)),
    [configs, selectedInstanceIds]
  );

  useEffect(() => {
    const validIds = new Set(configs.map((c) => c.id));
    setSelectedInstanceIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [configs]);

  const toggleInstanceSelection = useCallback((id: string) => {
    setSelectedInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedInstanceIds(new Set(configs.map((c) => c.id)));
      return;
    }
    setSelectedInstanceIds(new Set());
  }, [configs]);

  const handleSelectDisconnected = useCallback(() => {
    setSelectedInstanceIds(new Set(disconnectedConfigs.map((c) => c.id)));
  }, [disconnectedConfigs]);

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    setBulkDeleting(true);
    try {
      const success = await deleteConfigs(Array.from(selectedInstanceIds));
      if (success) {
        setSelectedInstanceIds(new Set());
        setBulkDeleteOpen(false);
      }
    } finally {
      setBulkDeleting(false);
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

  const handleDeleteStageClick = async (id: string) => {
    // ✅ NOVO: Verificar quantos leads há na etapa antes de mostrar o dialog
    const leadsCount = await countLeadsInStage(id);
    setLeadsCountInDeletingStage(leadsCount);
    setDeletingStageId(id);
  };

  const handleDeleteStage = async () => {
    if (deletingStageId) {
      await deleteStage(deletingStageId);
      setDeletingStageId(null);
      setLeadsCountInDeletingStage(null);
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
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="p-3 sm:p-4 lg:p-6">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Configurações</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gerencie suas integrações e configurações do sistema
              </p>
            </div>

            {/* Alertas de desconexão */}
            <div className="px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6">
              <InstanceDisconnectionAlerts instances={configs} enabled={true} />
            </div>
          </div>

      <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-10 bg-background border-b border-border mb-4 sm:mb-6 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
            <TabsList className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-8 gap-1.5 sm:gap-2 p-1 sm:p-1.5 overflow-x-auto scrollbar-hide">
            <TabsTrigger value="integrations" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              Integrações
            </TabsTrigger>
            {hasEvolutionAccess && (
              <TabsTrigger value="evolution" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
                WhatsApp
              </TabsTrigger>
            )}
            {/* DESATIVADO: Funcionalidade não disponibilizada para clientes ainda */}
            {/* {hasChatwootAccess && (
              <TabsTrigger value="chatwoot" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
                <span className="hidden sm:inline">Chatwoot</span>
                <span className="sm:hidden">Chat</span>
              </TabsTrigger>
            )} */}
            {/* REMOVIDO: Facebook/Instagram não está mais disponível */}
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              <span className="hidden md:inline">Funil & Etiquetas</span>
              <span className="md:hidden">Funil</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
              <span className="hidden sm:inline">Templates</span>
              <span className="sm:hidden">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              <Archive className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
              <span className="hidden sm:inline">Arquivados</span>
              <span className="sm:hidden">Arquivo</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              <UserCog className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
              <span className="hidden sm:inline">Usuários</span>
              <span className="sm:hidden">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
              <span className="hidden sm:inline">Perfil</span>
              <span className="sm:hidden">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="landing-page" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap min-w-fit">
              <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
              <span className="hidden sm:inline">Landing Page</span>
              <span className="sm:hidden">LP</span>
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="integrations" className="space-y-6 mt-4 sm:mt-6">
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
                <ConditionalIntegration integrationId="google-calendar">
                  <GoogleCalendarIntegrationPanel />
                </ConditionalIntegration>

                {/* Gmail */}
                <ConditionalIntegration integrationId="gmail">
                  <GmailIntegrationPanel />
                </ConditionalIntegration>

                {/* Mercado Pago */}
                <ConditionalIntegration integrationId="mercado-pago">
                  <MercadoPagoIntegrationPanel />
                </ConditionalIntegration>

                {/* Asaas */}
                <ConditionalIntegration integrationId="asaas">
                  <AsaasIntegrationPanel />
                </ConditionalIntegration>

                {/* REMOVIDO: Bubble.io não está mais disponível */}
                
                {/* HubSpot */}
                <ConditionalIntegration integrationId="hubspot">
                  <HubSpotIntegrationPanel />
                </ConditionalIntegration>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Sincronização de Dados</h3>
                <div className="grid gap-6 md:grid-cols-1">
                  {/* REMOVIDO: Sincronização de Leads do Bubble não está mais disponível */}
                  
                  {/* Importação de Listas do HubSpot */}
                  <ConditionalIntegration integrationId="hubspot">
                    <HubSpotListsImportPanel />
                  </ConditionalIntegration>
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

          {hasEvolutionAccess && (
            <TabsContent value="evolution" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              {/* Card de Nova Instância - Primeiro elemento visual */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Nova Instância WhatsApp
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">
                        Crie uma conexão, várias de uma vez, ou sincronize as Evos habilitadas para esta organização
                      </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <SyncEvolutionProvidersButton
                        organizationId={organizationId}
                        onDone={async () => {
                          await refetch();
                        }}
                        className="w-full sm:w-auto"
                      />
                      <Button 
                        onClick={() => {
                          setEditingConfig(null);
                          setDialogOpen(true);
                        }} 
                        size="default" 
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Nova Instância
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        className="w-full sm:w-auto"
                        onClick={() => setBulkCreateOpen(true)}
                        data-testid="bulk-create-instances"
                      >
                        <ListPlus className="h-4 w-4 mr-2" />
                        Criar em lote
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <EvolutionApiDiagnostics />
              
              <WhatsAppNumberValidator configs={configs} />

              {/* Seção de Instâncias Desconectadas */}
              {disconnectedConfigs.length > 0 && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Instâncias Desconectadas
                    </CardTitle>
                    <CardDescription>
                      {disconnectedConfigs.length} instância(s) desconectada(s). 
                      Reconecte para continuar usando o WhatsApp.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {disconnectedConfigs.map((config) => (
                          <div
                            key={config.id}
                            className="flex items-center justify-between p-3 border border-destructive/20 rounded-lg bg-background gap-2"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={selectedInstanceIds.has(config.id)}
                                onCheckedChange={() => toggleInstanceSelection(config.id)}
                                aria-label={`Selecionar instância ${config.instance_name}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="font-medium text-sm truncate">{config.instance_name}</p>
                                  <EvolutionProviderBadge apiUrl={config.api_url} providers={providers} />
                                </div>
                                {config.phone_number && (
                                  <p className="text-xs text-muted-foreground">Tel: {config.phone_number}</p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setReconnectingInstance(config)}
                              className="ml-2"
                            >
                              <Wifi className="h-4 w-4 mr-2" />
                              Reconectar
                            </Button>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-lg sm:text-xl">Instâncias WhatsApp</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Gerencie suas conexões com o WhatsApp. Selecione várias para excluir de uma vez.
                  </CardDescription>
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
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-muted/40"
                      data-testid="instance-bulk-toolbar"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={handleToggleSelectAll}
                          aria-label="Selecionar todas as instâncias"
                          data-testid="select-all-instances"
                        />
                        <span className="text-sm font-medium">Selecionar todas</span>
                        {selectedCount > 0 && (
                          <Badge variant="secondary">
                            {selectedCount} selecionada{selectedCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {disconnectedConfigs.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSelectDisconnected}
                            className="w-full sm:w-auto"
                          >
                            Selecionar desconectadas
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={selectedCount === 0 || bulkDeleting}
                          onClick={() => setBulkDeleteOpen(true)}
                          className="w-full sm:w-auto"
                          data-testid="bulk-delete-instances"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir selecionadas
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-muted/40">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium">Filtrar por Evo</span>
                        <Select value={providerFilter} onValueChange={setProviderFilter}>
                          <SelectTrigger className="w-[220px] h-9" data-testid="filter-evolution-provider">
                            <SelectValue placeholder="Todas as Evos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas as Evos</SelectItem>
                            {providers.map((provider) => (
                              <SelectItem key={provider.provider_id} value={provider.provider_id}>
                                {provider.provider_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <EvolutionStatusScanner configs={visibleConfigs} persistToDb onAfterPersist={refetch} />
                    {configsByProvider.map(([label, items]) => (
                      <div key={label} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <EvolutionProviderBadge apiUrl={items[0]?.api_url} providers={providers} providerName={label} />
                          <span className="text-sm text-muted-foreground">
                            {items.length} instância{items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
                          {items.map((config) => (
                            <EvolutionInstanceCard
                              key={config.id}
                              config={config}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onToggleWebhook={toggleWebhook}
                              onTest={testConnection}
                              onConfigureWebhook={configureWebhook}
                              onRefresh={refetch}
                              selected={selectedInstanceIds.has(config.id)}
                              onToggleSelect={() => toggleInstanceSelection(config.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
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
          )}

          {/* DESATIVADO: Funcionalidade não disponibilizada para clientes ainda */}
          {/* {hasChatwootAccess && (
            <TabsContent value="chatwoot" className="space-y-6">
              <ChatwootConfigPanel />
            </TabsContent>
          )} */}

          {/* REMOVIDO: Facebook/Instagram não está mais disponível */}

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
                            onClick={() => handleDeleteStageClick(stage.id)}
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

              <TabsContent value="templates" className="space-y-4 mt-4 sm:mt-6">
                <MessageTemplateManager />
              </TabsContent>

              <TabsContent value="archived" className="space-y-6 mt-4 sm:mt-6">
                <ArchivedLeadsPanel />
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-4 sm:mt-6">
                <UsersPanel />
              </TabsContent>

          <TabsContent value="profile" className="space-y-6 mt-4 sm:mt-6">
            <UserProfilePanel />
          </TabsContent>

          <TabsContent value="landing-page" className="space-y-6 mt-4 sm:mt-6">
            <LandingPageConfigurator />
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

      <EvolutionBulkCreateDialog
        open={bulkCreateOpen}
        onOpenChange={setBulkCreateOpen}
        existingNames={configs.map((c) => c.instance_name)}
        onSave={async (data) => createConfig(data, { silent: true })}
        onRefetch={refetch}
      />

      {reconnectingInstance && (
        <ReconnectInstanceDialog
          open={!!reconnectingInstance}
          onOpenChange={(open) => {
            if (!open) setReconnectingInstance(null);
          }}
          instance={reconnectingInstance}
          onReconnected={() => {
            setReconnectingInstance(null);
            refetch();
          }}
        />
      )}

      {/* ✅ NOVO: AlertDialog para confirmar exclusão de etapa com aviso de leads */}
      <AlertDialog open={!!deletingStageId} onOpenChange={(open) => {
        if (!open) {
          setDeletingStageId(null);
          setLeadsCountInDeletingStage(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              {leadsCountInDeletingStage !== null && leadsCountInDeletingStage > 0 ? (
                <>
                  <strong>⚠️ Atenção:</strong> Esta etapa possui <strong>{leadsCountInDeletingStage} {leadsCountInDeletingStage === 1 ? 'lead' : 'leads'}</strong> associado{leadsCountInDeletingStage === 1 ? '' : 's'}.
                  <br /><br />
                  Ao excluir esta etapa, todos os leads serão automaticamente movidos para a primeira etapa do funil.
                  <br /><br />
                  Esta ação não pode ser desfeita.
                </>
              ) : (
                <>
                  Esta ação não pode ser desfeita. A etapa será excluída permanentemente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!bulkDeleting) setBulkDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedCount} instância{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Esta ação não pode ser desfeita. As instâncias serão removidas permanentemente desta organização.
                </p>
                {selectedConfigs.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2 text-foreground space-y-1">
                    {selectedConfigs.slice(0, 12).map((config) => (
                      <li key={config.id} className="truncate text-xs sm:text-sm">
                        • {config.instance_name}
                      </li>
                    ))}
                    {selectedConfigs.length > 12 && (
                      <li className="text-xs text-muted-foreground">
                        + {selectedConfigs.length - 12} outra(s)
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleBulkDelete();
              }}
              disabled={bulkDeleting || selectedCount === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                `Excluir ${selectedCount} instância${selectedCount === 1 ? "" : "s"}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
                                            