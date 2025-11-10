/**
 * Códigos de países da América Latina suportados
 */
const LATIN_AMERICA_CODES = ["54", "55", "56", "57", "58", "51", "52", "53", "591", "593", "595", "598", "506", "507"];

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidLatinAmericaPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  
  // Verificar se tem código de país da América Latina
  for (const code of LATIN_AMERICA_CODES) {
    if (digits.startsWith(code)) {
      return digits.length >= 10 && digits.length <= 13;
    }
  }
  
  // Se não tem código, assumir Brasil e validar
  return digits.length >= 10 && digits.length <= 11;
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  const cleanDigits = digits.startsWith('55') ? digits.substring(2) : digits;
  return cleanDigits.length >= 10 && cleanDigits.length <= 11;
}

export function formatBrazilianPhone(phone: string): string {
  const digits = normalizePhone(phone);
  
  // Remove country code if present
  const cleanDigits = digits.startsWith('55') ? digits.substring(2) : digits;
  
  // Format based on length
  if (cleanDigits.length === 11) {
    // (XX) 9XXXX-XXXX
    return `(${cleanDigits.substring(0, 2)}) ${cleanDigits.substring(2, 7)}-${cleanDigits.substring(7)}`;
  } else if (cleanDigits.length === 10) {
    // (XX) XXXX-XXXX
    return `(${cleanDigits.substring(0, 2)}) ${cleanDigits.substring(2, 6)}-${cleanDigits.substring(6)}`;
  } else if (cleanDigits.length >= 8) {
    // XXXX-XXXX (sem DDD)
    const lastEight = cleanDigits.substring(cleanDigits.length - 8);
    return `${lastEight.substring(0, 4)}-${lastEight.substring(4)}`;
  }
  
  // Retorna original se não couber nos padrões
  return phone;
}

export function buildCopyNumber(phone: string): string {
  const digits = normalizePhone(phone);
  // Remove country code (55) if present and build: 021 + DDD + number
  // Example: 5511977823434 -> 02111977823434
  const cleanDigits = digits.startsWith('55') ? digits.substring(2) : digits;
  return `021${cleanDigits}`;
}
