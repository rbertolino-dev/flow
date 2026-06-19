/** Validação de resposta POST /message/sendText|sendMedia (Evolution API v2). */

export type EvolutionSendValidation = {
  ok: boolean;
  error?: string;
  messageId?: string;
  connectionClosed?: boolean;
  numberNotExists?: boolean;
};

function parseBody(responseText: string): unknown {
  if (!responseText.trim()) return null;
  try {
    return JSON.parse(responseText);
  } catch {
    return { _raw: responseText.slice(0, 500) };
  }
}

function messageFromData(data: unknown): unknown {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const response = o.response as Record<string, unknown> | undefined;
  return response?.message ?? o.message ?? o.error;
}

function isConnectionClosedInBody(httpStatus: number, responseText: string, data: unknown): boolean {
  if (httpStatus === 428) return true;
  const lower = responseText.toLowerCase();
  if (lower.includes("connection closed") || lower.includes("precondition required")) {
    return true;
  }
  const msg = messageFromData(data);
  if (msg === "Connection Closed") return true;
  if (typeof msg === "string") {
    const m = msg.toLowerCase();
    if (m.includes("connection closed") || m.includes("precondition required")) return true;
  }
  return false;
}

function findExistsFalse(data: unknown): { found: boolean; detail?: string } {
  const msg = messageFromData(data);
  if (Array.isArray(msg)) {
    const hit = msg.find(
      (m) => m && typeof m === "object" && (m as { exists?: boolean }).exists === false,
    ) as { number?: string; jid?: string } | undefined;
    if (hit) {
      return {
        found: true,
        detail: `Número não existe no WhatsApp: ${hit.jid ?? hit.number ?? "desconhecido"}`,
      };
    }
  }
  if (msg && typeof msg === "object" && (msg as { exists?: boolean }).exists === false) {
    const hit = msg as { number?: string; jid?: string };
    return {
      found: true,
      detail: `Número não existe no WhatsApp: ${hit.jid ?? hit.number ?? "desconhecido"}`,
    };
  }
  return { found: false };
}

function extractMessageId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const key = o.key as Record<string, unknown> | undefined;
  if (typeof key?.id === "string" && key.id.trim()) return key.id.trim();
  const message = o.message as Record<string, unknown> | undefined;
  const msgKey = message?.key as Record<string, unknown> | undefined;
  if (typeof msgKey?.id === "string" && msgKey.id.trim()) return msgKey.id.trim();
  return undefined;
}

const ACCEPTED_STATUSES = new Set(["PENDING", "SERVER_ACK", "DELIVERY_ACK", "READ", "SENT"]);

/**
 * Confirma envio real antes de marcar fila como sent.
 * Fail-closed: HTTP 2xx sem key.id nem status conhecido → rejeita.
 */
export function validateEvolutionSendResponse(
  httpStatus: number,
  responseText: string,
): EvolutionSendValidation {
  const data = parseBody(responseText);

  if (isConnectionClosedInBody(httpStatus, responseText, data)) {
    return { ok: false, error: "Connection Closed", connectionClosed: true };
  }

  const existsFalse = findExistsFalse(data);
  if (existsFalse.found) {
    return {
      ok: false,
      error: existsFalse.detail ?? "Número não existe no WhatsApp",
      numberNotExists: true,
    };
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    const msg = messageFromData(data);
    const errText = typeof msg === "string"
      ? msg
      : msg != null
      ? JSON.stringify(msg).slice(0, 300)
      : responseText.slice(0, 300);
    return { ok: false, error: errText || `HTTP ${httpStatus}` };
  }

  const messageId = extractMessageId(data);
  if (messageId) {
    return { ok: true, messageId };
  }

  if (!responseText.trim()) {
    return { ok: false, error: "Resposta vazia da Evolution API" };
  }

  const topError = messageFromData(data);
  if (typeof topError === "string" && topError.trim()) {
    return { ok: false, error: topError.trim() };
  }

  if (data && typeof data === "object") {
    const status = String((data as Record<string, unknown>).status ?? "").toUpperCase();
    if (status && ACCEPTED_STATUSES.has(status)) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    error: "Evolution não confirmou envio (key.id ausente na resposta)",
  };
}
