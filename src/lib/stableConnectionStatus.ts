/**
 * Evita oscilação visual de is_connected quando Evolution envia estados transitórios
 * ou o banco alterna true/false em sequência rápida.
 */
export type StableConnectionPending = {
  value: boolean;
  sinceMs: number;
};

export const STABLE_MS_CONNECTED = 2000;
export const STABLE_MS_DISCONNECTED = 8000;

export function shouldCommitStableStatus(
  pending: StableConnectionPending | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!pending) return false;
  const elapsed = nowMs - pending.sinceMs;
  if (pending.value === true) return elapsed >= STABLE_MS_CONNECTED;
  return elapsed >= STABLE_MS_DISCONNECTED;
}

/** Ignora null/undefined; só aceita boolean explícito. */
export function normalizeConnectionBool(raw: boolean | null | undefined): boolean | null {
  if (raw === true) return true;
  if (raw === false) return false;
  return null;
}

export function upsertPending(
  prev: Record<string, StableConnectionPending>,
  id: string,
  next: boolean,
  nowMs: number = Date.now(),
): Record<string, StableConnectionPending> {
  const cur = prev[id];
  if (cur?.value === next) {
    return prev;
  }
  return { ...prev, [id]: { value: next, sinceMs: nowMs } };
}

export function flushStableStatuses(
  pending: Record<string, StableConnectionPending>,
  displayed: Record<string, boolean | null>,
  nowMs: number = Date.now(),
): {
  pending: Record<string, StableConnectionPending>;
  displayed: Record<string, boolean | null>;
  changed: boolean;
} {
  const nextPending = { ...pending };
  const nextDisplayed = { ...displayed };
  let changed = false;

  for (const [id, p] of Object.entries(pending)) {
    if (!shouldCommitStableStatus(p, nowMs)) continue;
    if (nextDisplayed[id] === p.value) {
      delete nextPending[id];
      continue;
    }
    nextDisplayed[id] = p.value;
    delete nextPending[id];
    changed = true;
  }

  return { pending: nextPending, displayed: nextDisplayed, changed };
}
