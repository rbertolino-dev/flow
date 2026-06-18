/**
 * Agendamento rotate do Disparador 2 — puro (sem Supabase/Evolution).
 * Usado pelo frontend e por testes unitários.
 */

export const ROTATE_FIRST_SEND_STAGGER_SECONDS = 5;

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
  /** Injetável em testes para delays determinísticos */
  randomDelaySec?: () => number;
}

function defaultRandomDelaySec(min: number, max: number): () => number {
  return () =>
    min === max
      ? min
      : Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calcula scheduled_for para modo rotate.
 * 1º envio de cada chip: now + (índice no pool × ROTATE_FIRST_SEND_STAGGER_SECONDS).
 * Envios seguintes no mesmo chip: último horário + delay aleatório [min, max].
 */
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
        now.getTime() + staggerIdx * ROTATE_FIRST_SEND_STAGGER_SECONDS * 1000,
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

/** Agrupa 1º envio por chip (para asserções em testes). */
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
