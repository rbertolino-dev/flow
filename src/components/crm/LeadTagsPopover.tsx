import { useState } from "react";
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
import { useTags } from "@/hooks/useTags";
import { useToast } from "@/hooks/use-toast";
import { CreateTagDialog } from "@/components/shared/CreateTagDialog";

interface LeadTagsPopoverProps {
  leadId: string;
  leadTags: Tag[];
  onRefetch?: () => void;
  compact?: boolean;
}

export function LeadTagsPopover({
  leadId,
  leadTags,
  onRefetch,
  compact = false,
}: LeadTagsPopoverProps) {
  const { tags, loading, addTagToLead, removeTagFromLead, refetch: refetchTagList } = useTags();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addTagId, setAddTagId] = useState<string>("");
  const [createTagOpen, setCreateTagOpen] = useState(false);

  const assignedIds = new Set(leadTags.map((t) => t.id));
  const available = tags.filter((t) => !assignedIds.has(t.id));

  const tooltipText =
    leadTags.length === 0
      ? "Nenhuma etiqueta\nClique para adicionar"
      : leadTags.map((t) => t.name).join("\n");

  const handleAdd = async () => {
    if (!addTagId) return;
    setBusy(true);
    try {
      const result = await addTagToLead(leadId, addTagId);
      if (!result.success) return;
      if (result.alreadyExists) {
        toast({
          title: "Etiqueta já associada",
          description: result.tagName
            ? `"${result.tagName}" já está neste lead.`
            : undefined,
        });
      } else {
        toast({
          title: "Etiqueta adicionada",
          description: result.tagName ? `"${result.tagName}" associada ao lead.` : undefined,
        });
      }
      setAddTagId("");
      onRefetch?.();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (tagId: string) => {
    setBusy(true);
    try {
      const ok = await removeTagFromLead(leadId, tagId);
      if (ok) {
        toast({ title: "Etiqueta removida" });
        onRefetch?.();
      }
    } finally {
      setBusy(false);
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
                  disabled={busy}
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
          onClick={(e) => e.stopPropagation()}
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
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(t.id);
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
              {loading ? (
                <span className="text-xs text-muted-foreground">Carregando…</span>
              ) : available.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  {tags.length === 0
                    ? "Não há etiquetas na organização. Crie uma nova."
                    : "Todas as etiquetas já estão neste lead."}
                </span>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={addTagId || undefined}
                    onValueChange={setAddTagId}
                    disabled={busy}
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
                    disabled={busy || !addTagId}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd();
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
                disabled={busy}
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

      <CreateTagDialog
        open={createTagOpen}
        onOpenChange={setCreateTagOpen}
        onTagCreated={() => {
          void refetchTagList();
        }}
      />
    </>
  );
}
