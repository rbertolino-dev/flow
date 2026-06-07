import { memo, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead } from "@/types/lead";
import { LeadCard } from "./LeadCard";
import { Badge } from "@/components/ui/badge";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { ColumnWidth, getColumnWidthClass } from "@/hooks/useKanbanSettings";
import { Checkbox } from "@/components/ui/checkbox";
import type { LeadOrgTagsPickerApi } from "./leadTagPickerTypes";

/** Espaço entre cards (equivalente a space-y-3). */
const LEAD_GAP_PX = 12;
/** Altura estimada por card — calibrada com containIntrinsicSize do LeadCard. */
const ESTIMATED_CARD_HEIGHT = { compact: 120, normal: 180 } as const;
const VIRTUAL_OVERSCAN = 10;

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
  pendingScheduleCountByLead?: Record<string, number>;
  onScheduleLead?: (lead: Lead) => void;
  orgTagsApi: LeadOrgTagsPickerApi;
  leadsInCallQueue?: Set<string>;
  /** false = shell leve (coluna fora do viewport horizontal). */
  horizontalInView?: boolean;
}

export const KanbanColumn = memo(function KanbanColumn({
  stage,
  leads,
  selectedLeadIds,
  onToggleSelection,
  onToggleAllInStage,
  onLeadClick,
  allStages,
  stagesLoading,
  onStageChange,
  instanceMap,
  onDeleteLead,
  columnWidth,
  onRefetch,
  onEditLeadName,
  compact = false,
  pendingScheduleCountByLead = {},
  onScheduleLead,
  orgTagsApi,
  leadsInCallQueue,
  horizontalInView = true,
}: KanbanColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columnInView, setColumnInView] = useState(false);
  const estimatedRowHeight = compact ? ESTIMATED_CARD_HEIGHT.compact : ESTIMATED_CARD_HEIGHT.normal;

  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setColumnInView(true);
        }
      },
      { root: null, rootMargin: "240px 120px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const mergeColumnRef = (node: HTMLDivElement | null) => {
    columnRef.current = node;
    setNodeRef(node);
  };

  const rowVirtualizer = useVirtualizer({
    count: columnInView && horizontalInView ? leads.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    gap: LEAD_GAP_PX,
    overscan: VIRTUAL_OVERSCAN,
  });

  const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  const totalLeads = leads.length;
  const sortableIds = leads.map((lead) => lead.id);

  const allSelected = leads.length > 0 && leads.every((lead) => selectedLeadIds?.has(lead.id));

  const handleToggleAll = () => {
    if (onToggleAllInStage) {
      const leadIds = leads.map((lead) => lead.id);
      onToggleAllInStage(stage.id, leadIds);
    }
  };

  return (
    <div
      ref={mergeColumnRef}
      className={`flex-shrink-0 h-full min-h-0 ${getColumnWidthClass(columnWidth)} bg-secondary/30 rounded-lg border transition-colors flex flex-col ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
      data-kanban-column-lead-count={totalLeads}
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
                  aria-label={
                    allSelected
                      ? "Desmarcar todos os leads desta etapa"
                      : "Selecionar todos os leads desta etapa"
                  }
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
            {totalLeads}
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

      <div
        ref={scrollRef}
        className="flex-1 basis-0 min-h-[min(100dvh,1320px)] overflow-x-auto overflow-y-auto [contain:layout_style]"
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum lead nesta etapa</div>
          ) : !horizontalInView ? (
            <div
              className="min-h-[160px] px-4 py-4 text-center text-xs text-muted-foreground"
              aria-hidden
            >
              {totalLeads} lead{totalLeads === 1 ? "" : "s"}
            </div>
          ) : !columnInView ? (
            <div
              className="min-h-[120px]"
              aria-hidden
              style={{
                height: Math.min(leads.length, 3) * (estimatedRowHeight + LEAD_GAP_PX),
              }}
            />
          ) : (
            <div
              className="relative w-full min-w-max px-4 pl-3 pr-4 pt-4 pb-4"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const lead = leads[virtualRow.index];
                const instanceName =
                  lead.sourceInstanceId && instanceMap
                    ? instanceMap.get(lead.sourceInstanceId)
                    : undefined;

                return (
                  <div
                    key={lead.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full box-border pr-2 sm:pr-3"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <LeadCard
                      lead={lead}
                      onClick={() => onLeadClick(lead)}
                      stages={allStages}
                      stagesLoading={stagesLoading}
                      onStageChange={onStageChange}
                      isSelected={selectedLeadIds?.has(lead.id) || false}
                      onToggleSelection={
                        onToggleSelection ? () => onToggleSelection(lead.id) : undefined
                      }
                      instanceName={instanceName}
                      onDelete={onDeleteLead}
                      onRefetch={onRefetch}
                      onEditName={onEditLeadName}
                      compact={compact}
                      pendingScheduledCount={pendingScheduleCountByLead[lead.id] ?? 0}
                      onScheduleLead={onScheduleLead}
                      orgTagsApi={orgTagsApi}
                      isInCallQueue={leadsInCallQueue?.has(lead.id) ?? false}
                      horizontalInView={horizontalInView && columnInView}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
});
