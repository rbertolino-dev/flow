/** Org com muitos chips: health check por connectionState gera falso offline — usar sync em lote. */
export const LARGE_ORG_INSTANCE_THRESHOLD = 15;

/** Intervalo do sync periódico fetchInstances (orgs grandes). */
export const LARGE_ORG_BATCH_SYNC_INTERVAL_MS = 3 * 60 * 1000;

export function isLargeInstanceOrg(instanceCount: number): boolean {
  return instanceCount > LARGE_ORG_INSTANCE_THRESHOLD;
}
