import type { Product } from "@/types/product";

/** IDs imutáveis dos 8 presets (documentação técnica v1.0). */
export type ProductLabelPresetId =
  | "e33x21"
  | "e40x40"
  | "e35x25"
  | "e100x30"
  | "e38x21"
  | "e25x66"
  | "e50x30"
  | "e100x150_dupla";

/** Compatibilidade com botões antigos do modal. */
export type ProductLabelSizeId =
  | "33x21"
  | "40mm"
  | "35x25"
  | "100x30"
  | "38x21"
  | "25x66"
  | "50x30"
  | "100x150";

export type LabelOutputMode = "pdf" | "html" | "zpl";
export type LabelShape40 = "square" | "circle";
/** A = duas cópias sequenciais; B = duas vias na mesma etiqueta; C = duas colunas. */
export type DualVariant = "A" | "B" | "C";

export interface ProductLabelPreset {
  id: ProductLabelPresetId;
  sizeId: ProductLabelSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  safeMarginMm: number;
  dual?: boolean;
  supportsCircle?: boolean;
  zplPw203: number;
  zplLl203: number;
  zplPw300: number;
  zplLl300: number;
}

export const PRODUCT_LABEL_PRESETS: ProductLabelPreset[] = [
  {
    id: "e33x21",
    sizeId: "33x21",
    label: "Imprimir 33x21",
    widthMm: 33,
    heightMm: 21,
    safeMarginMm: 2,
    zplPw203: 264,
    zplLl203: 168,
    zplPw300: 390,
    zplLl300: 248,
  },
  {
    id: "e40x40",
    sizeId: "40mm",
    label: "Imprimir 40mm",
    widthMm: 40,
    heightMm: 40,
    safeMarginMm: 2,
    supportsCircle: true,
    zplPw203: 320,
    zplLl203: 320,
    zplPw300: 472,
    zplLl300: 472,
  },
  {
    id: "e35x25",
    sizeId: "35x25",
    label: "Imprimir 35x25",
    widthMm: 35,
    heightMm: 25,
    safeMarginMm: 2,
    zplPw203: 280,
    zplLl203: 200,
    zplPw300: 413,
    zplLl300: 295,
  },
  {
    id: "e100x30",
    sizeId: "100x30",
    label: "Imprimir 100x30",
    widthMm: 100,
    heightMm: 30,
    safeMarginMm: 3,
    zplPw203: 799,
    zplLl203: 240,
    zplPw300: 1181,
    zplLl300: 354,
  },
  {
    id: "e38x21",
    sizeId: "38x21",
    label: "Imprimir 38x21",
    widthMm: 38,
    heightMm: 21,
    safeMarginMm: 2,
    zplPw203: 304,
    zplLl203: 168,
    zplPw300: 449,
    zplLl300: 248,
  },
  {
    id: "e25x66",
    sizeId: "25x66",
    label: "Imprimir 25x66",
    widthMm: 25,
    heightMm: 66,
    safeMarginMm: 2,
    zplPw203: 200,
    zplLl203: 527,
    zplPw300: 295,
    zplLl300: 780,
  },
  {
    id: "e50x30",
    sizeId: "50x30",
    label: "Imprimir 50x30",
    widthMm: 50,
    heightMm: 30,
    safeMarginMm: 2,
    zplPw203: 400,
    zplLl203: 240,
    zplPw300: 591,
    zplLl300: 354,
  },
  {
    id: "e100x150_dupla",
    sizeId: "100x150",
    label: "Imprimir 100x150 (dupla)",
    widthMm: 100,
    heightMm: 150,
    safeMarginMm: 4,
    dual: true,
    zplPw203: 799,
    zplLl203: 1199,
    zplPw300: 1181,
    zplLl300: 1772,
  },
];

/** Alias usado pela UI. */
export const PRODUCT_LABEL_SIZES = PRODUCT_LABEL_PRESETS.map((preset) => ({
  id: preset.sizeId,
  label: preset.label,
  widthMm: preset.widthMm,
  heightMm: preset.heightMm,
  dual: preset.dual,
  safeMarginMm: preset.safeMarginMm,
  supportsCircle: preset.supportsCircle,
}));

export function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

export function mmToPdfPoints(mm: number): number {
  return (mm * 72) / 25.4;
}

export function usefulAreaMm(widthMm: number, heightMm: number, marginMm: number) {
  return {
    widthMm: widthMm - 2 * marginMm,
    heightMm: heightMm - 2 * marginMm,
  };
}

export function getPresetBySizeId(sizeId: ProductLabelSizeId): ProductLabelPreset {
  const preset = PRODUCT_LABEL_PRESETS.find((item) => item.sizeId === sizeId);
  if (!preset) throw new Error(`Preset de etiqueta inválido: ${sizeId}`);
  return preset;
}

export function zplPageDots(preset: ProductLabelPreset, dpi: 203 | 300) {
  if (dpi === 203) return { pw: preset.zplPw203, ll: preset.zplLl203 };
  return { pw: preset.zplPw300, ll: preset.zplLl300 };
}

export type LabelFieldData = {
  name: string;
  price: string;
  unit: string;
  sku: string | null;
  barcode: string | null;
  /** Código preferencial para barras: barcode → sku */
  code: string | null;
};

export function productToLabelFields(product: Product): LabelFieldData {
  const barcode = String(product.barcode || "").trim() || null;
  const sku = String(product.sku || "").trim() || null;
  return {
    name: String(product.name || "").trim().toUpperCase() || "PRODUTO",
    price: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(product.price ?? 0)),
    unit: String(product.unit || "Un").trim() || "Un",
    sku,
    barcode,
    code: barcode || sku,
  };
}

export function escapeZplText(value: string): string {
  return String(value || "")
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .replace(/\r?\n/g, " ")
    .slice(0, 120);
}

export interface LabelRenderOptions {
  output: LabelOutputMode;
  dpi: 203 | 300;
  copies: number;
  shape40: LabelShape40;
  dualVariant: DualVariant | null;
  gapXmm: number;
}
