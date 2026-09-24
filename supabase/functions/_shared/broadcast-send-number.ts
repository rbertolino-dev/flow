/**
 * Destino do sendText no Disparador 2.
 * Só troca o número quando a Evolution devolve o JID canônico sem o nono dígito
 * (mesmo DDD e mesmo assinante). Qualquer outra resposta mantém o telefone da fila.
 */

import { normalizeApiUrl } from "./evolution-connection-parse.ts";

export type WhatsappNumberLookup =
  | { ok: false }
  | { ok: true; exists: boolean; jid: string | null };

export type SendNumberDecision = {
  number: string;
  rewritten: boolean;
  reason:
    | "canonical_jid"
    | "unchanged"
    | "lookup_failed"
    | "exists_false"
    | "non_phone_jid"
    | "not_ninth_digit";
};

const PHONE_JID = /^(\d+)@s\.whatsapp\.net$/i;

/** 55 + DDD + 9 + 8 dígitos  →  55 + DDD + 8 dígitos. */
export function isNinthDigitCanonical(inputDigits: string, jidDigits: string): boolean {
  if (inputDigits.length !== 13 || jidDigits.length !== 12) return false;
  if (!inputDigits.startsWith("55") || !jidDigits.startsWith("55")) return false;
  if (inputDigits.slice(2, 4) !== jidDigits.slice(2, 4)) return false;
  if (inputDigits[4] !== "9") return false;
  return inputDigits.slice(0, 4) + inputDigits.slice(5) === jidDigits;
}

export function fallbackSendNumber(digits: string): string {
  return `${digits}@s.whatsapp.net`;
}

export function decideBroadcastSendNumber(
  digits: string,
  lookup: WhatsappNumberLookup,
): SendNumberDecision {
  const fallback = fallbackSendNumber(digits);
  if (!lookup.ok) {
    return { number: fallback, rewritten: false, reason: "lookup_failed" };
  }
  if (!lookup.exists || !lookup.jid) {
    return { number: fallback, rewritten: false, reason: "exists_false" };
  }
  const match = lookup.jid.trim().match(PHONE_JID);
  if (!match) {
    return { number: fallback, rewritten: false, reason: "non_phone_jid" };
  }
  const jidDigits = match[1];
  if (jidDigits === digits) {
    return { number: fallback, rewritten: false, reason: "unchanged" };
  }
  if (!isNinthDigitCanonical(digits, jidDigits)) {
    return { number: fallback, rewritten: false, reason: "not_ninth_digit" };
  }
  return {
    number: `${jidDigits}@s.whatsapp.net`,
    rewritten: true,
    reason: "canonical_jid",
  };
}

function rowsFromBody(body: unknown): Array<{ number?: string; exists?: boolean; jid?: string }> {
  if (Array.isArray(body)) return body as Array<{ number?: string; exists?: boolean; jid?: string }>;
  if (!body || typeof body !== "object") return [];
  const o = body as { data?: unknown; results?: unknown };
  if (Array.isArray(o.data)) return o.data as Array<{ number?: string; exists?: boolean; jid?: string }>;
  if (Array.isArray(o.results)) return o.results as Array<{ number?: string; exists?: boolean; jid?: string }>;
  return [];
}

export function parseWhatsappNumbersBody(body: unknown, digits: string): WhatsappNumberLookup {
  const rows = rowsFromBody(body);
  if (rows.length === 0) return { ok: false };
  const target = digits.replace(/\D/g, "");
  const row = rows.find((r) => {
    const num = String(r?.number ?? "").replace(/\D/g, "");
    const jidDigits = String(r?.jid ?? "").split("@")[0].replace(/\D/g, "");
    return num === target || jidDigits === target || isNinthDigitCanonical(target, jidDigits);
  }) ?? (rows.length === 1 ? rows[0] : undefined);
  if (!row) return { ok: true, exists: false, jid: null };
  const jid = row.jid != null && String(row.jid).trim() ? String(row.jid).trim() : null;
  return { ok: true, exists: row.exists === true, jid };
}

export async function resolveBroadcastSendNumber(input: {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  digits: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<SendNumberDecision> {
  const fallback = fallbackSendNumber(input.digits);
  const fetchFn = input.fetchImpl ?? fetch;
  try {
    const base = normalizeApiUrl(input.apiUrl);
    const endpoint = `${base}/chat/whatsappNumbers/${encodeURIComponent(input.instanceName)}`;
    const resp = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: input.apiKey,
      },
      body: JSON.stringify({ numbers: [input.digits] }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 8000),
    });
    if (!resp.ok) {
      return { number: fallback, rewritten: false, reason: "lookup_failed" };
    }
    let body: unknown = null;
    try {
      body = await resp.json();
    } catch {
      return { number: fallback, rewritten: false, reason: "lookup_failed" };
    }
    return decideBroadcastSendNumber(input.digits, parseWhatsappNumbersBody(body, input.digits));
  } catch {
    return { number: fallback, rewritten: false, reason: "lookup_failed" };
  }
}
