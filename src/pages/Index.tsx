import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadsListView } from "@/components/crm/LeadsListView";
import { CalendarView } from "@/components/crm/CalendarView";
import { CallQueue } from "@/components/crm/CallQueue";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PipelineStageManager } from "@/components/crm/PipelineStageManager";
import { TagManager } from "@/components/crm/TagManager";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { useLeads } from "@/hooks/useLeads";
import { useCallQueue } from "@/hooks/useCallQueue";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useInstanceHealthCheck } from "@/hooks/useInstanceHealthCheck";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useViewPreference } from "@/hooks/useViewPreference";
import { useFlowTriggers } from "@/hooks/useFlowTriggers";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { Loader2, Search, Plus, Filter, X, LayoutGrid, List, PhoneCall, CalendarDays, Upload } from "lucide-react";
import Settings from "./Settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState<CRMView>("kanban");
  
  // Lê o state da navegação para definir a view inicial
  useEffect(() => {
    if (location.state && (location.state as any).view) {
      const view = (location.state as any).view;
      if (view === "kanban" || view === "calls") {
        setActiveView(view);
      }
      // Limpa o state para evitar que seja aplicado novamente
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const [searchQuery, setSearchQuery] = useState("");
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [filterInstance, setFilterInstance] = useState<string>("all");
  const [filterCreatedDateStart, setFilterCreatedDateStart] = useState<string>("");
  const [filterCreatedDateEnd, setFilterCreatedDateEnd] = useState<string>("");
  const [filterReturnDateStart, setFilterReturnDateStart] = useState<string>("");
  const [filterReturnDateEnd, setFilterReturnDateEnd] = useState<string>("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [filterInCallQueue, setFilterInCallQueue] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const { leads, loading: leadsLoading, updateLeadStatus, refetch: refetchLeads } = useLeads();
  const { callQueue, loading: queueLoading, completeCall, rescheduleCall, addCallQueueTag, removeCallQueueTag, assignToUser, updateCallStatus, refetch: refetchCallQueue } = useCallQueue();
  const { stages } = usePipelineStages();
  const { tags } = useTags();
  const { viewMode, toggleView } = useViewPreference();
  const { configs } = useEvolutionConfigs();
  const { toast } = useToast();
  
  // Health check periódico das instâncias (verifica a cada 30s)
  useInstanceHealthCheck({
    instances: configs || [],
    enabled: true,
    intervalMs: 30000,
  });
  
  // Sincronização automática a cada 5 minutos
  const { lastSync, nextSync, isSyncing } = useAutoSync({ intervalMinutes: 5, enabled: true });

  // Ativar sistema de gatilhos de fluxos
  useFlowTriggers();

  // Iniciar scheduler de execuções agendadas
  useEffect(() => {
    let stopScheduler: (() => void) | null = null;
    
    import('@/lib/flowScheduler').then(({ startFlowScheduler }) => {
      stopScheduler = startFlowScheduler(1); // Verificar a cada 1 minuto
    });
    
    return () => {
      if (stopScheduler) {
        stopScheduler();
      }
    };
  }, []);

  const handleLeadUpdate = (leadId: string, newStatus: string) => {
    updateLeadStatus(leadId, newStatus);
  };

  const handleCallComplete = (callId: string, callNotes?: string) => {
    completeCall(callId, callNotes);
  };

  const handleCallReschedule = (callId: string, newDate: Date) => {
    rescheduleCall(callId, newDate);
  };

  const handleEditLeadName = async (leadId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ name: newName })
        .eq("id", leadId);

      if (error) throw error;

      // ✅ Realtime já atualiza automaticamente - não precisa refetch
      // O hook useLeads já está escutando mudanças em tempo real
      
      toast({
        title: "Nome atualizado",
        description: "O nome do contato foi atualizado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar nome",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLeadSelect = (leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const handleSelectAll = (stageId: string, select: boolean) => {
    const stageLeads = leads.filter(l => l.stageId === stageId);
    setSelectedLeads(prev => {
      const next = new Set(prev);
      stageLeads.forEach(lead => {
        if (select) {
          next.add(lead.id);
        } else {
          next.delete(lead.id);
        }
      });
      return next;
    });
  };

  const toggleStageFilter = (stageId: string) => {
    setSelectedStages(prev => {
      if (prev.includes(stageId)) {
        return prev.filter(id => id !== stageId);
      }
      return [...prev, stageId];
    });
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  if (leadsLoading || queueLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") {
      navigate('/broadcast');
    } else {
      setActiveView(view);
    }
  };

  return (
    <AuthGuard>
      <CRMLayout 
        activeView={activeView} 
        onViewChange={handleViewChange}
        syncInfo={{ lastSync, nextSync, isSyncing }}
      >
      <OnboardingBanner />
      {activeView === "kanban" && (
        <div className="h-full bg-background flex flex-col">
          <div className="p-3 sm:p-4 lg:p-6 border-b border-border space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Funil de Vendas</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Gerencie seus leads através do pipeline
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCreateLeadOpen(true)} size="sm" className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="sm:inline">Novo Contato</span>
                </Button>
                <Button onClick={() => setImportLeadsOpen(true)} size="sm" variant="outline" className="flex-1 sm:flex-none">
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="sm:inline">Importar</span>
                </Button>
                <PipelineStageManager />
                <TagManager />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleView}
                  title={
                    viewMode === 'kanban' 
                      ? 'Ver em lista' 
                      : viewMode === 'list' 
                      ? 'Ver calendário' 
                      : 'Ver em Kanban'
                  }
                >
                  {viewMode === 'kanban' ? (
                    <List className="h-4 w-4" />
                  ) : viewMode === 'list' ? (
                    <CalendarDays className="h-4 w-4" />
                  ) : (
                    <LayoutGrid className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Filtros */}
              <div className="flex gap-2 flex-wrap items-center">
              <Button
                variant={filterInCallQueue ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterInCallQueue(!filterInCallQueue)}
              >
                <PhoneCall className="h-4 w-4 mr-2" />
                Na Fila de Ligação
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros Avançados
                    {(filterInstance !== "all" || filterCreatedDateStart || filterReturnDateStart || selectedTags.length > 0) && (
                      <Badge variant="secondary" className="ml-2">
                        {[filterInstance !== "all", filterCreatedDateStart, filterReturnDateStart, selectedTags.length > 0].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Filtros</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterInstance("all");
                          setFilterCreatedDateStart("");
                          setFilterCreatedDateEnd("");
                          setFilterReturnDateStart("");
                          setFilterReturnDateEnd("");
                          setSelectedTags([]);
                        }}
                      >
                        Limpar
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Instância de Origem</label>
                      <Select value={filterInstance} onValueChange={setFilterInstance}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as instâncias" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as instâncias</SelectItem>
                          {configs?.map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              {config.instance_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Data de Criação</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={filterCreatedDateStart}
                          onChange={(e) => setFilterCreatedDateStart(e.target.value)}
                          placeholder="De"
                        />
                        <Input
                          type="date"
                          value={filterCreatedDateEnd}
                          onChange={(e) => setFilterCreatedDateEnd(e.target.value)}
                          placeholder="Até"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Data de Retorno</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={filterReturnDateStart}
                          onChange={(e) => setFilterReturnDateStart(e.target.value)}
                          placeholder="De"
                        />
                        <Input
                          type="date"
                          value={filterReturnDateEnd}
                          onChange={(e) => setFilterReturnDateEnd(e.target.value)}
                          placeholder="Até"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Etiquetas</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {tags && tags.length > 0 ? (
                          tags.map((tag) => (
                            <div key={tag.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`tag-${tag.id}`}
                                checked={selectedTags.includes(tag.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTags([...selectedTags, tag.id]);
                                  } else {
                                    setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`tag-${tag.id}`}
                                className="flex-1 flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                <Badge
                                  variant="secondary"
                                  style={{
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                    borderColor: tag.color,
                                  }}
                                  className="border"
                                >
                                  {tag.name}
                                </Badge>
                              </label>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhuma etiqueta disponível</p>
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Filtro de Etapas */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Etapas
                    {selectedStages.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedStages.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Filtrar por Etapas</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStages([])}
                        disabled={selectedStages.length === 0}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {stages.map((stage) => (
                        <div key={stage.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`stage-${stage.id}`}
                            checked={selectedStages.includes(stage.id)}
                            onCheckedChange={() => toggleStageFilter(stage.id)}
                          />
                          <label
                            htmlFor={`stage-${stage.id}`}
                            className="flex-1 flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {viewMode === 'kanban' ? (
              <KanbanBoard 
                leads={leads} 
                onLeadUpdate={handleLeadUpdate} 
                searchQuery={searchQuery} 
                onRefetch={refetchLeads}
                onEditLeadName={handleEditLeadName}
                filterInstance={filterInstance}
                filterCreatedDateStart={filterCreatedDateStart}
                filterCreatedDateEnd={filterCreatedDateEnd}
                filterReturnDateStart={filterReturnDateStart}
                filterReturnDateEnd={filterReturnDateEnd}
                filterInCallQueue={filterInCallQueue}
                callQueue={callQueue}
                filterTags={selectedTags}
              />
            ) : viewMode === 'list' ? (
              <LeadsListView
                leads={leads}
                stages={stages}
                onRefetch={refetchLeads}
                onEditLeadName={handleEditLeadName}
                selectedLeads={selectedLeads}
                onLeadSelect={handleLeadSelect}
                onSelectAll={handleSelectAll}
                filteredStages={selectedStages.length > 0 ? selectedStages : undefined}
              />
            ) : (
              <CalendarView
                leads={leads}
                onLeadUpdate={handleLeadUpdate}
              />
            )}
          </div>
        </div>
      )}

      {activeView === "calls" && (
        <CallQueue
          callQueue={callQueue}
          onCallComplete={handleCallComplete}
          onCallReschedule={handleCallReschedule}
          onAddTag={addCallQueueTag}
          onRemoveTag={removeCallQueueTag}
          onAssignToUser={assignToUser}
          onUpdateStatus={updateCallStatus}
          onRefetch={refetchCallQueue}
        />
      )}

      {activeView === "settings" && <Settings />}
      
      <CreateLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onLeadCreated={refetchLeads}
        stages={stages}
      />
      <ImportLeadsDialog
        open={importLeadsOpen}
        onOpenChange={setImportLeadsOpen}
        onLeadsImported={refetchLeads}
        stages={stages}
        tags={tags}
      />
      </CRMLayout>
    </AuthGuard>
  );
};

export default Index;
