import { memo } from "react";
import { Lead } from "@/types/lead";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageCircle,
  Trash2,
  ArrowRightCircle,
  Clock,
} from "lucide-react";
import { LeadAssigneesPopover } from "./LeadAssigneesPopover";
import { LeadTagsPopover } from "./LeadTagsPopover";
import type { LeadOrgTagsPickerApi } from "./leadTagPickerTypes";
import { buildCopyNumber, buildTelUri } from "@/lib/phoneUtils";

interface LeadCardActionsBarProps {
  lead: Lead;
  compact: boolean;
  pendingScheduledCount: number;
  onScheduleLead?: (lead: Lead) => void;
  onDelete?: (leadId: string) => void;
  onRefetch?: () => void;
  orgTagsApi: LeadOrgTagsPickerApi;
  showHeavyAssignees: boolean;
  onTransferClick: (e: React.MouseEvent) => void;
}

export const LeadCardActionsBar = memo(function LeadCardActionsBar({
  lead,
  compact,
  pendingScheduledCount,
  onScheduleLead,
  onDelete,
  onRefetch,
  orgTagsApi,
  showHeavyAssignees,
  onTransferClick,
}: LeadCardActionsBarProps) {
  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const copyNumber = buildCopyNumber(lead.phone);
    if (!copyNumber) return;
    window.open(`https://wa.me/${copyNumber}`, "_blank");
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = buildTelUri(lead.phone);
  };

  const handleScheduleLeadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onScheduleLead?.(lead);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(lead.id);
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 pt-1"
        onPointerDownCapture={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {lead.phone && (
          <>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleWhatsAppClick}>
              <MessageCircle className="h-3 w-3" />
            </Button>
            {onScheduleLead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 relative"
                onClick={handleScheduleLeadClick}
                title={
                  pendingScheduledCount > 0
                    ? `${pendingScheduledCount} mensagem(ns) agendada(s)`
                    : "Agendar mensagens"
                }
              >
                <Clock className="h-3 w-3" />
                {pendingScheduledCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-[9px] font-medium text-primary-foreground flex items-center justify-center leading-none">
                    {pendingScheduledCount > 99 ? "99+" : pendingScheduledCount}
                  </span>
                )}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handlePhoneClick}>
              <Phone className="h-3 w-3" />
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={onTransferClick}
          title="Transferir para outra etapa"
        >
          <ArrowRightCircle className="h-3 w-3" />
        </Button>

        {showHeavyAssignees ? (
          <LeadAssigneesPopover
            leadId={lead.id}
            assignees={lead.assignees ?? []}
            onRefetch={onRefetch}
            compact
            tooltipFallbackDisplay={lead.assignedTo}
          />
        ) : null}

        <LeadTagsPopover
          leadId={lead.id}
          leadTags={lead.tags ?? []}
          onRefetch={onRefetch}
          compact
          orgTagsApi={orgTagsApi}
        />

        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 ml-auto text-destructive hover:text-destructive"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 pt-2 flex-wrap"
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {lead.phone && (
        <>
          <Button size="sm" variant="outline" className="flex-1 min-w-[100px]" onClick={handleWhatsAppClick}>
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          {onScheduleLead && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-[100px] relative"
              onClick={handleScheduleLeadClick}
              title={
                pendingScheduledCount > 0
                  ? `${pendingScheduledCount} mensagem(ns) agendada(s)`
                  : "Agendar mensagens"
              }
            >
              <Clock className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">Agendar</span>
              {pendingScheduledCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground flex items-center justify-center">
                  {pendingScheduledCount > 99 ? "99+" : pendingScheduledCount}
                </span>
              )}
            </Button>
          )}
          <Button size="sm" variant="outline" className="flex-1 min-w-[100px]" onClick={handlePhoneClick}>
            <Phone className="h-4 w-4 mr-2" />
            Ligar
          </Button>
        </>
      )}

      <Button
        size="sm"
        variant="outline"
        className="flex-1"
        onClick={onTransferClick}
        title="Transferir para outra etapa"
      >
        <ArrowRightCircle className="h-4 w-4 mr-2" />
        Transferir
      </Button>

      {showHeavyAssignees ? (
        <LeadAssigneesPopover
          leadId={lead.id}
          assignees={lead.assignees ?? []}
          onRefetch={onRefetch}
          tooltipFallbackDisplay={lead.assignedTo}
        />
      ) : null}

      <LeadTagsPopover
        leadId={lead.id}
        leadTags={lead.tags ?? []}
        onRefetch={onRefetch}
        orgTagsApi={orgTagsApi}
      />

      {onDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});
