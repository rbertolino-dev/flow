/**
 * Normaliza telefone para envio na Evolution API.
 * Retorna só dígitos (sem @s.whatsapp.net): a Evolution resolve o JID
 * e evita gravar contato @lid fantasma no Chatwoot.
 */

export class InvalidWhatsappPhoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWhatsappPhoneError";
  }
}

export function extractLidFromEvolutionPayload(payload: unknown): string {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  const match = text.match(/(\d{10,20})@lid/i);
  return match?.[1] || "";
}

/** Detecta ID interno WhatsApp (@lid) disfarçado de telefone. */
export function looksLikeWhatsappLid(digits: string): boolean {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return false;
  // LIDs costumam ter 14+ dígitos e não são E.164 BR (55 + 10/11)
  if (d.length >= 14 && !d.startsWith("55")) return true;
  // 55 + mais de 11 dígitos nacionais = inválido/LID
  if (d.startsWith("55") && d.length > 13) return true;
  return false;
}

/**
 * Normaliza para dígitos prontos para Evolution (ex.: 5521966224051).
 * Nunca retorna @lid nem @s.whatsapp.net.
 */
export function normalizeEvolutionSendPhone(phone: unknown): string {
  let raw = String(phone ?? "").trim();
  if (!raw) {
    throw new InvalidWhatsappPhoneError("Telefone obrigatório");
  }
  if (/@lid/i.test(raw)) {
    throw new InvalidWhatsappPhoneError(
      "Este contato está com ID interno do WhatsApp (@lid). Use o telefone com DDD (ex.: 21966224051).",
    );
  }
  if (raw.includes("@")) {
    raw = raw.split("@")[0];
  }

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (looksLikeWhatsappLid(digits)) {
    throw new InvalidWhatsappPhoneError(
      "Número inválido (parece ID interno do WhatsApp). Use o telefone com DDD (ex.: 21966224051).",
    );
  }

  if (!digits.startsWith("55") && digits.length >= 10 && digits.length <= 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) {
      digits = `55${digits}`;
    }
  }

  if (digits.startsWith("55")) {
    if (digits.length < 12 || digits.length > 13) {
      throw new InvalidWhatsappPhoneError(
        "Telefone brasileiro inválido. Use DDD + número (ex.: 21966224051).",
      );
    }
  } else if (digits.length < 10 || digits.length > 15) {
    throw new InvalidWhatsappPhoneError("Telefone inválido para WhatsApp");
  }

  return digits;
}
