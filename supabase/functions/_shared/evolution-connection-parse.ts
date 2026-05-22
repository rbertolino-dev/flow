/** Parser compartilhado para GET /instance/connectionState (Evolution API v2). */

export function normalizeApiUrl(url: string): string {
  try {
    const u = new URL(url);
    let base = u.origin + u.pathname.replace(/\/$/, "");
    base = base.replace(/\/(manager|dashboard|app)$/i, "");
    return base;
  } catch {
    return url.replace(/\/$/, "").replace(/\/(manager|dashboard|app)$/i, "");
  }
}

const CONNECTED_STATES = new Set([
  "open", "connected", "online", "up", "ready", "authenticated", "logged", "active",
]);
const TRANSIENT_STATES = new Set([
  "pairing", "connecting", "qr", "waiting", "timeout", "syncing", "loading",
]);
const DISCONNECTED_STATES = new Set([
  "close", "closed", "disconnected", "offline", "down",
]);

export function connectionStateToBoolean(state: string | undefined): boolean | null {
  if (!state || typeof state !== "string") return null;
  const v = state.trim().toLowerCase();
  if (CONNECTED_STATES.has(v)) return true;
  if (TRANSIENT_STATES.has(v)) return null;
  if (DISCONNECTED_STATES.has(v)) return false;
  return null;
}

/** Para webhook: connecting => desconectado (evita status fantasma persistente). */
export function connectionStateToPersistBoolean(state: string | undefined): boolean | null {
  if (!state || typeof state !== "string") return null;
  const v = state.trim().toLowerCase();
  if (CONNECTED_STATES.has(v)) return true;
  if (TRANSIENT_STATES.has(v) || DISCONNECTED_STATES.has(v)) return false;
  return null;
}

/**
 * Sync em lote (UI): só grava true/false explícitos.
 * connecting/qr/etc. não alteram o DB — evita flicker ao checar dezenas de chips.
 */
export function connectionStateToPersistBooleanForBatchSync(
  state: string | undefined,
): boolean | null {
  if (!state || typeof state !== "string") return null;
  const v = state.trim().toLowerCase();
  if (CONNECTED_STATES.has(v)) return true;
  if (DISCONNECTED_STATES.has(v)) return false;
  return null;
}

/** Estado em payload connection.update (Evolution v2). */
export function extractStateFromConnectionWebhookPayload(
  payload: { state?: string; instance?: string },
  data: unknown,
): string | undefined {
  const dataObj =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  const fromData = dataObj?.state ?? dataObj?.connectionStatus ?? dataObj?.status;
  if (typeof fromData === "string" && fromData.trim()) return fromData;
  if (typeof payload.state === "string" && payload.state.trim()) return payload.state;
  return undefined;
}

export function extractConnectionStateFromBody(input: unknown): boolean | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const inst = o.instance as Record<string, unknown> | undefined;
  const dataInst = (o.data as Record<string, unknown> | undefined)?.instance as
    | Record<string, unknown>
    | undefined;
  const candidate =
    inst?.state ??
    inst?.status ??
    dataInst?.state ??
    dataInst?.status ??
    o.state ??
    o.status;
  if (typeof candidate === "string") return connectionStateToBoolean(candidate);
  return null;
}

export function extractConnectionStateFromBodyForPersist(input: unknown): boolean | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const inst = o.instance as Record<string, unknown> | undefined;
  const dataInst = (o.data as Record<string, unknown> | undefined)?.instance as
    | Record<string, unknown>
    | undefined;
  const candidate =
    inst?.state ??
    inst?.status ??
    dataInst?.state ??
    dataInst?.status ??
    o.state ??
    o.status;
  if (typeof candidate === "string") return connectionStateToPersistBoolean(candidate);
  return null;
}

export function extractConnectionStateFromBodyForBatchSync(input: unknown): boolean | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const inst = o.instance as Record<string, unknown> | undefined;
  const dataInst = (o.data as Record<string, unknown> | undefined)?.instance as
    | Record<string, unknown>
    | undefined;
  const candidate =
    inst?.state ??
    inst?.status ??
    dataInst?.state ??
    dataInst?.status ??
    o.state ??
    o.status;
  if (typeof candidate === "string") {
    return connectionStateToPersistBooleanForBatchSync(candidate);
  }
  return null;
}
