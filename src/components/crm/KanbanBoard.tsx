import { useState } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { LeadDetailModal } from "./LeadDetailModal";
import { KanbanColumn } from "./KanbanColumn";
import { BulkImportPanel } from "./BulkImportPanel";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, DragOverEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Loader2, Upload } from "lucide-react";
import { normalizePhone } from "@/lib/phoneUtils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface KanbanBoardProps {
  leads: Lead[];
  onLeadUpdate: (leadId: string, newStatus: string) => void;
  searchQuery?: string;
  onRefetch: () => void;
}

export function KanbanBoard({ leads, onLeadUpdate, searchQuery = "", onRefetch }: KanbanBoardProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { stages, loading: stagesLoading } = usePipelineStages();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const normalizedQuery = normalizePhone(searchQuery);
    const normalizedLeadPhone = normalizePhone(lead.phone);
    
    const matchesName = lead.name.toLowerCase().includes(query);
    const matchesPhone = normalizedLeadPhone.includes(normalizedQuery);
    const matchesTags = lead.tags?.some(tag => tag.name.toLowerCase().includes(query));
    return matchesName || matchesPhone || matchesTags;
  });

  const activeLead = activeId ? leads.find((lead) => lead.id === activeId) : null;

  return (
    <>
      <div className="flex items-center justify-end p-4 border-b border-border">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Importar em Massa
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[600px] max-h-[80vh] overflow-y-auto p-0" align="end">
            <BulkImportPanel onImportComplete={onRefetch} />
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
        <div className="flex gap-4 h-full overflow-x-auto overflow-y-hidden p-6 scrollbar-visible">
          {stages.map((stage) => {
            const columnLeads = filteredLeads.filter((lead) => lead.stageId === stage.id);
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={columnLeads}
                onLeadClick={setSelectedLead}
                allStages={stages}
                onStageChange={onLeadUpdate}
              />
            );
          })}
        </div>

        <style>{`
          .scrollbar-visible::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          .scrollbar-visible::-webkit-scrollbar-track {
            background: hsl(var(--muted));
            border-radius: 6px;
          }
          .scrollbar-visible::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.3);
            border-radius: 6px;
          }
          .scrollbar-visible::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--muted-foreground) / 0.5);
          }
          .scrollbar-visible {
            scrollbar-width: thin;
            scrollbar-color: hsl(var(--muted-foreground) / 0.3) hsl(var(--muted));
          }
        `}</style>

        <DragOverlay>
          {activeLead ? (
            <LeadCard 
              lead={activeLead} 
              onClick={() => {}}
              stages={stages}
              onStageChange={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </>
  );
}
