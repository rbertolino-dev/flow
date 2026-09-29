import type { Product } from "@/types/product";
import {
  DualVariant,
  escapeZplText,
  getPresetBySizeId,
  LabelShape40,
  mmToDots,
  productToLabelFields,
  ProductLabelSizeId,
  zplPageDots,
  type LabelFieldData,
} from "@/lib/productLabelPresets";

function field(x: number, y: number, height: number, width: number, text: string) {
  return `^FO${x},${y}^A0N,${height},${width}^FD${escapeZplText(text)}^FS`;
}

function barcodeCmd(x: number, y: number, height: number, module: number, code: string) {
  return `^FO${x},${y}^BY${module}^BCN,${height},N,N,N^FD${escapeZplText(code)}^FS`;
}

function composeLabel(
  data: LabelFieldData,
  dpi: 203 | 300,
  widthMm: number,
  heightMm: number,
  marginMm: number,
  shape40: LabelShape40
): string {
  const m = mmToDots(marginMm, dpi);
  const usableW = mmToDots(widthMm - 2 * marginMm, dpi);
  const usableH = mmToDots(heightMm - 2 * marginMm, dpi);
  const lines: string[] = [];

  const priceH = Math.max(18, Math.round(usableH * 0.18));
  const nameH = Math.max(16, Math.round(usableH * 0.14));
  const unitH = Math.max(14, Math.round(usableH * 0.1));
  let y = m;

  lines.push(field(m, y, priceH, Math.round(priceH * 0.9), data.price));
  y += priceH + Math.round(dpi === 203 ? 4 : 6);
  lines.push(field(m, y, unitH, Math.round(unitH * 0.85), data.unit));
  y += unitH + Math.round(dpi === 203 ? 4 : 6);
  lines.push(field(m, y, nameH, Math.round(nameH * 0.85), data.name.slice(0, 40)));
  y += nameH + Math.round(dpi === 203 ? 8 : 10);

  const remaining = m + usableH - y;
  if (data.code && remaining >= mmToDots(6, dpi) && usableW >= mmToDots(14, dpi)) {
    const barH = Math.min(Math.round(remaining * 0.7), mmToDots(heightMm >= 40 ? 12 : 8, dpi));
    const module = 2;
    if (heightMm >= 25 || widthMm >= 38) {
      lines.push(barcodeCmd(m, y, barH, module, data.code));
    } else {
      lines.push(field(m, y, Math.max(14, unitH), Math.round(unitH * 0.8), data.code));
    }
  } else if (data.code) {
    lines.push(field(m, y, Math.max(14, unitH), Math.round(unitH * 0.8), data.code));
  }

  void shape40;
  return lines.join("\n");
}

export function generateProductLabelsZpl(
  products: Product[],
  sizeId: ProductLabelSizeId,
  options?: {
    dpi?: 203 | 300;
    copies?: number;
    shape40?: LabelShape40;
    dualVariant?: DualVariant | null;
    gapXmm?: number;
  }
): string {
  const preset = getPresetBySizeId(sizeId);
  const dpi = options?.dpi === 300 ? 300 : 203;
  const copies = Math.max(1, Math.min(50, Number(options?.copies) || 1));
  const shape40 = options?.shape40 || "square";
  const items: LabelFieldData[] = [];
  for (const product of products) {
    const fields = productToLabelFields(product);
    for (let i = 0; i < copies; i += 1) items.push(fields);
  }
  if (!items.length) throw new Error("Selecione ao menos um produto");

  const blocks: string[] = [];

  if (preset.dual) {
    const dual = options?.dualVariant;
    if (!dual) throw new Error("Escolha o modo da etiqueta 100×150 dupla (A, B ou C)");

    if (dual === "C") {
      const gap = Math.max(0, Number(options?.gapXmm) || 2);
      const pageWmm = preset.widthMm * 2 + gap;
      const maxWidthHint = 104; // tipicamente desktop térmica ~104mm
      if (pageWmm > maxWidthHint) {
        throw new Error(
          `Modo C exige largura de mídia ≈ ${pageWmm.toFixed(0)} mm (2×100 + gap). Verifique se a impressora suporta essa largura.`
        );
      }
      const pw = mmToDots(pageWmm, dpi);
      const ll = mmToDots(preset.heightMm, dpi);
      const gapDots = mmToDots(gap, dpi);
      const col2 = mmToDots(preset.widthMm, dpi) + gapDots;
      for (let i = 0; i < items.length; i += 2) {
        const left = composeLabel(
          items[i],
          dpi,
          preset.widthMm,
          preset.heightMm,
          preset.safeMarginMm,
          shape40
        );
        const right = items[i + 1]
          ? composeLabel(
              items[i + 1],
              dpi,
              preset.widthMm,
              preset.heightMm,
              preset.safeMarginMm,
              shape40
            ).replace(/\^FO(\d+),/g, (_, x) => `^FO${Number(x) + col2},`)
          : "";
        blocks.push(`^XA\n^PW${pw}\n^LL${ll}\n^LH0,0\n${left}\n${right}\n^XZ`);
      }
      return blocks.join("\n");
    }

    if (dual === "B") {
      const { pw, ll } = zplPageDots(preset, dpi);
      const halfMm = preset.heightMm / 2;
      for (let i = 0; i < items.length; i += 2) {
        const top = composeLabel(
          items[i],
          dpi,
          preset.widthMm,
          halfMm,
          preset.safeMarginMm,
          shape40
        );
        const bottom = items[i + 1]
          ? composeLabel(
              items[i + 1],
              dpi,
              preset.widthMm,
              halfMm,
              preset.safeMarginMm,
              shape40
            ).replace(/\^FO(\d+),(\d+)/g, (_, x, y) => `^FO${x},${Number(y) + mmToDots(halfMm, dpi)}`)
          : "";
        const sepY = mmToDots(halfMm, dpi);
        blocks.push(
          `^XA\n^PW${pw}\n^LL${ll}\n^LH0,0\n${top}\n^FO${mmToDots(preset.safeMarginMm, dpi)},${sepY}^GB${mmToDots(preset.widthMm - 2 * preset.safeMarginMm, dpi)},2,2^FS\n${bottom}\n^XZ`
        );
      }
      return blocks.join("\n");
    }
  }

  const { pw, ll } = zplPageDots(preset, dpi);
  for (const data of items) {
    const body = composeLabel(
      data,
      dpi,
      preset.widthMm,
      preset.heightMm,
      preset.safeMarginMm,
      shape40
    );
    blocks.push(`^XA\n^PW${pw}\n^LL${ll}\n^LH0,0\n${body}\n^XZ`);
  }
  return blocks.join("\n");
}

export function downloadZpl(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
