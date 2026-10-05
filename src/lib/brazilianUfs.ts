export const BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function normalizeUf(value: string | null | undefined): string {
  const uf = String(value || "").trim().toUpperCase().slice(0, 2);
  return (BRAZILIAN_UFS as readonly string[]).includes(uf) ? uf : "";
}
