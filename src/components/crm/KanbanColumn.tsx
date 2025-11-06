import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PipelineStage } from "@/hooks/usePipelineStages";

interface KanbanColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

export function KanbanColumn({ stage, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-secondary/30 rounded-lg border transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-card-foreground">{stage.name}</h2>
          <Badge
            variant="secondary"
            style={{
              backgroundColor: `${stage.color}20`,
              borderColor: stage.color,
              color: stage.color,
            }}
          >
            {leads.length}
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
        <SortableContext
          items={leads.map((lead) => lead.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-3 space-y-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
            ))}
            {leads.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lead nesta etapa
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
