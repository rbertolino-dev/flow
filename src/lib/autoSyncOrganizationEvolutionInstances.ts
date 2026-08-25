import { invalidateEvolutionProvidersCache } from "@/hooks/useOrganizationEvolutionProviders";
import {
  syncOrganizationEvolutionInstances,
  type SyncOrgEvolutionInstancesResult,
} from "@/lib/syncOrganizationEvolutionInstances";

export const EVO_ORG_INSTANCES_SYNC_STORAGE_PREFIX = "evo-org-instances-sync:";

const inFlight = new Map<string, Promise<SyncOrgEvolutionInstancesResult>>();
const listeners = new Set<() => void>();

export function evolutionOrgInstancesSyncStorageKey(organizationId: string): string {
  return `${EVO_ORG_INSTANCES_SYNC_STORAGE_PREFIX}${organizationId}`;
}

export function subscribeEvolutionOrgInstancesSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyEvolutionOrgInstancesSync(): void {
  listeners.forEach((listener) => listener());
}

export function hasAutoSyncedOrganizationEvolutionInstances(organizationId: string): boolean {
  if (!organizationId || typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(evolutionOrgInstancesSyncStorageKey(organizationId)) != null;
  } catch {
    return false;
  }
}

export function getAutoSyncOrganizationEvolutionTimestamp(organizationId: string): number | null {
  if (!organizationId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(evolutionOrgInstancesSyncStorageKey(organizationId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markAutoSyncedOrganizationEvolutionInstances(organizationId: string): void {
  if (!organizationId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(evolutionOrgInstancesSyncStorageKey(organizationId), String(Date.now()));
    notifyEvolutionOrgInstancesSync();
  } catch {
    // private mode / quota — o lock em memória ainda evita corrida no mesmo tick
  }
}

export function evolutionSyncResultHasUserVisibleChange(
  result: SyncOrgEvolutionInstancesResult,
): boolean {
  if (!result.ok) return false;
  return (
    (result.created ?? 0) > 0 ||
    (result.updated ?? 0) > 0 ||
    (result.disconnected ?? 0) > 0 ||
    (result.tagged ?? 0) > 0 ||
    (result.skipped_name_conflict ?? 0) > 0 ||
    (result.skipped_other_org ?? 0) > 0 ||
    (result.skipped_limit ?? 0) > 0
  );
}

export async function runOrganizationEvolutionInstancesSyncOnce(
  organizationId: string,
  options?: { force?: boolean },
): Promise<SyncOrgEvolutionInstancesResult | null> {
  if (!organizationId) return null;
  if (!options?.force && hasAutoSyncedOrganizationEvolutionInstances(organizationId)) {
    return null;
  }

  const existing = inFlight.get(organizationId);
  if (existing) return existing;

  const promise = (async () => {
    const result = await syncOrganizationEvolutionInstances(organizationId);
    if (result.ok) {
      markAutoSyncedOrganizationEvolutionInstances(organizationId);
      invalidateEvolutionProvidersCache();
    }
    return result;
  })();

  inFlight.set(organizationId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(organizationId);
  }
}
