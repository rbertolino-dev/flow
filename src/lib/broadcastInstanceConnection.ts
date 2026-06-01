import { syncEvolutionConnectionBatch } from "@/lib/syncEvolutionConnectionBatch";
import {
  getExplicitlyDisconnected,
  resolveDisconnectedWithLiveCheck,
  type InstanceRowForDisconnect,
  type DisconnectedInstanceInfo,
} from "@/lib/verifyInstanceConnectionLive";
import {
  parseContactList,
  type ValidationResult,
} from "@/lib/contactValidator";
import {
  validateBroadcastWhatsappBatched,
  buildValidationResultFromEdge,
  isBroadcastValidationSkipped,
  buildValidationRotatorPool,
  type BroadcastValidationProgress,
} from "@/lib/validateBroadcastWhatsapp";

/**
 * Mesma base do Disparador 2 / sync em lote: fetchInstances no servidor + is_connected no DB.
 */
export async function ensureSyncedAndGetDisconnected(
  organizationId: string,
  instanceIds: string[],
  fetchFreshInstances: () => Promise<InstanceRowForDisconnect[]>,
): Promise<{
  disconnected: DisconnectedInstanceInfo[];
  freshInstances: InstanceRowForDisconnect[];
  syncResult: Awaited<ReturnType<typeof syncEvolutionConnectionBatch>>;
  preliminaryCount?: number;
}> {
  const scopedIds = instanceIds.map((id) => String(id).trim()).filter(Boolean);
  const syncResult = await syncEvolutionConnectionBatch(organizationId, {
    onlyMarkedDisconnected: false,
    instanceIds: scopedIds.length > 0 ? scopedIds : undefined,
  });
  const freshInstances = await fetchFreshInstances();
  const preliminary = getExplicitlyDisconnected(instanceIds, freshInstances);
  const { disconnected } = await resolveDisconnectedWithLiveCheck(instanceIds, freshInstances);
  return { disconnected, freshInstances, syncResult, preliminaryCount: preliminary.length };
}

function buildInstanceIdToName(
  instanceIds: string[],
  instancesList: InstanceRowForDisconnect[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawId of instanceIds) {
    const id = String(rawId).trim();
    if (!id) continue;
    const inst = instancesList.find((i) => String(i.id) === id);
    map.set(id, String(inst?.instance_name ?? "Instância"));
  }
  return map;
}

/**
 * Valida contatos via edge (servidor), alinhado ao painel Evolution.
 * Listas grandes são divididas em lotes para evitar timeout 504 do Supabase.
 */
export async function validateContactsForSelectedInstances(
  text: string,
  organizationId: string,
  instanceIds: string[],
  instancesList: InstanceRowForDisconnect[],
  useLatamValidator: boolean,
  options?: { onProgress?: (progress: BroadcastValidationProgress) => void },
): Promise<
  ValidationResult & { warning?: string; usedInstance?: string | null; skippedApiValidation?: boolean }
> {
  const parsed = parseContactList(text, useLatamValidator);
  const numbers = parsed.filter((c) => c.valid).map((c) => c.phone);

  if (numbers.length === 0) {
    return {
      validContacts: [],
      invalidContacts: parsed,
      whatsappValidated: [],
      whatsappRejected: parsed,
    };
  }

  const rotatorPool = buildValidationRotatorPool(instanceIds, instancesList);
  const instanceIdToName = buildInstanceIdToName(instanceIds, instancesList);

  const edge = await validateBroadcastWhatsappBatched(
    organizationId,
    instanceIds,
    numbers,
    useLatamValidator,
    {
      preferredInstanceId: rotatorPool[0] ?? null,
      rotatorInstanceIds: rotatorPool.length > 1 ? rotatorPool : undefined,
      instanceIdToName,
      onProgress: options?.onProgress,
    },
  );

  if (!edge.ok) {
    throw new Error(
      edge.error ??
        "Não foi possível validar contatos na Evolution. Sincronize o status e tente novamente.",
    );
  }

  const result = buildValidationResultFromEdge(text, edge, useLatamValidator);
  return {
    ...result,
    warning: edge.warning,
    usedInstance: edge.usedInstance ?? null,
    skippedApiValidation: isBroadcastValidationSkipped(edge),
  };
}
