import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  describeEvolutionSyncResult,
  syncOrganizationEvolutionInstances,
} from "@/lib/syncOrganizationEvolutionInstances";
import { invalidateEvolutionProvidersCache } from "@/hooks/useOrganizationEvolutionProviders";

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
  );
}
