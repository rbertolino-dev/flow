import { useState, useRef, useMemo } from "react";
import { PostSaleLead } from "@/types/postSaleLead";
import { PostSaleLeadCard } from "./PostSaleLeadCard";
import { PostSaleLeadDetailModal } from "./PostSaleLeadDetailModal";
import { PostSaleKanbanColumn } from "./PostSaleKanbanColumn";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";
import { Loader2, Plus, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CreatePostSaleLeadDialog } from "./CreatePostSaleLeadDialog";

interface PostSaleKanbanBoardProps {
  leads: PostSaleLead[];
  onLeadUpdate: (leadId: string, newStageId: string) => void;
  searchQuery?: string;
  onRefetch: () => void;
}

export function PostSaleKanbanBoard({ leads, onLeadUpdate, searchQuery = "", onRefetch }: PostSaleKanbanBoardProps) {
  const [selectedLead, setSelectedLead] = useState<PostSaleLead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const { stages, loading: stagesLoading } = usePostSaleStages();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    
    const query = searchQuery.toLowerCase();
    return leads.filter(lead => {
      const matchesName = lead.name.toLowerCase().includes(query);
      const matchesPhone = lead.phone.includes(query);
      const matchesEmail = lead.email?.toLowerCase().includes(query);
      const matchesCompany = lead.company?.toLowerCase().includes(query);
      
      return matchesName || matchesPhone || matchesEmail || matchesCompany;
    });
  }, [leads, searchQuery]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;
    
    const targetStage = stages.find(s => s.id === overId);
    if (targetStage) {
      onLeadUpdate(leadId, targetStage.id);
    }
  };

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
        leadIds.forEach(id => newSet.delete(id));
      } else {
        leadIds.forEach(id => newSet.add(id));
      }
      
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  const handleDeleteSelected = async () => {
    // Implementar lógica de exclusão
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A exclusão em lote será implementada em breve.",
    });
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Funil de Pós-Venda</h2>
          <Badge variant="secondary">{filteredLeads.length} clientes</Badge>
        </div>
        <Button onClick={() => setCreateLeadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Cliente
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden relative">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="h-full overflow-x-auto" ref={scrollContainerRef}>
            <div className="flex gap-4 p-4 h-full min-w-max">
              {sortedStages.map((stage) => (
                <PostSaleKanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={filteredLeads}
                  selectedLeadIds={selectedLeadIds}
                  onToggleSelection={toggleLeadSelection}
                  onToggleAllInStage={toggleAllInStage}
                  onLeadClick={setSelectedLead}
                  allStages={stages}
                  onStageChange={onLeadUpdate}
                  onRefetch={onRefetch}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeLead ? (
              <div className="opacity-50">
                <PostSaleLeadCard
                  lead={activeLead}
                  onClick={() => {}}
                  stages={stages}
                  onStageChange={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Scroll Buttons */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
          onClick={() => handleScroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
          onClick={() => handleScroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Selection Bar */}
      {selectedLeadIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground p-3 px-4 rounded-full shadow-lg flex items-center gap-2 sm:gap-4 z-50">
          <span className="text-sm sm:text-base font-medium whitespace-nowrap">
            {selectedLeadIds.size} cliente(s) selecionado(s)
          </span>
          <div className="flex gap-1 sm:gap-2">
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

      {/* Modals */}
      {selectedLead && (
        <PostSaleLeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => {
            onRefetch();
            setSelectedLead(null);
          }}
        />
      )}

      <CreatePostSaleLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onCreated={() => {
          onRefetch();
          setCreateLeadOpen(false);
        }}
      />
    </div>
  );
}

