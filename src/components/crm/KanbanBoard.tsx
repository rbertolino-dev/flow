import { useState } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { LeadDetailModal } from "./LeadDetailModal";
import { DndContext, DragEndEvent, DragOverlay, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  leads: Lead[];
  onLeadUpdate: (leadId: string, newStatus: LeadStatus) => void;
}

const columns: { id: LeadStatus; label: string; color: string }[] = [
  { id: "novo", label: "Novo Lead", color: "bg-muted text-muted-foreground" },
  { id: "contatado", label: "Contato Feito", color: "bg-primary text-primary-foreground" },
  { id: "proposta", label: "Proposta Enviada", color: "bg-accent text-accent-foreground" },
  { id: "negociacao", label: "Em Negociação", color: "bg-warning text-warning-foreground" },
  { id: "ganho", label: "Ganho", color: "bg-success text-success-foreground" },
  { id: "perdido", label: "Perdido", color: "bg-destructive text-destructive-foreground" },
];

export function KanbanBoard({ leads, onLeadUpdate }: KanbanBoardProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;

    // Check if dropping onto a column (not another card)
    if (columns.some((col) => col.id === newStatus)) {
      onLeadUpdate(leadId, newStatus);
    }
  };

  const activeLead = activeId ? leads.find((lead) => lead.id === activeId) : null;

  return (
    <>
      <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto p-6">
          {columns.map((column) => {
            const columnLeads = leads.filter((lead) => lead.status === column.id);
            const totalValue = columnLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

            return (
              <SortableContext
                key={column.id}
                id={column.id}
                items={columnLeads.map((lead) => lead.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex-shrink-0 w-80 bg-secondary/30 rounded-lg border border-border">
                  <div className="p-4 border-b border-border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="font-semibold text-card-foreground">{column.label}</h2>
                      <Badge className={column.color} variant="secondary">
                        {columnLeads.length}
                      </Badge>
                    </div>
                    {totalValue > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Total:{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          minimumFractionDigits: 0,
                        }).format(totalValue)}
                      </p>
                    )}
                  </div>

                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <div className="p-3 space-y-3">
                      {columnLeads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                      ))}
                      {columnLeads.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Nenhum lead nesta etapa
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </SortableContext>
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
