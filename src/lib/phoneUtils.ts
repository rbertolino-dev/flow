export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
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

/**
 * Remove o 0 de discagem nacional (longa distância) antes do DDD, quando presente.
 * Ex.: 011987654321 → 11987654321; 01234567890 → 1234567890 (fixo: DDD estadual + 8 dígitos).
 */
function stripBrazilianTrunkZeroBeforeDdd(digits: string): string {
  if (!digits.startsWith("0") || digits.length < 11) {
    return digits;
  }
  const without = digits.slice(1);
  // Após tirar o 0, deve sobrar DDD (2) + celular (9) ou fixo (8)
  if (without.length >= 10 && without.length <= 11) {
    return without;
  }
  return digits;
}

/**
 * Formato internacional BR para WhatsApp (wa.me) e cópia: `55` + DDD do estado + número local.
 * - 55 = país (Brasil), não é DDD.
 * - Os 2 dígitos seguintes ao país são o DDD (estado/região), vindos do cadastro do lead.
 * - Fixo: 10 dígitos nacionais (DDD + 8). Celular: 11 (DDD + 9).
 * Não inventa DDD; aceita números já com 55 ou com 0 de trunk antes do DDD.
 */
export function buildCopyNumber(phone: string): string {
  let digits = normalizePhone(phone);
  if (!digits) return "";

  if (digits.startsWith("55")) {
    const national = digits.slice(2);
    if (national.length >= 10 && national.length <= 11) {
      return digits;
    }
    return digits;
  }

  digits = stripBrazilianTrunkZeroBeforeDdd(digits);

  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }

  return digits;
}

/** CEP apenas dígitos (até 8). */
export function normalizeCep(cep: string): string {
  return normalizePhone(cep).slice(0, 8);
}

/** Exibe CEP no formato 00000-000 quando há 8 dígitos. */
export function formatBrazilianCep(cep: string): string {
  const d = normalizeCep(cep);
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
}
