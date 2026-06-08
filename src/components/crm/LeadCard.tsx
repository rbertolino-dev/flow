import { Lead } from "@/types/lead";
import { formatBrazilianPhone, formatBrazilianCep, normalizeCep } from "@/lib/phoneUtils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Smartphone, PhoneCall, Pencil, MapPin, Paperclip, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, memo, useEffect, useRef, type CSSProperties } from "react";
import { LeadCardActionsBar } from "./LeadCardActionsBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { Checkbox } from "@/components/ui/checkbox";
import { TransferLeadToStageDialog } from "./TransferLeadToStageDialog";
import { LeadTagsPopover } from "./LeadTagsPopover";
import { LeadBudgetBadge } from "./LeadBudgetBadge";
import type { LeadOrgTagsPickerApi } from "./leadTagPickerTypes";

function leadCardLocationLine(lead: Lead): string | null {
  const parts: string[] = [];
  if (lead.neighborhood) parts.push(lead.neighborhood);
  if (lead.city) parts.push(lead.city);
  if (lead.postalCode && normalizeCep(lead.postalCode).length === 8) {
    parts.push(formatBrazilianCep(lead.postalCode));
  }
  if (parts.length > 0) return parts.join(" · ");
  const addr = lead.address?.trim();
  if (addr) return addr.length > 44 ? `${addr.slice(0, 42)}…` : addr;
  return null;
}

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  stages: PipelineStage[];
  stagesLoading?: boolean;
  onStageChange: (leadId: string, newStageId: string) => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  instanceName?: string;
  onDelete?: (leadId: string) => void;
  onRefetch?: () => void;
  onEditName?: (leadId: string, newName: string) => Promise<void>;
  compact?: boolean;
  pendingScheduledCount?: number;
  onScheduleLead?: (lead: Lead) => void;
  /** API única do `useTags()` no funil — obrigatória para o botão de etiquetas. */
  orgTagsApi: LeadOrgTagsPickerApi;
  /** Fonte: `leadsInCallQueue` no KanbanBoard (evita N+1 em call_queue). */
  isInCallQueue?: boolean;
  /** Coluna visível no scroll horizontal — adia subcomponentes pesados nos cards. */
  horizontalInView?: boolean;
}

// ✅ OTIMIZAÇÃO: Memoizar componente para evitar re-renders desnecessários
export const LeadCard = memo(function LeadCard({
  lead,
  onClick,
  stages,
  stagesLoading = false,
  onStageChange,
  isSelected = false,
  onToggleSelection,
  instanceName,
  onDelete,
  onRefetch,
  onEditName,
  compact = false,
  pendingScheduledCount = 0,
  onScheduleLead,
  orgTagsApi,
  isInCallQueue = false,
  horizontalInView = true,
}: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });
  const locationLine = leadCardLocationLine(lead);
  const lazyHeavyContent = !horizontalInView;
  const [heavyReady, setHeavyReady] = useState(!lazyHeavyContent);
  const [showActionsBar, setShowActionsBar] = useState(!lazyHeavyContent);
  const actionsRafRef = useRef<number | null>(null);
  const showHeavyContent = !lazyHeavyContent || heavyReady;

  useEffect(() => {
    if (!lazyHeavyContent) {
      setHeavyReady(true);
      setShowActionsBar(true);
    }
  }, [lazyHeavyContent]);

  useEffect(() => {
    return () => {
      if (actionsRafRef.current != null) cancelAnimationFrame(actionsRafRef.current);
    };
  }, []);

  const enableHeavyContent = () => {
    if (lazyHeavyContent) setHeavyReady(true);
    if (!showActionsBar) {
      if (actionsRafRef.current != null) cancelAnimationFrame(actionsRafRef.current);
      actionsRafRef.current = requestAnimationFrame(() => {
        actionsRafRef.current = null;
        setShowActionsBar(true);
      });
    }
  };

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(lead.name);

  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    contentVisibility: "auto",
    containIntrinsicSize: compact ? "auto 120px" : "auto 180px",
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection();
    }
  };

  const handleTransferClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferDialogOpen(true);
  };

  const handleEditNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
  };

  const handleSaveName = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editedName.trim() && editedName !== lead.name && onEditName) {
      await onEditName(lead.id, editedName.trim());
      setIsEditingName(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(lead.name);
    setIsEditingName(false);
  };

  // Versão compacta do card
  if (compact) {
    return (
      <Card
        ref={setNodeRef}
        data-kanban-sortable-item=""
        data-lead-card=""
        style={sortableStyle}
        {...attributes}
        className={`relative p-2 transition-all duration-200 bg-card border group ${
          isDragging 
            ? 'border-primary shadow-lg scale-105' 
            : isSelected
              ? 'border-primary shadow-md ring-2 ring-primary/50'
              : 'border-border hover:shadow-md hover:border-primary/50'
        }`}
        onMouseEnter={enableHeavyContent}
        onFocusCapture={enableHeavyContent}
      >
        <button
          type="button"
          className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70 hover:bg-muted touch-none cursor-grab active:cursor-grabbing"
          aria-label="Arrastar card"
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <div className="space-y-1 cursor-pointer" onClick={onClick}>
          <div className="flex items-start gap-2">
            {onToggleSelection && (
              <div 
                className="flex items-center touch-none pt-0.5" 
                onClick={handleCheckboxClick}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onToggleSelection}
                  className="h-4 w-4 touch-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {lead.call_count > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                  <PhoneCall className="h-2.5 w-2.5" />
                  <span>{lead.call_count} ligaç{lead.call_count === 1 ? 'ão' : 'ões'}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                {isEditingName ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input 
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-sm flex-1"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleSaveName}>
                      ✓
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleCancelEdit}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">{lead.name}</h3>
                    {onEditName && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 opacity-70 hover:opacity-100 transition-opacity"
                        onClick={handleEditNameClick}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {showHeavyContent ? <LeadBudgetBadge summary={lead.budgetSummary} compact /> : null}
              {(lead.attachmentCount ?? 0) > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0.5 shrink-0 gap-0.5"
                  title={`${lead.attachmentCount} anexo(s)`}
                >
                  <Paperclip className="h-2.5 w-2.5" />
                  {lead.attachmentCount}
                </Badge>
              )}
              {isInCallQueue && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-blue-600">
                  <PhoneCall className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>
          </div>

          {lead.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatBrazilianPhone(lead.phone)}</span>
            </div>
          )}

          {locationLine && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{locationLine}</span>
            </div>
          )}

          <div className="space-y-0.5">
            {lead.createdAt && (
              <div className="text-[10px] text-muted-foreground/70">
                Criado: {new Date(lead.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
            
            {lead.returnDate && (
              <div className="text-[10px] text-muted-foreground/70">
                Retorno: {new Date(lead.returnDate).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>

          {/* ✅ Etiquetas - sempre visíveis e bem posicionadas */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
              {lead.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    borderColor: tag.color,
                    color: tag.color,
                  }}
                  className="text-[10px] px-1.5 py-0.5 shrink-0"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* ✅ Instância de origem - sempre visível */}
          {(instanceName || lead.sourceInstanceName) && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
              <Smartphone className="h-2.5 w-2.5 mr-1" />
              {instanceName || lead.sourceInstanceName || 'WhatsApp'}
            </Badge>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {lead.value && (
              <div className="flex items-center gap-1 text-xs font-medium text-success">
                <DollarSign className="h-3 w-3" />
                <span className="truncate">
                  {lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            
            {lead.unread_message_count > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0">
                {lead.unread_message_count}
              </Badge>
            )}
          </div>
        </div>

          {showActionsBar ? (
            <LeadCardActionsBar
              lead={lead}
              compact
              pendingScheduledCount={pendingScheduledCount}
              onScheduleLead={onScheduleLead}
              onDelete={onDelete}
              onRefetch={onRefetch}
              orgTagsApi={orgTagsApi}
              showHeavyAssignees={showHeavyContent}
              onTransferClick={handleTransferClick}
            />
          ) : (
            <LeadTagsPopover
              leadId={lead.id}
              leadTags={lead.tags ?? []}
              onRefetch={onRefetch}
              compact
              orgTagsApi={orgTagsApi}
            />
          )}

        <TransferLeadToStageDialog
          lead={lead}
          stages={stages}
          stagesLoading={stagesLoading}
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onTransferred={() => {
            onRefetch?.();
            setTransferDialogOpen(false);
          }}
          onStageChange={onStageChange}
        />
      </Card>
    );
  }

  // Versão normal do card
  return (
    <Card
      ref={setNodeRef}
      data-kanban-sortable-item=""
      data-lead-card=""
      style={sortableStyle}
      {...attributes}
      className={`relative p-4 transition-all duration-200 bg-card border ${
        isDragging 
          ? 'border-primary shadow-lg scale-105 rotate-2' 
          : isSelected
            ? 'border-primary shadow-md ring-2 ring-primary/50'
            : 'border-border hover:shadow-md hover:border-primary/50'
      }`}
      onMouseEnter={enableHeavyContent}
      onFocusCapture={enableHeavyContent}
    >
      <button
        type="button"
        className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-70 touch-none cursor-grab active:cursor-grabbing"
        aria-label="Arrastar card"
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="space-y-3 cursor-pointer" onClick={onClick}>
        {onToggleSelection && (
          <div 
            className="flex items-center justify-end touch-none" 
            onClick={handleCheckboxClick}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              className="h-5 w-5 touch-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="space-y-1">
          {lead.call_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <PhoneCall className="h-3 w-3" />
              <span>{lead.call_count} ligaç{lead.call_count === 1 ? 'ão' : 'ões'} realizada{lead.call_count === 1 ? '' : 's'}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 group/name">
              {isEditingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input 
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 text-lg font-bold flex-1"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-8 px-3" onClick={handleSaveName}>
                    ✓
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-3" onClick={handleCancelEdit}>
                    ✕
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-lg text-foreground line-clamp-1 flex-1">{lead.name}</h3>
                  {onEditName && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover/name:opacity-70 hover:!opacity-100 transition-opacity"
                      onClick={handleEditNameClick}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {showHeavyContent ? <LeadBudgetBadge summary={lead.budgetSummary} /> : null}
              {(lead.attachmentCount ?? 0) > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs px-2 py-1 shrink-0 gap-1"
                  title={`${lead.attachmentCount} anexo(s)`}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {lead.attachmentCount}
                </Badge>
              )}
              {isInCallQueue && (
                <Badge variant="default" className="text-xs px-2 py-1 shrink-0 bg-blue-600">
                  <PhoneCall className="h-3.5 w-3.5" />
                </Badge>
              )}
            </div>
          </div>
        </div>

        {lead.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>{formatBrazilianPhone(lead.phone)}</span>
          </div>
        )}

        {locationLine && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{locationLine}</span>
          </div>
        )}

        <div className="space-y-1">
          {lead.createdAt && (
            <div className="text-xs text-muted-foreground/70">
              Criado em: {new Date(lead.createdAt).toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
          
          {lead.returnDate && (
            <div className="text-xs text-muted-foreground/70">
              Retorno em: {new Date(lead.returnDate).toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>

        {/* ✅ Etiquetas - sempre visíveis e bem posicionadas */}
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {lead.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{
                  backgroundColor: `${tag.color}20`,
                  borderColor: tag.color,
                  color: tag.color,
                }}
                className="text-xs px-2 py-1 shrink-0"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* ✅ Instância de origem - sempre visível */}
        {(instanceName || lead.sourceInstanceName) && (
          <Badge variant="secondary" className="text-xs px-2 py-1 shrink-0">
            <Smartphone className="h-3 w-3 mr-1" />
            {instanceName || lead.sourceInstanceName || 'WhatsApp'}
          </Badge>
        )}

        {lead.value && (
          <div className="flex items-center gap-2 text-success font-semibold">
            <DollarSign className="h-4 w-4" />
            <span>{lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        )}

        {lead.unread_message_count > 0 && (
          <Badge variant="destructive" className="text-xs">
            {lead.unread_message_count} nova{lead.unread_message_count > 1 ? 's' : ''} mensage{lead.unread_message_count > 1 ? 'ns' : 'm'}
          </Badge>
        )}
      </div>

        {showActionsBar ? (
          <LeadCardActionsBar
            lead={lead}
            compact={false}
            pendingScheduledCount={pendingScheduledCount}
            onScheduleLead={onScheduleLead}
            onDelete={onDelete}
            onRefetch={onRefetch}
            orgTagsApi={orgTagsApi}
            showHeavyAssignees={showHeavyContent}
            onTransferClick={handleTransferClick}
          />
        ) : (
          <LeadTagsPopover
            leadId={lead.id}
            leadTags={lead.tags ?? []}
            onRefetch={onRefetch}
            orgTagsApi={orgTagsApi}
          />
        )}

      <TransferLeadToStageDialog
        lead={lead}
        stages={stages}
        stagesLoading={stagesLoading}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onTransferred={() => {
          onRefetch?.();
          setTransferDialogOpen(false);
        }}
        onStageChange={onStageChange}
      />
    </Card>
  );
}, (prevProps, nextProps) => {
  // ✅ Comparação customizada para evitar re-renders desnecessários
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.name === nextProps.lead.name &&
    prevProps.lead.phone === nextProps.lead.phone &&
    prevProps.lead.stageId === nextProps.lead.stageId &&
    prevProps.lead.status === nextProps.lead.status &&
    prevProps.lead.value === nextProps.lead.value &&
    prevProps.lead.assignedTo === nextProps.lead.assignedTo &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.compact === nextProps.compact &&
    prevProps.instanceName === nextProps.instanceName &&
    JSON.stringify(prevProps.lead.tags) === JSON.stringify(nextProps.lead.tags) &&
    JSON.stringify(prevProps.lead.assignees) === JSON.stringify(nextProps.lead.assignees) &&
    JSON.stringify(prevProps.lead.budgetSummary) === JSON.stringify(nextProps.lead.budgetSummary) &&
    prevProps.lead.attachmentCount === nextProps.lead.attachmentCount &&
    prevProps.lead.city === nextProps.lead.city &&
    prevProps.lead.postalCode === nextProps.lead.postalCode &&
    prevProps.lead.neighborhood === nextProps.lead.neighborhood &&
    prevProps.lead.address === nextProps.lead.address &&
    prevProps.lead.birthDate === nextProps.lead.birthDate &&
    prevProps.pendingScheduledCount === nextProps.pendingScheduledCount &&
    prevProps.onScheduleLead === nextProps.onScheduleLead &&
    prevProps.orgTagsApi.orgTags === nextProps.orgTagsApi.orgTags &&
    prevProps.orgTagsApi.orgTagsLoading === nextProps.orgTagsApi.orgTagsLoading &&
    prevProps.horizontalInView === nextProps.horizontalInView
  );
});
