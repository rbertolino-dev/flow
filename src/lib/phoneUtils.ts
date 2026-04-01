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

/** Remove prefixo internacional 00 (ex.: 005511... → 5511...). */
function stripLeadingInternational00(digits: string): string {
  if (digits.startsWith("00") && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Dígitos para wa.me / WhatsApp: E.164 sem o "+".
 * - 55 = código do país (Brasil), fixo; não é DDD.
 * - Os 2 dígitos depois do 55 são o DDD (estado), sempre os do cadastro — nunca um DDD inventado.
 * Corrige: 00 internacional, 0 trunk, 55 duplicado no meio do número.
 */
export function buildCopyNumber(phone: string): string {
  let digits = normalizePhone(phone);
  if (!digits) return "";

  digits = stripLeadingInternational00(digits);

  if (digits.startsWith("55")) {
    let national = digits.slice(2);
    // Erro comum: 55 + 55 + DDD + número (import / cópia duplicada)
    if (national.startsWith("55") && national.length >= 12) {
      const inner = national.slice(2);
      if (inner.length >= 10 && inner.length <= 11) {
        national = inner;
      }
    }
    if (national.length >= 10 && national.length <= 11) {
      return `55${national}`;
    }
    return digits;
  }

  digits = stripBrazilianTrunkZeroBeforeDdd(digits);

  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * URI para o atalho de ligação no card: mesmo número internacional que o WhatsApp (E.164 com +).
 */
export function buildTelUri(phone: string): string {
  const intl = buildCopyNumber(phone);
  if (intl.length >= 12 && intl.startsWith("55")) {
    return `tel:+${intl}`;
  }
  const d = normalizePhone(phone);
  return d ? `tel:+${d}` : "tel:";
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
