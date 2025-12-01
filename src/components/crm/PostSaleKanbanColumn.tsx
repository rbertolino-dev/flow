import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PostSaleLead } from "@/types/postSaleLead";
import { PostSaleLeadCard } from "./PostSaleLeadCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PostSaleStage } from "@/types/postSaleLead";
import { Checkbox } from "@/components/ui/checkbox";

interface PostSaleKanbanColumnProps {
  stage: PostSaleStage;
  leads: PostSaleLead[];
  selectedLeadIds?: Set<string>;
  onToggleSelection?: (leadId: string) => void;
  onToggleAllInStage?: (stageId: string, leadIds: string[]) => void;
  onLeadClick: (lead: PostSaleLead) => void;
  allStages: PostSaleStage[];
  onStageChange: (leadId: string, newStageId: string) => void;
  onDeleteLead?: (leadId: string) => void;
  onRefetch?: () => void;
  compact?: boolean;
}

export function PostSaleKanbanColumn({ 
  stage, 
  leads, 
  selectedLeadIds, 
  onToggleSelection, 
  onToggleAllInStage,
  onLeadClick, 
  allStages, 
  onStageChange, 
  onDeleteLead, 
  onRefetch,
  compact = false 
}: PostSaleKanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  const stageLeads = leads.filter(lead => lead.stageId === stage.id);
  const allSelectedInStage = stageLeads.length > 0 && stageLeads.every(lead => selectedLeadIds?.has(lead.id));
  const someSelectedInStage = stageLeads.some(lead => selectedLeadIds?.has(lead.id));

  const handleToggleAll = () => {
    if (onToggleAllInStage) {
      onToggleAllInStage(stage.id, stageLeads.map(l => l.id));
    }
  };

  return (
    <div className="flex flex-col h-full min-w-[280px] bg-muted/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onToggleAllInStage && stageLeads.length > 0 && (
            <Checkbox
              checked={allSelectedInStage}
              ref={(el) => {
                if (el) {
                  (el as any).indeterminate = someSelectedInStage && !allSelectedInStage;
                }
              }}
              onCheckedChange={handleToggleAll}
            />
          )}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-sm truncate">{stage.name}</h3>
        </div>
        <Badge variant="secondary" className="ml-2 flex-shrink-0">
          {stageLeads.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="space-y-2 min-h-[100px]">
            {stageLeads.map((lead) => (
              <PostSaleLeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead)}
                stages={allStages}
                onStageChange={onStageChange}
                isSelected={selectedLeadIds?.has(lead.id)}
                onToggleSelection={() => onToggleSelection?.(lead.id)}
                onDelete={onDeleteLead}
                onRefetch={onRefetch}
                compact={compact}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

