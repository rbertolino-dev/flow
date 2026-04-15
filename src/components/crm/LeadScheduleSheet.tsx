import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
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
  const { configs } = useEvolutionConfigs();

  const instancesForPanel = useMemo(() => {
    return (configs || []).map((c) => ({
      id: c.id,
      instance_name: c.instance_name,
      is_connected: Boolean(c.is_connected),
    }));
  }, [configs]);

  const connectedInstances = useMemo(
    () => instancesForPanel.filter((i) => i.is_connected),
    [instancesForPanel]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg z-[60] flex flex-col p-0 gap-0 border-l"
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
              {instancesForPanel.length > 0 && connectedInstances.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  Nenhuma instância conectada. Verifique a conexão em Configurações.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
