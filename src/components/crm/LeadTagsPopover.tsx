import { useState, useMemo, useEffect, memo } from "react";
import type { Tag } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag as TagIcon, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CreateTagDialog } from "@/components/shared/CreateTagDialog";
import type { LeadOrgTagsPickerApi } from "./leadTagPickerTypes";
import { broadcastLeadTagsChanged } from "@/utils/leadTagsSync";

interface LeadTagsPopoverProps {
  leadId: string;
  leadTags: Tag[];
  onRefetch?: () => void;
  compact?: boolean;
  /** Dados do `useTags()` no KanbanBoard — evita N subscrições realtime por card. */
  orgTagsApi: LeadOrgTagsPickerApi;
}

export const LeadTagsPopover = memo(function LeadTagsPopover({
  leadId,
  leadTags,
  compact = false,
  orgTagsApi,
}: LeadTagsPopoverProps) {
  const { orgTags, orgTagsLoading, addTagToLead, removeTagFromLead, refetchOrgTags } = orgTagsApi;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busyTagId, setBusyTagId] = useState<string | null>(null);
  const [busyAdd, setBusyAdd] = useState(false);
  const [addTagId, setAddTagId] = useState<string>("");
  const [createTagOpen, setCreateTagOpen] = useState(false);

  const assignedIds = useMemo(() => new Set(leadTags.map((t) => t.id)), [leadTags]);
  const available = useMemo(
    () => orgTags.filter((t) => !assignedIds.has(t.id)),
    [orgTags, assignedIds]
  );

  const tooltipText =
    leadTags.length === 0
      ? "Nenhuma etiqueta\nClique para adicionar"
      : leadTags.map((t) => t.name).join("\n");

  useEffect(() => {
    if (!open) {
      setAddTagId("");
    }
  }, [open]);

  const handleAdd = async () => {
    if (!addTagId || busyAdd) return;
    const tag = orgTags.find((t) => t.id === addTagId);
    if (!tag) return;

    setBusyAdd(true);
    broadcastLeadTagsChanged({ leadId, action: "add", tag });
    setAddTagId("");

    try {
      const result = await addTagToLead(leadId, tag.id, { skipPreflight: true });
      if (!result.success) {
        broadcastLeadTagsChanged({ leadId, action: "remove", tag });
        return;
      }
      if (result.alreadyExists) {
        toast({
          title: "Etiqueta já associada",
          description: result.tagName ? `"${result.tagName}" já está neste lead.` : undefined,
        });
      }
    } catch {
      broadcastLeadTagsChanged({ leadId, action: "remove", tag });
      toast({
        title: "Erro ao adicionar etiqueta",
        description: "Não foi possível associar a etiqueta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusyAdd(false);
    }
  };

  const handleRemove = async (tag: Tag) => {
    if (busyTagId) return;
    setBusyTagId(tag.id);
    broadcastLeadTagsChanged({ leadId, action: "remove", tag });

    try {
      const ok = await removeTagFromLead(leadId, tag.id, { skipPreflight: true });
      if (!ok) {
        broadcastLeadTagsChanged({ leadId, action: "add", tag });
        toast({
          title: "Erro ao remover etiqueta",
          description: "Não foi possível remover a etiqueta. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch {
      broadcastLeadTagsChanged({ leadId, action: "add", tag });
      toast({
        title: "Erro ao remover etiqueta",
        description: "Não foi possível remover a etiqueta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusyTagId(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 relative">
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={
                    compact
                      ? "h-6 px-2 shrink-0"
                      : "h-8 px-2 shrink-0 max-w-[160px]"
                  }
                  aria-label="Gerenciar etiquetas do lead"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TagIcon className={compact ? "h-3 w-3" : "h-4 w-4"} />
                  {!compact && leadTags.length > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground truncate max-w-[100px]">
                      {leadTags.length === 1
                        ? leadTags[0].name
                        : `${leadTags.length} etiquetas`}
                    </span>
                  )}
                  {leadTags.length === 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
                      aria-hidden
                    />
                  )}
                </Button>
              </PopoverTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="max-w-[240px] whitespace-pre-line text-xs font-normal leading-snug"
          >
            {tooltipText}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-80"
          align="start"
          data-testid="lead-tags-popover"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div className="font-medium text-sm">Etiquetas</div>
            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
              {leadTags.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Nenhuma etiqueta — adicione abaixo
                </span>
              ) : (
                leadTags.map((t) => (
                  <Badge
                    key={t.id}
                    variant="outline"
                    className="pl-2 pr-1 py-0.5 gap-1 font-normal"
                    style={{
                      backgroundColor: `${t.color}20`,
                      borderColor: t.color,
                      color: t.color,
                    }}
                  >
                    <span className="truncate max-w-[160px]">{t.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-destructive/15"
                      disabled={busyTagId === t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemove(t);
                      }}
                      aria-label={`Remover etiqueta ${t.name}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))
              )}
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Adicionar etiqueta</span>
              {orgTagsLoading ? (
                <span className="text-xs text-muted-foreground">Carregando…</span>
              ) : available.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  {orgTags.length === 0
                    ? "Não há etiquetas na organização. Crie uma nova."
                    : "Todas as etiquetas já estão neste lead."}
                </span>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={addTagId || undefined}
                    onValueChange={setAddTagId}
                    disabled={busyAdd}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Escolher etiqueta" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyAdd || !addTagId}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleAdd();
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1"
                disabled={busyAdd || !!busyTagId}
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateTagOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Nova etiqueta
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {createTagOpen ? (
        <CreateTagDialog
          open={createTagOpen}
          onOpenChange={setCreateTagOpen}
          onTagCreated={() => {
            void refetchOrgTags();
          }}
        />
      ) : null}
    </>
  );
}, (prev, next) => {
  return (
    prev.leadId === next.leadId &&
    prev.compact === next.compact &&
    prev.orgTagsApi.orgTags === next.orgTagsApi.orgTags &&
    prev.orgTagsApi.orgTagsLoading === next.orgTagsApi.orgTagsLoading &&
    JSON.stringify(prev.leadTags) === JSON.stringify(next.leadTags)
  );
});
