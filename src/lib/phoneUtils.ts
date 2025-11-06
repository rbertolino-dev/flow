export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildCopyNumber(phone: string): string {
  const digits = normalizePhone(phone);
  return `021${digits}`;
}
