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
 * Número só com dígitos, no formato internacional BR para WhatsApp (wa.me) e cópia:
 * `55` + DDD + número. Não usa prefixo trunk (0) nem DDD fixo — o DDD vem do cadastro do lead.
 */
export function buildCopyNumber(phone: string): string {
  const digits = normalizePhone(phone);
  if (!digits) return "";

  if (digits.startsWith("55")) {
    const national = digits.slice(2);
    if (national.length >= 10 && national.length <= 11) {
      return digits;
    }
    return digits;
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }

  // Sem DDD completo (ex.: só 8–9 dígitos): não inventar DDD; devolve o que existe
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
