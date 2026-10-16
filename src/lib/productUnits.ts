/** Unidades de medida principais para cadastro de produto e medida fragmentada. */

export type ProductUnitOption = {
  value: string;
  label: string;
};

export const PRODUCT_UNITS: ProductUnitOption[] = [
  { value: "un", label: "Unidade (un)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "pct", label: "Pacote (pct)" },
  { value: "fardo", label: "Fardo" },
  { value: "pc", label: "Peça (pc)" },
  { value: "par", label: "Par" },
  { value: "rolo", label: "Rolo" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "m", label: "Metro (m)" },
  { value: "cm", label: "Centímetro (cm)" },
  { value: "mm", label: "Milímetro (mm)" },
  { value: "m²", label: "Metro quadrado (m²)" },
  { value: "m³", label: "Metro cúbico (m³)" },
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "h", label: "Hora (h)" },
  { value: "dia", label: "Dia" },
  { value: "mês", label: "Mês" },
  { value: "ano", label: "Ano" },
];

const UNIT_ALIASES: Record<string, string> = {
  unidade: "un",
  und: "un",
  u: "un",
  metros: "m",
  metro: "m",
  mt: "m",
  caixa: "cx",
  caixas: "cx",
  pacote: "pct",
  pacotes: "pct",
  quilograma: "kg",
  quilo: "kg",
  grama: "g",
  litro: "l",
  litros: "l",
  mililitro: "ml",
  centimetro: "cm",
  centímetro: "cm",
  milimetro: "mm",
  milímetro: "mm",
};

export function normalizeProductUnit(raw: string | null | undefined): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "un";
  if (PRODUCT_UNITS.some((u) => u.value === trimmed)) return trimmed;
  const alias = UNIT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed;
}

export function productUnitLabel(value: string | null | undefined): string {
  const normalized = normalizeProductUnit(value);
  const found = PRODUCT_UNITS.find((u) => u.value === normalized);
  return found?.label ?? normalized;
}

export function isKnownProductUnit(value: string | null | undefined): boolean {
  const normalized = normalizeProductUnit(value);
  return PRODUCT_UNITS.some((u) => u.value === normalized);
}
