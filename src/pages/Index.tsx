import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadsListView } from "@/components/crm/LeadsListView";
import { CalendarView } from "@/components/crm/CalendarView";
import { CallQueue } from "@/components/crm/CallQueue";
import { LidContactsList } from "@/components/crm/LidContactsList";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PipelineStageManager } from "@/components/crm/PipelineStageManager";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { useLeads } from "@/hooks/useLeads";
import { useCallQueue } from "@/hooks/useCallQueue";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useInstanceHealthCheck } from "@/hooks/useInstanceHealthCheck";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useViewPreference } from "@/hooks/useViewPreference";
import { Loader2, Search, Plus, Filter, X, LayoutGrid, List, PhoneCall, CalendarDays } from "lucide-react";
import Settings from "./Settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const Index = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [filterInstance, setFilterInstance] = useState<string>("all");
  const [filterCreatedDateStart, setFilterCreatedDateStart] = useState<string>("");
  const [filterCreatedDateEnd, setFilterCreatedDateEnd] = useState<string>("");
  const [filterReturnDateStart, setFilterReturnDateStart] = useState<string>("");
  const [filterReturnDateEnd, setFilterReturnDateEnd] = useState<string>("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [filterInCallQueue, setFilterInCallQueue] = useState(false);
  
  const { leads, loading: leadsLoading, updateLeadStatus, refetch: refetchLeads } = useLeads();
  const { callQueue, loading: queueLoading, completeCall, rescheduleCall, addCallQueueTag, removeCallQueueTag, refetch: refetchCallQueue } = useCallQueue();
  const { stages } = usePipelineStages();
  const { viewMode, toggleView } = useViewPreference();
  const { configs } = useEvolutionConfigs();
  
  // Health check periódico das instâncias (verifica a cada 30s)
  useInstanceHealthCheck({
    instances: configs || [],
    enabled: true,
    intervalMs: 30000,
  });
  
  // Sincronização automática a cada 5 minutos
  const { lastSync, nextSync, isSyncing } = useAutoSync({ intervalMinutes: 5, enabled: true });

  const handleLeadUpdate = (leadId: string, newStatus: string) => {
    updateLeadStatus(leadId, newStatus);
  };

  const handleCallComplete = (callId: string, callNotes?: string) => {
    completeCall(callId, callNotes);
  };

  const handleCallReschedule = (callId: string, newDate: Date) => {
    rescheduleCall(callId, newDate);
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

  if (leadsLoading || queueLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleViewChange = (view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "whatsapp") {
      navigate('/whatsapp');
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
                <PipelineStageManager />
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
                    {(filterInstance !== "all" || filterCreatedDateStart || filterReturnDateStart) && (
                      <Badge variant="secondary" className="ml-2">
                        {[filterInstance !== "all", filterCreatedDateStart, filterReturnDateStart].filter(Boolean).length}
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
                filterInstance={filterInstance}
                filterCreatedDateStart={filterCreatedDateStart}
                filterCreatedDateEnd={filterCreatedDateEnd}
                filterReturnDateStart={filterReturnDateStart}
                filterReturnDateEnd={filterReturnDateEnd}
                filterInCallQueue={filterInCallQueue}
              />
            ) : viewMode === 'list' ? (
              <LeadsListView
                leads={leads}
                stages={stages}
                onRefetch={refetchLeads}
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
          onRefetch={refetchCallQueue}
        />
      )}

      {activeView === "contacts" && (
        <LidContactsList />
      )}

      {activeView === "settings" && <Settings />}
      
      <CreateLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onLeadCreated={refetchLeads}
        stages={stages}
      />
      </CRMLayout>
    </AuthGuard>
  );
};

export default Index;
