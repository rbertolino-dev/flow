/** Espelha a lógica de @/lib/phoneUtils (apenas o necessário para a extensão). */

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  const cleanDigits = digits.startsWith("55") ? digits.substring(2) : digits;
  return cleanDigits.length >= 10 && cleanDigits.length <= 11;
}

/** Extrai possíveis telefones BR de um texto livre. */
export function extractPhonesFromText(text: string): string[] {
  const digits = text.replace(/\D/g, "");
  const candidates: string[] = [];
  if (digits.length >= 10 && digits.length <= 13) {
    candidates.push(digits);
  }
  const parts = text.match(/[\d\s\-().+]{10,}/g) || [];
  for (const p of parts) {
    const n = normalizePhone(p);
    if (n.length >= 10 && n.length <= 13) candidates.push(n);
  }
  return [...new Set(candidates)];
}
