import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { ColumnWidth, getColumnWidthClass } from "@/hooks/useKanbanSettings";
import { Checkbox } from "@/components/ui/checkbox";

interface KanbanColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  selectedLeadIds?: Set<string>;
  onToggleSelection?: (leadId: string) => void;
  onToggleAllInStage?: (stageId: string, leadIds: string[]) => void;
  onLeadClick: (lead: Lead) => void;
  allStages: PipelineStage[];
  stagesLoading?: boolean;
  onStageChange: (leadId: string, newStageId: string) => void;
  instanceMap?: Map<string, string>;
  onDeleteLead?: (leadId: string) => void;
  columnWidth: ColumnWidth;
  onRefetch?: () => void;
  onEditLeadName?: (leadId: string, newName: string) => Promise<void>;
  compact?: boolean;
}

export function KanbanColumn({ stage, leads, selectedLeadIds, onToggleSelection, onToggleAllInStage, onLeadClick, allStages, stagesLoading, onStageChange, instanceMap, onDeleteLead, columnWidth, onRefetch, onEditLeadName, compact = false }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  
  // Verificar se todos os leads da etapa estão selecionados
  const allSelected = leads.length > 0 && leads.every(lead => selectedLeadIds?.has(lead.id));
  const someSelected = leads.some(lead => selectedLeadIds?.has(lead.id)) && !allSelected;

  const handleToggleAll = () => {
    if (onToggleAllInStage) {
      const leadIds = leads.map(lead => lead.id);
      onToggleAllInStage(stage.id, leadIds);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 ${getColumnWidthClass(columnWidth)} bg-secondary/30 rounded-lg border transition-colors flex flex-col ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="p-3 sm:p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {onToggleAllInStage && leads.length > 0 && (
              <div className="flex items-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleToggleAll}
                  className="h-5 w-5"
                  title={allSelected ? "Desmarcar todos" : "Selecionar todos"}
                  aria-label={allSelected ? "Desmarcar todos os leads desta etapa" : "Selecionar todos os leads desta etapa"}
                />
              </div>
            )}
            <h2 className="font-semibold text-card-foreground">{stage.name}</h2>
          </div>
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

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
        <SortableContext
          items={leads.map((lead) => lead.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-4 pl-3 pr-4 space-y-3 min-h-full min-w-max">
            {leads.map((lead) => {
              const instanceName = lead.sourceInstanceId && instanceMap 
                ? instanceMap.get(lead.sourceInstanceId) 
                : undefined;
              
              return (
                <div key={lead.id} className="mr-2 sm:mr-3">
                  <LeadCard 
                    lead={lead} 
                    onClick={() => onLeadClick(lead)}
                    stages={allStages}
                    stagesLoading={stagesLoading}
                    onStageChange={onStageChange}
                    isSelected={selectedLeadIds?.has(lead.id) || false}
                    onToggleSelection={onToggleSelection ? () => onToggleSelection(lead.id) : undefined}
                    instanceName={instanceName}
                    onDelete={onDeleteLead}
                    onRefetch={onRefetch}
                    onEditName={onEditLeadName}
                    compact={compact}
                  />
                </div>
              );
            })}
            {leads.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lead nesta etapa
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
