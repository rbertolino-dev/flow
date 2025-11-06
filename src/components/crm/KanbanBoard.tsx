import { useState } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { LeadDetailModal } from "./LeadDetailModal";
import { KanbanColumn } from "./KanbanColumn";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, DragOverEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Loader2 } from "lucide-react";

interface KanbanBoardProps {
  leads: Lead[];
  onLeadUpdate: (leadId: string, newStatus: string) => void;
  searchQuery?: string;
}

export function KanbanBoard({ leads, onLeadUpdate, searchQuery = "" }: KanbanBoardProps) {
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
    const matchesName = lead.name.toLowerCase().includes(query);
    const matchesPhone = lead.phone.includes(query);
    const matchesTags = lead.tags?.some(tag => tag.name.toLowerCase().includes(query));
    return matchesName || matchesPhone || matchesTags;
  });

  const activeLead = activeId ? leads.find((lead) => lead.id === activeId) : null;

  return (
    <>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart} 
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto p-6">
          {stages.map((stage) => {
            const columnLeads = filteredLeads.filter((lead) => lead.stageId === stage.id);
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={columnLeads}
                onLeadClick={setSelectedLead}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} onClick={() => {}} /> : null}
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
