import { useState, useRef, useMemo, useEffect } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { LeadDetailModal } from "./LeadDetailModal";
import { KanbanColumn } from "./KanbanColumn";
import { BulkImportPanel } from "./BulkImportPanel";
import { KanbanSettings } from "./KanbanSettings";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, DragOverEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useKanbanSettings } from "@/hooks/useKanbanSettings";
import { Loader2, Upload, ChevronLeft, ChevronRight, ArrowRight, Phone, Trash2, X, ArrowDownUp } from "lucide-react";
import { normalizePhone } from "@/lib/phoneUtils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { getUserOrganizationId, ensureUserOrganization } from "@/lib/organizationUtils";

interface KanbanBoardProps {
  leads: Lead[];
  onLeadUpdate: (leadId: string, newStatus: string) => void;
  searchQuery?: string;
  onRefetch: () => void;
  filterInstance?: string;
  filterCreatedDateStart?: string;
  filterCreatedDateEnd?: string;
  filterReturnDateStart?: string;
  filterReturnDateEnd?: string;
}

export function KanbanBoard({ leads, onLeadUpdate, searchQuery = "", onRefetch, filterInstance = "all", filterCreatedDateStart = "", filterCreatedDateEnd = "", filterReturnDateStart = "", filterReturnDateEnd = "" }: KanbanBoardProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const { stages, loading: stagesLoading } = usePipelineStages();
  const { configs } = useEvolutionConfigs();
  const { columnWidth, updateColumnWidth } = useKanbanSettings();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Criar mapa de instâncias para lookup rápido
  const instanceMap = useMemo(() => {
    const map = new Map<string, string>();
    configs?.forEach(config => {
      map.set(config.id, config.instance_name);
    });
    return map;
  }, [configs]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredLeads = leads.filter(lead => {
    // Filtro de busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const normalizedQuery = normalizePhone(searchQuery);
      const normalizedLeadPhone = normalizePhone(lead.phone);
      
      const matchesName = lead.name.toLowerCase().includes(query);
      const matchesPhone = normalizedLeadPhone.includes(normalizedQuery);
      const matchesTags = lead.tags?.some(tag => tag.name.toLowerCase().includes(query));
      
      if (!matchesName && !matchesPhone && !matchesTags) return false;
    }

    // Filtro de instância
    if (filterInstance && filterInstance !== "all") {
      if (lead.sourceInstanceId !== filterInstance) return false;
    }

    // Filtro de data de criação
    if (filterCreatedDateStart) {
      const startDate = new Date(filterCreatedDateStart);
      startDate.setHours(0, 0, 0, 0);
      if (new Date(lead.createdAt) < startDate) return false;
    }
    if (filterCreatedDateEnd) {
      const endDate = new Date(filterCreatedDateEnd);
      endDate.setHours(23, 59, 59, 999);
      if (new Date(lead.createdAt) > endDate) return false;
    }

    // Filtro de data de retorno
    if (filterReturnDateStart && lead.returnDate) {
      const startDate = new Date(filterReturnDateStart);
      startDate.setHours(0, 0, 0, 0);
      if (new Date(lead.returnDate) < startDate) return false;
    }
    if (filterReturnDateEnd && lead.returnDate) {
      const endDate = new Date(filterReturnDateEnd);
      endDate.setHours(23, 59, 59, 999);
      if (new Date(lead.returnDate) > endDate) return false;
    }

    return true;
  });

  // Map de etapas válidas (apenas da organização atual)
  const stageIdSet = useMemo(() => new Set(stages.map(s => s.id)), [stages]);
  
  // Primeira etapa ordenada por posição (não alfabética)
  const firstStageId = useMemo(() => {
    const sorted = [...stages].sort((a, b) => a.position - b.position);
    return sorted[0]?.id;
  }, [stages]);

  // Normaliza leads: se a etapa estiver ausente ou inválida, usa a primeira etapa DA ORG
  const normalizedLeads = useMemo(() => {
    return filteredLeads.map(l => {
      if (!l.stageId || !stageIdSet.has(l.stageId)) {
        return { ...l, stageId: firstStageId };
      }
      return l;
    });
  }, [filteredLeads, stageIdSet, firstStageId]);

  // Correção automática no banco APENAS para leads com etapa inválida
  useEffect(() => {
    if (!firstStageId || stages.length === 0) return;
    
    const invalids = filteredLeads.filter(l => !l.stageId || !stageIdSet.has(l.stageId));
    if (invalids.length === 0) return;

    (async () => {
      for (const lead of invalids) {
        try {
          // Validação extra: garantir que estamos usando etapa da mesma org
          const targetStage = stages.find(s => s.id === firstStageId);
          if (!targetStage) continue;
          
          await supabase
            .from('leads')
            .update({ stage_id: firstStageId })
            .eq('id', lead.id);
            
          console.log(`✅ Etapa corrigida para ${lead.name} -> ${targetStage.name}`);
        } catch (e) {
          console.error('Falha ao corrigir etapa do lead', lead.id, e);
        }
      }
      onRefetch();
    })();
  }, [filteredLeads, stageIdSet, firstStageId, stages, onRefetch]);

  if (stagesLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;
    
    // Check if we're dropping over a stage column
    const targetStage = stages.find(s => s.id === overId);
    if (targetStage) {
      onLeadUpdate(leadId, targetStage.id);
    }
  };

  // Normalização e correção movidas para antes do carregamento.


  const activeLead = activeId ? leads.find((lead) => lead.id === activeId) : null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleAllInStage = (stageId: string, leadIds: string[]) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      const allSelected = leadIds.every(id => newSet.has(id));
      
      if (allSelected) {
        // Desmarcar todos da etapa
        leadIds.forEach(id => newSet.delete(id));
      } else {
        // Marcar todos da etapa
        leadIds.forEach(id => newSet.add(id));
      }
      
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  const handleMoveToNextStage = async () => {
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    
    for (const lead of selectedLeads) {
      const currentStageIndex = stages.findIndex(s => s.id === lead.stageId);
      if (currentStageIndex < stages.length - 1) {
        const nextStage = stages[currentStageIndex + 1];
        await onLeadUpdate(lead.id, nextStage.id);
      }
    }

    toast({
      title: "Leads movidos",
      description: `${selectedLeads.length} lead(s) movido(s) para a próxima etapa`,
    });

    clearSelection();
  };

  const handleAddToCallQueue = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Sessão expirada",
        description: "Faça login para adicionar à Fila de Ligações.",
        variant: "destructive",
      });
      return;
    }

    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    
    if (selectedLeads.length === 0) {
      toast({
        title: "Selecione ao menos um lead",
        description: "Marque os cards e clique em Fila para adicionar.",
      });
      return;
    }

    try {
      let addedCount = 0;
      let skippedCount = 0;

      for (const lead of selectedLeads) {
        const { data, error } = await supabase.rpc('add_to_call_queue_secure', {
          p_lead_id: lead.id,
          p_scheduled_for: new Date().toISOString(),
          p_priority: 'medium',
          p_notes: null,
        });

        if (error) {
          console.error('Erro ao adicionar lead à fila:', error);
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('já está na fila')) {
            // Lead já está na fila, não contar como erro
            continue;
          }
          skippedCount++;
          if (msg.includes('não pertence à organização')) {
            toast({
              title: `Sem permissão para ${lead.name}`,
              description: 'Você não pertence à organização deste lead.',
              variant: 'destructive',
            });
          } else if (msg.includes('lead não encontrado') || msg.includes('não encontrado')) {
            toast({
              title: `Lead não encontrado: ${lead.name}`,
              description: 'O lead pode ter sido removido.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: `Falha ao adicionar ${lead.name}`,
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast({
          title: "Adicionado à fila",
          description: `${addedCount} lead(s) adicionado(s) à fila de ligações${skippedCount > 0 ? ` (${skippedCount} com erro)` : ''}`,
        });
      } else {
        toast({
          title: "Nenhum lead adicionado",
          description: skippedCount > 0 ? `${skippedCount} lead(s) não puderam ser adicionados.` : 'Nada para adicionar.',
          variant: 'destructive',
        });
      }

      clearSelection();
      onRefetch();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar à fila',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSelected = async () => {
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    
    for (const lead of selectedLeads) {
      await supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', lead.id);
    }

    toast({
      title: "Leads excluídos",
      description: `${selectedLeads.length} lead(s) excluído(s)`,
    });

    clearSelection();
    onRefetch();
  };

  return (
    <>
      <div className="flex items-center justify-between p-2 sm:p-4 border-b border-border gap-2">
        <div className="flex items-center gap-2">
          <KanbanSettings
            columnWidth={columnWidth}
            onColumnWidthChange={updateColumnWidth}
          />
          
          <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
            <SelectTrigger className="w-[180px] sm:w-[200px]">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Importar em Massa</span>
              <span className="sm:hidden">Importar</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[95vw] sm:w-[600px] max-h-[80vh] overflow-y-auto p-0" align="end">
            <BulkImportPanel onImportComplete={onRefetch} showStageSelector={true} />
          </PopoverContent>
        </Popover>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart} 
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="relative h-full">
          <Button
            variant="outline"
            size="icon"
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/95 backdrop-blur shadow-lg hover:bg-accent"
            onClick={() => handleScroll('left')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/95 backdrop-blur shadow-lg hover:bg-accent"
            onClick={() => handleScroll('right')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div ref={scrollContainerRef} className="flex gap-2 sm:gap-4 h-full overflow-x-auto overflow-y-hidden p-3 sm:p-6 pb-20 sm:pb-24 kanban-scroll pl-6 pr-6">
            {stages.map((stage) => {
              const columnLeads = normalizedLeads
                .filter((lead) => lead.stageId === stage.id)
                .sort((a, b) => {
                  const dateA = new Date(a.createdAt).getTime();
                  const dateB = new Date(b.createdAt).getTime();
                  return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
                });
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={columnLeads}
                  selectedLeadIds={selectedLeadIds}
                  onToggleSelection={toggleLeadSelection}
                  onToggleAllInStage={toggleAllInStage}
                  onLeadClick={setSelectedLead}
                  allStages={stages}
                  onStageChange={onLeadUpdate}
                  instanceMap={instanceMap}
                  columnWidth={columnWidth}
                  onRefetch={onRefetch}
                  onDeleteLead={async (leadId) => {
                    await supabase
                      .from('leads')
                      .update({ deleted_at: new Date().toISOString() })
                      .eq('id', leadId);
                    toast({
                      title: "Lead excluído",
                      description: "O lead foi removido com sucesso",
                    });
                    onRefetch();
                  }}
                />
              );
            })}
          </div>
        </div>

        <style>{`
          .kanban-scroll::-webkit-scrollbar {
            width: 14px;
            height: 14px;
          }
          .kanban-scroll::-webkit-scrollbar-track {
            background: hsl(var(--muted));
            border-radius: 8px;
            margin: 4px;
          }
          .kanban-scroll::-webkit-scrollbar-thumb {
            background: hsl(var(--primary) / 0.5);
            border-radius: 8px;
            border: 2px solid hsl(var(--muted));
          }
          .kanban-scroll::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--primary) / 0.7);
          }
          .kanban-scroll {
            scrollbar-width: auto;
            scrollbar-color: hsl(var(--primary) / 0.5) hsl(var(--muted));
          }
        `}</style>

        <DragOverlay>
          {activeLead ? (
            <LeadCard 
              lead={activeLead} 
              onClick={() => {}}
              stages={stages}
              onStageChange={() => {}}
              isSelected={false}
              onToggleSelection={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Barra de ações para seleção múltipla */}
      {selectedLeadIds.size > 0 && (
        <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-2xl border border-primary-foreground/20 px-3 sm:px-6 py-2 sm:py-4 flex items-center gap-2 sm:gap-4 animate-scale-in max-w-[95vw]">
          <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-base font-semibold shrink-0">
            {selectedLeadIds.size}
          </Badge>
          
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMoveToNextStage}
              className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
            >
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Próxima Etapa</span>
              <span className="sm:hidden">Próx.</span>
            </Button>
            
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddToCallQueue}
              className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
            >
              <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Fila</span>
            </Button>
            
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteSelected}
              className="gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            className="ml-1 sm:ml-2 hover:bg-primary-foreground/20 shrink-0"
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      )}

        {selectedLead && (
          <LeadDetailModal
            lead={selectedLead}
            open={!!selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdated={onRefetch}
          />
        )}
    </>
  );
}
