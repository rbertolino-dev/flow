import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import type { Product } from "@/types/product";

export type ProductLabelSizeId =
  | "33x21"
  | "40mm"
  | "35x25"
  | "100x30"
  | "38x21"
  | "25x66"
  | "50x30"
  | "100x150";

export interface ProductLabelSizeOption {
  id: ProductLabelSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  dual?: boolean;
}

export const PRODUCT_LABEL_SIZES: ProductLabelSizeOption[] = [
  { id: "33x21", label: "Imprimir 33x21", widthMm: 33, heightMm: 21 },
  { id: "40mm", label: "Imprimir 40mm", widthMm: 40, heightMm: 28 },
  { id: "35x25", label: "Imprimir 35x25", widthMm: 35, heightMm: 25 },
  { id: "100x30", label: "Imprimir 100x30", widthMm: 100, heightMm: 30 },
  { id: "38x21", label: "Imprimir 38x21", widthMm: 38, heightMm: 21 },
  { id: "25x66", label: "Imprimir 25x66", widthMm: 25, heightMm: 66 },
  { id: "50x30", label: "Imprimir 50x30", widthMm: 50, heightMm: 30 },
  { id: "100x150", label: "Imprimir 100x150 (dupla)", widthMm: 100, heightMm: 150, dual: true },
];

type LabelData = {
  name: string;
  price: string;
  unit: string;
  code: string | null;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function toLabelData(product: Product): LabelData {
  const code = String(product.barcode || product.sku || "").trim() || null;
  return {
    name: String(product.name || "").trim().toUpperCase() || "PRODUTO",
    price: formatPrice(Number(product.price ?? 0)),
    unit: String(product.unit || "Un").trim() || "Un",
    code,
  };
}

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
  if (!code) return;
  const url = barcodeDataUrl(code);
  if (url) {
    doc.addImage(url, "PNG", x, y, width, height);
  }
  if (showText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5, Math.min(8, height * 0.45)));
    doc.text(code, x + width / 2, y + height + 2.2, { align: "center" });
  }
}

function drawCompactLabel(doc: jsPDF, data: LabelData, width: number, height: number, margin = 1.2) {
  const usableW = width - margin * 2;
  const centerX = width / 2;
  let y = margin + 3.2;

  const nameSize = height < 22 ? 6.5 : 8;
  const priceSize = height < 22 ? 8 : 10;
  const nameLines = wrapText(doc, data.name, usableW, nameSize, height < 24 ? 1 : 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  for (const line of nameLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += nameSize * 0.42;
  }

  y += 1.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(priceSize);
  doc.text(data.price, centerX, y, { align: "center" });
  y += priceSize * 0.35;

  const remaining = height - y - margin;
  if (remaining >= 7 && data.code) {
    const barH = Math.min(8, remaining - (remaining > 10 ? 3 : 0.5));
    const barW = Math.min(usableW, width * 0.88);
    drawBarcode(doc, data.code, (width - barW) / 2, y, barW, barH, remaining > 10);
  } else if (data.code && remaining >= 3) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(data.code, centerX, y + 2, { align: "center" });
  }
}

/** Anexo 03 — 40mm: preço + unidade, nome, barcode */
function draw40mm(doc: jsPDF, data: LabelData, width: number, height: number) {
  const margin = 1.5;
  const usableW = width - margin * 2;
  const centerX = width / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.price, centerX, margin + 4.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(data.unit, width - margin, margin + 3.2, { align: "right" });

  const nameLines = wrapText(doc, data.name, usableW, 8, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let y = margin + 9;
  for (const line of nameLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += 3.2;
  }

  if (data.code) {
    const barH = 8;
    const barW = Math.min(usableW, 34);
    drawBarcode(doc, data.code, (width - barW) / 2, height - margin - barH - 0.5, barW, barH, false);
  }
}

/** Anexo 04 — 100x30: nome, preço, barcode, código */
function draw100x30(doc: jsPDF, data: LabelData, width: number, height: number) {
  const margin = 2;
  const usableW = width - margin * 2;
  const centerX = width / 2;

  const nameLines = wrapText(doc, data.name, usableW, 9, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  let y = margin + 4;
  for (const line of nameLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += 3.6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(data.price, centerX, y + 1.5, { align: "center" });
  y += 5;

  if (data.code) {
    const barH = 7;
    const barW = Math.min(usableW * 0.7, 55);
    drawBarcode(doc, data.code, (width - barW) / 2, y, barW, barH, true);
  }
}

/** Formato vertical 25x66 */
function drawVertical(doc: jsPDF, data: LabelData, width: number, height: number) {
  const margin = 1.5;
  const usableW = width - margin * 2;
  const centerX = width / 2;
  let y = margin + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.price, centerX, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(data.unit, centerX, y, { align: "center" });
  y += 5;

  const nameLines = wrapText(doc, data.name, usableW, 8, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  for (const line of nameLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += 3.4;
  }

  if (data.code) {
    const barH = 18;
    const barW = Math.min(usableW, 20);
    const barY = Math.min(y + 4, height - margin - barH - 6);
    drawBarcode(doc, data.code, (width - barW) / 2, barY, barW, barH, true);
  }
}

/** Slot grande para 100x150 (metade da página) */
function drawLargeSlot(
  doc: jsPDF,
  data: LabelData,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const pad = 4;
  const usableW = width - pad * 2;
  const centerX = x + width / 2;
  let cursor = y + pad + 8;

  const nameLines = wrapText(doc, data.name, usableW, 14, 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  for (const line of nameLines) {
    doc.text(line, centerX, cursor, { align: "center" });
    cursor += 6;
  }

  cursor += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.price, centerX, cursor, { align: "center" });
  cursor += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.unit, centerX, cursor, { align: "center" });
  cursor += 8;

  if (data.code) {
    const barH = Math.min(28, height - (cursor - y) - pad - 8);
    const barW = Math.min(usableW * 0.75, 70);
    if (barH >= 10) {
      drawBarcode(doc, data.code, centerX - barW / 2, cursor, barW, barH, true);
    }
  }
}

function drawLabel(doc: jsPDF, size: ProductLabelSizeOption, data: LabelData) {
  if (size.id === "40mm") {
    draw40mm(doc, data, size.widthMm, size.heightMm);
    return;
  }
  if (size.id === "100x30") {
    draw100x30(doc, data, size.widthMm, size.heightMm);
    return;
  }
  if (size.id === "25x66") {
    drawVertical(doc, data, size.widthMm, size.heightMm);
    return;
  }
  drawCompactLabel(doc, data, size.widthMm, size.heightMm);
}

export function generateProductLabelsPdf(products: Product[], sizeId: ProductLabelSizeId): Blob {
  const size = PRODUCT_LABEL_SIZES.find((item) => item.id === sizeId);
  if (!size) throw new Error("Tamanho de etiqueta inválido");
  if (!products.length) throw new Error("Selecione ao menos um produto");

  const items = products.map(toLabelData);

  if (size.dual) {
    const doc = new jsPDF({
      orientation: size.widthMm >= size.heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [size.widthMm, size.heightMm],
    });
    const half = size.heightMm / 2;
    for (let i = 0; i < items.length; i += 2) {
      if (i > 0) doc.addPage([size.widthMm, size.heightMm]);
      drawLargeSlot(doc, items[i], 0, 0, size.widthMm, half);
      if (items[i + 1]) {
        drawLargeSlot(doc, items[i + 1], 0, half, size.widthMm, half);
      }
    }
    return doc.output("blob");
  }

  const doc = new jsPDF({
    orientation: size.widthMm >= size.heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [size.widthMm, size.heightMm],
  });

  items.forEach((data, index) => {
    if (index > 0) doc.addPage([size.widthMm, size.heightMm]);
    drawLabel(doc, size, data);
  });

  return doc.output("blob");
}

export function openProductLabelsPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
