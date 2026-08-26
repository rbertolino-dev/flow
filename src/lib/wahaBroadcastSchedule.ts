/**
 * Agendamento do Disparador WAHA.
 * O intervalo mínimo/máximo vale ENTRE envios. O primeiro de cada sessão
 * sai no horário de início (próximo minuto), sem esperar o delay.
 */

export type WahaScheduleQueueItem = {
  id: string;
  session_id: string;
};

export type WahaScheduleEntry = {
  id: string;
  scheduled_for: Date;
};

/** Próximo minuto cheio a partir de `from` (ex.: 10:22:40 → 10:23:00). */
export function nextMinuteStart(from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

function defaultRandomDelaySec(min: number, max: number): number {
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Agenda a fila WAHA: 1º envio de cada sessão em `startAt`;
 * os seguintes somam o intervalo sorteado.
 */
export function scheduleWahaQueue(params: {
  items: WahaScheduleQueueItem[];
  minDelaySeconds: number;
  maxDelaySeconds: number;
  startAt: Date;
  randomDelaySec?: (min: number, max: number) => number;
}): WahaScheduleEntry[] {
  const min = Math.max(1, Math.floor(Number(params.minDelaySeconds) || 1));
  const max = Math.max(min, Math.floor(Number(params.maxDelaySeconds) || min));
  const pick = params.randomDelaySec ?? defaultRandomDelaySec;

  const grouped = new Map<string, WahaScheduleQueueItem[]>();
  for (const item of params.items) {
    const list = grouped.get(item.session_id);
    if (list) list.push(item);
    else grouped.set(item.session_id, [item]);
  }

  const results: WahaScheduleEntry[] = [];
  for (const sessionItems of grouped.values()) {
    let nextAt = params.startAt.getTime();
    for (const item of sessionItems) {
      results.push({ id: item.id, scheduled_for: new Date(nextAt) });
      nextAt += pick(min, max) * 1000;
    }
  }
  return results;
}
