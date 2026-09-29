import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import type { Product } from "@/types/product";
import {
  DualVariant,
  getPresetBySizeId,
  LabelShape40,
  productToLabelFields,
  ProductLabelSizeId,
  usefulAreaMm,
  type LabelFieldData,
  type ProductLabelPreset,
} from "@/lib/productLabelPresets";

export type { ProductLabelSizeId } from "@/lib/productLabelPresets";
export { PRODUCT_LABEL_SIZES } from "@/lib/productLabelPresets";

function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number, maxLines: number) {
  doc.setFontSize(fontSize);
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(next) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && doc.getTextWidth(`${last}...`) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}...`;
  }
  return lines;
}

function barcodeDataUrl(code: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, code, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      width: 2,
      height: 60,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function drawBarcode(
  doc: jsPDF,
  code: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
  showText: boolean
) {
  if (!code || height < 4 || width < 8) return;
  const url = barcodeDataUrl(code);
  if (url) doc.addImage(url, "PNG", x, y, width, height);
  if (showText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5, Math.min(7, height * 0.4)));
    doc.text(code, x + width / 2, y + height + 2, { align: "center", maxWidth: width });
  }
}

function drawContent(
  doc: jsPDF,
  data: LabelFieldData,
  originX: number,
  originY: number,
  usableW: number,
  usableH: number,
  preset: ProductLabelPreset,
  shape40: LabelShape40
) {
  const centerX = originX + usableW / 2;
  let y = originY + Math.min(4, usableH * 0.12);

  if (preset.sizeId === "40mm" && shape40 === "circle") {
    // Conteúdo deve caber no círculo de segurança: raio ≤ 18 mm a partir do centro físico 20,20.
    // A área útil já é 36×36; usamos o maior retângulo interno simplificado.
  }

  if (preset.sizeId === "40mm") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(usableH >= 34 ? 12 : 10);
    doc.text(data.price, centerX, y, { align: "center" });
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(data.unit, centerX, y, { align: "center" });
    y += 4;
    const nameLines = wrapText(doc, data.name, usableW * 0.92, 8, 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (const line of nameLines) {
      doc.text(line, centerX, y, { align: "center" });
      y += 3.3;
    }
    const remaining = originY + usableH - y;
    if (data.code && remaining >= 9) {
      const barH = Math.min(10, remaining - 3);
      const barW = Math.min(usableW * 0.85, 32);
      drawBarcode(doc, data.code, centerX - barW / 2, y, barW, barH, false);
    }
    return;
  }

  if (preset.sizeId === "100x30") {
    const nameLines = wrapText(doc, data.name, usableW, 9, 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    for (const line of nameLines) {
      doc.text(line, centerX, y, { align: "center" });
      y += 3.5;
    }
    doc.setFontSize(11);
    doc.text(data.price, centerX, y + 1, { align: "center" });
    y += 5;
    if (data.code) {
      const barH = Math.min(7, originY + usableH - y - 3);
      const barW = Math.min(usableW * 0.65, 55);
      if (barH >= 5) drawBarcode(doc, data.code, centerX - barW / 2, y, barW, barH, true);
    }
    return;
  }

  if (preset.sizeId === "25x66") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(data.price, centerX, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(data.unit, centerX, y, { align: "center" });
    y += 5;
    const nameLines = wrapText(doc, data.name, usableW, 8, 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (const line of nameLines) {
      doc.text(line, centerX, y, { align: "center" });
      y += 3.4;
    }
    const remaining = originY + usableH - y;
    if (data.code && remaining >= 14) {
      const barH = Math.min(20, remaining - 6);
      const barW = Math.min(usableW * 0.95, 18);
      drawBarcode(doc, data.code, centerX - barW / 2, y + 2, barW, barH, true);
    }
    return;
  }

  // Compacto (33x21, 35x25, 38x21, 50x30 e slots grandes)
  const nameSize = usableH < 18 ? 6.5 : usableH < 24 ? 7.5 : 9;
  const priceSize = usableH < 18 ? 8 : usableH < 24 ? 9 : 12;
  const maxNameLines = usableH < 20 ? 1 : usableH < 40 ? 2 : 3;
  const nameLines = wrapText(doc, data.name, usableW, nameSize, maxNameLines);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  for (const line of nameLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += nameSize * 0.42;
  }
  y += 1.2;
  doc.setFontSize(priceSize);
  doc.text(data.price, centerX, y, { align: "center" });
  y += priceSize * 0.38;

  const remaining = originY + usableH - y;
  if (data.code && remaining >= 8) {
    const showText = remaining > 11;
    const barH = Math.min(showText ? 8 : 6, remaining - (showText ? 3 : 0.5));
    const barW = Math.min(usableW * 0.9, usableW);
    drawBarcode(doc, data.code, centerX - barW / 2, y, barW, barH, showText);
  } else if (data.code && remaining >= 3) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(data.code, centerX, y + 2, { align: "center", maxWidth: usableW });
  }
}

function newPage(doc: jsPDF | null, widthMm: number, heightMm: number): jsPDF {
  if (!doc) {
    return new jsPDF({
      orientation: widthMm >= heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm],
    });
  }
  doc.addPage([widthMm, heightMm], widthMm >= heightMm ? "landscape" : "portrait");
  return doc;
}

function drawLabelPage(
  doc: jsPDF,
  preset: ProductLabelPreset,
  data: LabelFieldData,
  shape40: LabelShape40,
  clipCircle: boolean
) {
  const margin = preset.safeMarginMm;
  const { widthMm: usableW, heightMm: usableH } = usefulAreaMm(
    preset.widthMm,
    preset.heightMm,
    margin
  );

  if (clipCircle && preset.sizeId === "40mm") {
    // Pré-visualização do círculo (não é corte físico).
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.circle(preset.widthMm / 2, preset.heightMm / 2, 18);
  }

  drawContent(doc, data, margin, margin, usableW, usableH, preset, shape40);
}

export interface GenerateLabelsPdfOptions {
  sizeId: ProductLabelSizeId;
  shape40?: LabelShape40;
  dualVariant?: DualVariant | null;
  copies?: number;
  gapXmm?: number;
}

export function generateProductLabelsPdf(
  products: Product[],
  sizeIdOrOptions: ProductLabelSizeId | GenerateLabelsPdfOptions,
  legacyShape?: LabelShape40,
  legacyDual?: DualVariant | null
): Blob {
  const options: GenerateLabelsPdfOptions =
    typeof sizeIdOrOptions === "string"
      ? {
          sizeId: sizeIdOrOptions,
          shape40: legacyShape || "square",
          dualVariant: legacyDual ?? null,
          copies: 1,
          gapXmm: 2,
        }
      : {
          shape40: "square",
          dualVariant: null,
          copies: 1,
          gapXmm: 2,
          ...sizeIdOrOptions,
        };

  const preset = getPresetBySizeId(options.sizeId);
  if (!products.length) throw new Error("Selecione ao menos um produto");

  const copies = Math.max(1, Math.min(50, Number(options.copies) || 1));
  const items: LabelFieldData[] = [];
  for (const product of products) {
    const fields = productToLabelFields(product);
    for (let c = 0; c < copies; c += 1) items.push(fields);
  }

  const shape40 = options.shape40 || "square";

  if (preset.dual) {
    const dual = options.dualVariant;
    if (!dual) {
      throw new Error("Escolha o modo da etiqueta 100×150 dupla (A, B ou C)");
    }

    if (dual === "A") {
      // Duas cópias sequenciais: cada página = uma etiqueta 100×150
      let doc: jsPDF | null = null;
      items.forEach((data, index) => {
        doc = newPage(doc, preset.widthMm, preset.heightMm);
        drawLabelPage(doc, preset, data, shape40, false);
        // Variante A: cada item já é uma página; "duas cópias" = usuário usa copies=2
        void index;
      });
      return doc!.output("blob");
    }

    if (dual === "B") {
      // Duas vias na mesma etiqueta 100×150
      let doc: jsPDF | null = null;
      for (let i = 0; i < items.length; i += 2) {
        doc = newPage(doc, preset.widthMm, preset.heightMm);
        const half = preset.heightMm / 2;
        const halfMargin = preset.safeMarginMm;
        const usableW = preset.widthMm - 2 * halfMargin;
        const usableH = half - 2 * halfMargin;
        drawContent(doc, items[i], halfMargin, halfMargin, usableW, usableH, preset, shape40);
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(halfMargin, half, preset.widthMm - halfMargin, half);
        if (items[i + 1]) {
          drawContent(
            doc,
            items[i + 1],
            halfMargin,
            half + halfMargin,
            usableW,
            usableH,
            preset,
            shape40
          );
        }
      }
      return doc!.output("blob");
    }

    // C — duas colunas lado a lado (página = 2×100 + gap)
    const gap = Math.max(0, Number(options.gapXmm) || 2);
    const pageW = preset.widthMm * 2 + gap;
    const pageH = preset.heightMm;
    let doc: jsPDF | null = null;
    for (let i = 0; i < items.length; i += 2) {
      doc = newPage(doc, pageW, pageH);
      const m = preset.safeMarginMm;
      const usableW = preset.widthMm - 2 * m;
      const usableH = preset.heightMm - 2 * m;
      drawContent(doc, items[i], m, m, usableW, usableH, preset, shape40);
      if (items[i + 1]) {
        drawContent(
          doc,
          items[i + 1],
          preset.widthMm + gap + m,
          m,
          usableW,
          usableH,
          preset,
          shape40
        );
      }
    }
    return doc!.output("blob");
  }

  let doc: jsPDF | null = null;
  items.forEach((data) => {
    doc = newPage(doc, preset.widthMm, preset.heightMm);
    drawLabelPage(doc, preset, data, shape40, shape40 === "circle");
  });
  return doc!.output("blob");
}

export function openProductLabelsPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
