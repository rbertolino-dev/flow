import { LeadAssignee } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, X } from "lucide-react";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { syncLeadPrimaryAssignedTo } from "@/lib/leadAssignees";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

function buildAssigneesTooltipText(
  assignees: LeadAssignee[],
  fallbackDisplay?: string | null
): string {
  if (assignees.length > 0) {
    return assignees.map((a) => a.fullName || a.email).join("\n");
  }
  const fb = fallbackDisplay?.trim();
  if (fb && fb !== "Não atribuído") {
    return fb;
  }
  return "Nenhum responsável\nClique para adicionar";
}

interface LeadAssigneesPopoverProps {
  leadId: string;
  assignees: LeadAssignee[];
  onRefetch?: () => void;
  compact?: boolean;
  /** Ex.: no modal de detalhes — botão “Gerenciar” mais visível */
  showManageLabel?: boolean;
  /** Texto legado de `lead.assignedTo` quando não há linhas em `lead_assignees` */
  tooltipFallbackDisplay?: string | null;
}

export function LeadAssigneesPopover({
  leadId,
  assignees,
  onRefetch,
  compact = false,
  showManageLabel = false,
  tooltipFallbackDisplay,
}: LeadAssigneesPopoverProps) {
  const { users, loading: usersLoading } = useOrganizationUsers();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addUserId, setAddUserId] = useState<string>("");

  const assignedIds = new Set(assignees.map((a) => a.userId));
  const available = users.filter((u) => !assignedIds.has(u.id));

  const handleAdd = async () => {
    if (!addUserId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("lead_assignees")
        .insert({ lead_id: leadId, user_id: addUserId });
      if (error) throw error;
      await syncLeadPrimaryAssignedTo(leadId);
      toast({ title: "Responsável adicionado" });
      setAddUserId("");
      onRefetch?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Não foi possível adicionar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("lead_assignees")
        .delete()
        .eq("lead_id", leadId)
        .eq("user_id", userId);
      if (error) throw error;
      await syncLeadPrimaryAssignedTo(leadId);
      toast({ title: "Responsável removido" });
      onRefetch?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Não foi possível remover";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const summaryLabel =
    assignees.length === 0
      ? ""
      : assignees.length <= 2
        ? assignees.map((a) => a.fullName || a.email).join(", ")
        : `${assignees
            .slice(0, 2)
            .map((a) => a.fullName || a.email)
            .join(", ")} +${assignees.length - 2}`;

  const tooltipBody = buildAssigneesTooltipText(assignees, tooltipFallbackDisplay);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <span className="inline-flex max-w-full shrink-0">
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={showManageLabel ? "outline" : "ghost"}
                size="sm"
                className={
                  compact
                    ? "h-6 px-2 shrink-0"
                    : showManageLabel
                      ? "shrink-0"
                      : "h-8 px-2 shrink-0 max-w-[160px]"
                }
                disabled={busy}
                aria-label="Gerenciar responsáveis do lead"
                onClick={(e) => e.stopPropagation()}
              >
                <Users className={compact ? "h-3 w-3" : "h-4 w-4"} />
                {showManageLabel && (
                  <span className="ml-2 text-sm">Gerenciar responsáveis</span>
                )}
                {!compact && !showManageLabel && summaryLabel && (
                  <span className="ml-1 text-xs text-muted-foreground truncate">{summaryLabel}</span>
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
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-80"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="font-medium text-sm">Responsáveis</div>
          <div className="flex flex-wrap gap-1.5 min-h-[24px]">
            {assignees.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhum responsável</span>
            ) : (
              assignees.map((a) => (
                <Badge
                  key={a.userId}
                  variant="secondary"
                  className="pl-2 pr-1 py-0.5 gap-1 font-normal"
                >
                  <span className="truncate max-w-[180px]">
                    {a.fullName || a.email}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-destructive/15"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(a.userId);
                    }}
                    aria-label={`Remover ${a.fullName || a.email}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))
            )}
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Adicionar membro</span>
            {usersLoading ? (
              <span className="text-xs text-muted-foreground">Carregando…</span>
            ) : available.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Todos os membros já estão atribuídos
              </span>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={addUserId || undefined}
                  onValueChange={setAddUserId}
                  disabled={busy}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Escolher usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !addUserId}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd();
                  }}
                >
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
