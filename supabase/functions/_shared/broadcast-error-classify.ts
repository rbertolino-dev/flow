/**
 * Classifica erro de envio de broadcast para persistência em failure_code (SQL / métricas).
 * Mantido estável para agregação; detail truncado para o banco.
 */
export function classifyBroadcastError(
  message: string | undefined,
): { code: string; detail: string } {
  const raw = typeof message === "string" ? message : "";
  const msg = raw.slice(0, 500);
  const lower = msg.toLowerCase();

  if (!msg.trim()) {
    return { code: "UNKNOWN", detail: "" };
  }

  if (msg.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { code: "HTTP_429", detail: msg.slice(0, 300) };
  }
  if (msg.includes("401") || lower.includes("unauthorized")) {
    return { code: "HTTP_401", detail: msg.slice(0, 300) };
  }
  if (msg.includes("403") || lower.includes("forbidden")) {
    return { code: "HTTP_403", detail: msg.slice(0, 300) };
  }
  if (msg.includes("404")) {
    return { code: "HTTP_404", detail: msg.slice(0, 300) };
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return { code: "HTTP_5XX", detail: msg.slice(0, 300) };
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("network") ||
    lower.includes("fetch failed")
  ) {
    return { code: "NETWORK_OR_TIMEOUT", detail: msg.slice(0, 300) };
  }

  if (
    lower.includes("invalid") &&
    (lower.includes("phone") || lower.includes("number") || lower.includes("jid") || lower.includes("wa"))
  ) {
    return { code: "INVALID_NUMBER_OR_JID", detail: msg.slice(0, 300) };
  }

  if (
    lower.includes("connection closed") ||
    lower.includes("precondition required") ||
    lower.includes("desconect") ||
    lower.includes("connectionstate") ||
    /sess[aã]o.*(fech|closed)/.test(lower) ||
    /chip.*(off|caiu)/.test(lower) ||
    lower.includes("falso positivo")
  ) {
    return { code: "INSTANCE_UNAVAILABLE", detail: msg.slice(0, 300) };
  }

  if (
    (lower.includes("instance") || lower.includes("instância") || lower.includes("instancia")) &&
    (lower.includes("not found") || lower.includes("disconnect") || lower.includes("closed") || lower.includes("desconect"))
  ) {
    return { code: "INSTANCE_UNAVAILABLE", detail: msg.slice(0, 300) };
  }

  if (lower.includes("evolution") || (lower.includes("whatsapp") && lower.includes("error"))) {
    return { code: "PROVIDER_ERROR", detail: msg.slice(0, 300) };
  }

  return { code: "OTHER", detail: msg.slice(0, 300) };
}
