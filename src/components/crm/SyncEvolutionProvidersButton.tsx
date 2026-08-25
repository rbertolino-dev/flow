import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  describeEvolutionSyncResult,
  syncOrganizationEvolutionInstances,
} from "@/lib/syncOrganizationEvolutionInstances";
import { invalidateEvolutionProvidersCache } from "@/hooks/useOrganizationEvolutionProviders";
import {
  getAutoSyncOrganizationEvolutionTimestamp,
  markAutoSyncedOrganizationEvolutionInstances,
  subscribeEvolutionOrgInstancesSync,
} from "@/lib/autoSyncOrganizationEvolutionInstances";

interface SyncEvolutionProvidersButtonProps {
  organizationId?: string | null;
  onDone?: () => void | Promise<void>;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}

export function SyncEvolutionProvidersButton({
  organizationId,
  onDone,
  className,
  variant = "outline",
}: SyncEvolutionProvidersButtonProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      setSyncedAt(organizationId ? getAutoSyncOrganizationEvolutionTimestamp(organizationId) : null);
    };
    read();
    return subscribeEvolutionOrgInstancesSync(read);
  }, [organizationId]);

  const handleSync = async () => {
    if (!organizationId) {
      toast({
        title: "Organização não encontrada",
        description: "Selecione uma organização para sincronizar as Evos.",
        variant: "destructive",
      });
      return;
    }
    setSyncing(true);
    try {
      const result = await syncOrganizationEvolutionInstances(organizationId);
      if (!result.ok) {
        toast({
          title: "Não foi possível sincronizar as Evos",
          description: result.error ?? "Tente novamente em instantes.",
          variant: "destructive",
        });
        return;
      }
      markAutoSyncedOrganizationEvolutionInstances(organizationId);
      toast({
        title: "Evos sincronizadas",
        description: describeEvolutionSyncResult(result),
      });
      invalidateEvolutionProvidersCache();
      await onDone?.();
    } catch (e) {
      toast({
        title: "Erro ao sincronizar Evos",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <Button
        type="button"
        variant={variant}
        onClick={() => void handleSync()}
        disabled={syncing || !organizationId}
        className={className}
        data-testid="sync-evolution-providers"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando Evos…" : "Sincronizar instâncias das Evos"}
      </Button>
      {syncedAt ? (
        <span className="text-[10px] text-muted-foreground px-1">
          Última sync nesta sessão
        </span>
      ) : null}
    </div>
  );
}
