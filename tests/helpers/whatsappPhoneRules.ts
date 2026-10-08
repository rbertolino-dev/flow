/**
 * Espelha as regras de supabase/functions/_shared/evolution-send-phone.ts
 * e da ponte (só dígitos, sem @lid).
 */

export const TEST_PHONE_LOCAL = "21966224051";
export const TEST_PHONE_E164 = "5521966224051";
export const TEST_PHONE_LID = "124403912302825";

export function looksLikeWhatsappLid(digits: string): boolean {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return false;
  if (d.length >= 14 && !d.startsWith("55")) return true;
  if (d.startsWith("55") && d.length > 13) return true;
  return false;
}

export function normalizeEvolutionSendPhone(phone: unknown): string {
  let raw = String(phone ?? "").trim();
  if (!raw) throw new Error("Telefone obrigatório");
  if (/@lid/i.test(raw)) {
    throw new Error("Este contato está com ID interno do WhatsApp (@lid)");
  }
  if (raw.includes("@")) raw = raw.split("@")[0];
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (looksLikeWhatsappLid(digits)) {
    throw new Error("Número inválido (parece ID interno do WhatsApp)");
  }
  if (!digits.startsWith("55") && digits.length >= 10 && digits.length <= 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) digits = `55${digits}`;
  }
  if (digits.startsWith("55")) {
    if (digits.length < 12 || digits.length > 13) {
      throw new Error("Telefone brasileiro inválido");
    }
  } else if (digits.length < 10 || digits.length > 15) {
    throw new Error("Telefone inválido para WhatsApp");
  }
  return digits;
}

/** Payload Evolution deve usar só dígitos (nunca @lid / @s.whatsapp.net). */
export function evolutionSendNumberFromPhone(phone: string): string {
  return normalizeEvolutionSendPhone(phone);
}
