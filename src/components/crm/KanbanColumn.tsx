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
  selectedLeadIds?: Set<string>;
  onToggleSelection?: (leadId: string) => void;
  onLeadClick: (lead: Lead) => void;
  allStages: PipelineStage[];
  onStageChange: (leadId: string, newStageId: string) => void;
  instanceMap?: Map<string, string>;
  onDeleteLead?: (leadId: string) => void;
}

export function KanbanColumn({ stage, leads, selectedLeadIds, onToggleSelection, onLeadClick, allStages, onStageChange, instanceMap, onDeleteLead }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-secondary/30 rounded-lg border transition-colors flex flex-col ${
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

      <ScrollArea className="flex-1 min-h-0">
        <SortableContext
          items={leads.map((lead) => lead.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-3 space-y-3 min-h-full">
            {leads.map((lead) => {
              const instanceName = lead.sourceInstanceId && instanceMap 
                ? instanceMap.get(lead.sourceInstanceId) 
                : undefined;
              
              return (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => onLeadClick(lead)}
                  stages={allStages}
                  onStageChange={onStageChange}
                  isSelected={selectedLeadIds?.has(lead.id) || false}
                  onToggleSelection={onToggleSelection ? () => onToggleSelection(lead.id) : undefined}
                  instanceName={instanceName}
                  onDelete={onDeleteLead}
                />
              );
            })}
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
