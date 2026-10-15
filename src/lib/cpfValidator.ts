/** Utilitários de CPF (formato e dígitos verificadores). */

export function cleanCpf(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function isValidCpf(cpf: string): boolean {
  const cleaned = cleanCpf(cpf);

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10), 10)) return false;

  return true;
}

export function formatCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

/** Máscara para exibição: ***.***.***-XX */
export function maskCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  if (cleaned.length !== 11) return '***.***.***-**';
  return `***.***.***-${cleaned.slice(9)}`;
}
