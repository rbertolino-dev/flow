import { useMemo, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { ScheduleMessagePanel } from "./ScheduleMessagePanel";
import { formatBrazilianPhone } from "@/lib/phoneUtils";

export type LeadScheduleSheetTarget = {
  id: string;
  name: string;
  phone: string;
};

type LeadScheduleSheetProps = {
  lead: LeadScheduleSheetTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeadScheduleSheet({ lead, open, onOpenChange }: LeadScheduleSheetProps) {
  const { hasFeature } = useOrganizationFeatures();
  const canScheduleMessages = hasFeature("scheduled_messages");
  const { configs, refetch, refreshStatuses } = useEvolutionConfigs();
  const refetchRef = useRef(refetch);
  const refreshStatusesRef = useRef(refreshStatuses);
  refetchRef.current = refetch;
  refreshStatusesRef.current = refreshStatuses;

  /** null no BD = estado desconhecido — não tratar como desconectado (Boolean(null) era o bug). */
  const instancesForPanel = useMemo(() => {
    return (configs || []).map((c) => ({
      id: c.id,
      instance_name: c.instance_name,
      is_connected: c.is_connected === true,
      explicitlyDisconnected: c.is_connected === false,
    }));
  }, [configs]);

  /**
   * Só `open` + mudança de permissão: lista instâncias sempre; refresh Evolution (edge) só se a org pode agendar.
   * Sem isso, org sem `scheduled_messages` gerava rajadas de 401 no console ao abrir o painel.
   */
  useEffect(() => {
    if (!open) return;
    void (async () => {
      await refetchRef.current();
      if (!canScheduleMessages) return;
      await refreshStatusesRef.current();
    })();
  }, [open, canScheduleMessages]);

  const allExplicitlyDisconnected = useMemo(
    () =>
      instancesForPanel.length > 0 &&
      instancesForPanel.every((i) => i.explicitlyDisconnected),
    [instancesForPanel]
  );

  const scheduleSheetInteractOutside = (e: Event) => {
    const t = (e as unknown as { target?: EventTarget | null }).target;
    if (!(t instanceof HTMLElement)) return;
    // Select / Popper ficam fora do DOM do Sheet — sem isto o modal bloqueia cliques ou fecha o painel
    if (
      t.closest('[role="listbox"]') ||
      t.closest("[data-radix-select-viewport]") ||
      t.closest("[data-radix-popper-content-wrapper]")
    ) {
      e.preventDefault();
    }
  };

  return (
    <Sheet modal={false} open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg z-[60] flex flex-col p-0 gap-0 border-l"
        onPointerDownOutside={scheduleSheetInteractOutside}
        onInteractOutside={scheduleSheetInteractOutside}
      >
        {lead && (
          <>
            <SheetHeader className="px-6 pt-6 pb-2 text-left shrink-0 border-b border-border">
              <SheetTitle>Agendar mensagens</SheetTitle>
              <SheetDescription className="line-clamp-2">
                {lead.name}
                {lead.phone ? ` · ${formatBrazilianPhone(lead.phone)}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
              <ScheduleMessagePanel
                leadId={lead.id}
                leadPhone={lead.phone}
                instances={instancesForPanel}
                onClose={() => onOpenChange(false)}
              />
              {!instancesForPanel.length && (
                <p className="text-sm text-muted-foreground mt-2">
                  Configure uma instância em Configurações → WhatsApp.
                </p>
              )}
              {allExplicitlyDisconnected && (
                <p className="text-sm text-amber-600 mt-2">
                  Nenhuma instância conectada nesta organização. Verifique em Configurações → WhatsApp ou use
                  &quot;Testar conexão&quot; para atualizar o status.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
