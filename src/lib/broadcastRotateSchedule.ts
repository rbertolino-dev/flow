/**
 * Agendamento rotate do Disparador 2 — puro (sem Supabase/Evolution).
 * Usado pelo frontend e por testes unitários.
 */

/** Escalonamento legado (pools pequenos). */
export const ROTATE_FIRST_SEND_STAGGER_SECONDS = 5;

/** Rampa conservadora: ~1 chip a cada 25s na 1ª onda (30 chips ≈ 12,5 min). */
export const ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS = 25;

/** Pools com N+ chips usam rampa conservadora por padrão. */
export const ROTATE_CONSERVATIVE_RAMP_MIN_POOL = 10;

/** Janela da 1ª onda (alinhada ao cap do process-broadcast-queue-2). */
export const ROTATE_CONSERVATIVE_RAMP_WINDOW_MS = 15 * 60 * 1000;

export interface RotateQueueItem {
  id: string;
  instance_id: string;
}

export interface RotateScheduleEntry {
  id: string;
  scheduled_for: Date;
}

export interface ComputeRotateScheduleParams {
  queueItems: RotateQueueItem[];
  instanceIds?: string[] | null;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  now: Date;
  randomDelaySec?: () => number;
  conservativeFirstWave?: boolean;
}

function defaultRandomDelaySec(min: number, max: number): () => number {
  return () =>
    min === max
      ? min
      : Math.floor(Math.random() * (max - min + 1)) + min;
}

export function resolveFirstWaveStaggerSeconds(
  poolSize: number,
  conservativeFirstWave?: boolean,
): number {
  const useConservative =
    conservativeFirstWave ??
    poolSize >= ROTATE_CONSERVATIVE_RAMP_MIN_POOL;
  return useConservative
    ? ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS
    : ROTATE_FIRST_SEND_STAGGER_SECONDS;
}

export function computeRotateSchedule(
  params: ComputeRotateScheduleParams,
): RotateScheduleEntry[] {
  const {
    queueItems,
    instanceIds,
    minDelaySeconds,
    maxDelaySeconds,
    now,
    randomDelaySec,
    conservativeFirstWave,
  } = params;

  const minDelaySec = Math.max(1, Math.floor(Number(minDelaySeconds) || 1));
  const maxDelaySec = Math.max(minDelaySec, Math.floor(Number(maxDelaySeconds) || minDelaySec));
  const pickDelay =
    randomDelaySec ?? defaultRandomDelaySec(minDelaySec, maxDelaySec);

  const uniqueInstances = new Set(queueItems.map((item) => item.instance_id));
  const poolOrder: string[] =
    Array.isArray(instanceIds) && instanceIds.length > 0
      ? [...instanceIds]
      : Array.from(uniqueInstances).sort();

  const staggerSec = resolveFirstWaveStaggerSeconds(
    poolOrder.length,
    conservativeFirstWave,
  );

  const staggerIndexByInstance = new Map(poolOrder.map((id, idx) => [id, idx]));
  const nextAvailablePerInstance = new Map<string, Date>();
  const results: RotateScheduleEntry[] = [];

  for (const item of queueItems) {
    const lastScheduledForInstance = nextAvailablePerInstance.get(item.instance_id);
    let scheduledTime: Date;

    if (lastScheduledForInstance) {
      scheduledTime = new Date(lastScheduledForInstance);
    } else {
      const staggerIdx = staggerIndexByInstance.get(item.instance_id) ?? 0;
      scheduledTime = new Date(
        now.getTime() + staggerIdx * staggerSec * 1000,
      );
    }

    const delayForNextSendMs = pickDelay() * 1000;
    nextAvailablePerInstance.set(
      item.instance_id,
      new Date(scheduledTime.getTime() + delayForNextSendMs),
    );

    results.push({ id: item.id, scheduled_for: scheduledTime });
  }

  return results;
}

export function firstSendPerInstance(
  entries: RotateScheduleEntry[],
  queueItems: RotateQueueItem[],
): Map<string, Date> {
  const idToInstance = new Map(queueItems.map((q) => [q.id, q.instance_id]));
  const seen = new Set<string>();
  const out = new Map<string, Date>();

  for (const entry of entries) {
    const iid = idToInstance.get(entry.id);
    if (!iid || seen.has(iid)) continue;
    seen.add(iid);
    out.set(iid, entry.scheduled_for);
  }
  return out;
}
