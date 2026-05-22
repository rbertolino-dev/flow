import { syncEvolutionConnectionBatch } from "@/lib/syncEvolutionConnectionBatch";
import {
  getExplicitlyDisconnected,
  type InstanceRowForDisconnect,
  type DisconnectedInstanceInfo,
} from "@/lib/verifyInstanceConnectionLive";
import {
  parseContactList,
  type ValidationResult,
} from "@/lib/contactValidator";
import {
  validateBroadcastWhatsappViaEdge,
  buildValidationResultFromEdge,
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
}> {
  const syncResult = await syncEvolutionConnectionBatch(organizationId, {
    onlyMarkedDisconnected: false,
  });
  const freshInstances = await fetchFreshInstances();
  const disconnected = getExplicitlyDisconnected(instanceIds, freshInstances);
  return { disconnected, freshInstances, syncResult };
}

/**
 * Valida contatos via edge (servidor), alinhado ao painel Evolution.
 * Não percorre dezenas de instâncias no browser com whatsappNumbers.
 */
export async function validateContactsForSelectedInstances(
  text: string,
  organizationId: string,
  instanceIds: string[],
  instancesList: InstanceRowForDisconnect[],
  useLatamValidator: boolean,
): Promise<ValidationResult & { warning?: string; usedInstance?: string | null }> {
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

  const edge = await validateBroadcastWhatsappViaEdge(
    organizationId,
    instanceIds,
    numbers,
    useLatamValidator,
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
  };
}
