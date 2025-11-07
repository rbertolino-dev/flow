export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildCopyNumber(phone: string): string {
  const digits = normalizePhone(phone);
  // Remove country code (55) if present and build: 021 + DDD + number
  // Example: 5511977823434 -> 02111977823434
  const cleanDigits = digits.startsWith('55') ? digits.substring(2) : digits;
  return `021${cleanDigits}`;
}
