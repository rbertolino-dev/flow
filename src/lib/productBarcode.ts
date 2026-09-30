/**
 * Geração de código de barras EAN-13 legível por leitores comerciais.
 * Prefixo 200–209 = circulação restrita (uso interno da loja / estoque).
 */

/** Dígito verificador EAN-13 (padrão GS1). */
export function ean13CheckDigit(twelveDigits: string): string {
  const digits = twelveDigits.replace(/\D/g, "");
  if (digits.length !== 12) {
    throw new Error("EAN-13 precisa de 12 dígitos antes do verificador");
  }
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const n = Number(digits[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string): boolean {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 13) return false;
  try {
    return ean13CheckDigit(digits.slice(0, 12)) === digits[12];
  } catch {
    return false;
  }
}

function randomDigits(length: number): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String(bytes[i] % 10);
  }
  return out;
}

/** Gera um EAN-13 interno (prefixo 20x) com dígito verificador válido. */
export function generateEan13Barcode(existingCodes: Iterable<string> = []): string {
  const taken = new Set(
    [...existingCodes]
      .map((code) => String(code || "").replace(/\D/g, ""))
      .filter(Boolean)
  );

  for (let attempt = 0; attempt < 40; attempt += 1) {
    // 200–209: faixa GS1 de uso interno (loja / estoque)
    const prefix = `20${randomDigits(1)}`;
    const body = randomDigits(9);
    const twelve = `${prefix}${body}`;
    const code = `${twelve}${ean13CheckDigit(twelve)}`;
    if (!taken.has(code)) return code;
  }

  // Fallback determinístico se houver colisão extrema
  const stamp = Date.now().toString().slice(-9).padStart(9, "0");
  const twelve = `200${stamp}`;
  return `${twelve}${ean13CheckDigit(twelve)}`;
}
