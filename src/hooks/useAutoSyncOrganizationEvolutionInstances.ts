import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  hasAutoSyncedOrganizationEvolutionInstances,
  runOrganizationEvolutionInstancesSyncOnce,
  evolutionSyncResultHasUserVisibleChange,
} from "@/lib/autoSyncOrganizationEvolutionInstances";
import { describeEvolutionSyncResult } from "@/lib/syncOrganizationEvolutionInstances";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

interface UseAutoSyncOrganizationEvolutionInstancesOptions {
  organizationId?: string | null;
  enabled?: boolean;
  onDone?: () => void | Promise<void>;
}

/**
 * Sincroniza as Evos habilitadas 1x por organização na sessão do navegador,
 * depois do primeiro paint, sem bloquear a página.
 */
export function useAutoSyncOrganizationEvolutionInstances({
  organizationId,
  enabled = true,
  onDone,
}: UseAutoSyncOrganizationEvolutionInstancesOptions): void {
  const { toast } = useToast();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!enabled || !organizationId) return;
    if (hasAutoSyncedOrganizationEvolutionInstances(organizationId)) return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void runOrganizationEvolutionInstancesSyncOnce(organizationId).then(async (result) => {
        if (cancelled || !result) return;
        if (!result.ok) return;
        if (evolutionSyncResultHasUserVisibleChange(result)) {
          toastRef.current({
            title: "Evos sincronizadas",
            description: describeEvolutionSyncResult(result),
          });
        }
        await onDoneRef.current?.();
      });
    };

    const win = window as IdleWindow;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(run, 1500);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [organizationId, enabled]);
}
