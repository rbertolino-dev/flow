import type { Product } from "@/types/product";
import {
  DualVariant,
  getPresetBySizeId,
  LabelShape40,
  productToLabelFields,
  ProductLabelSizeId,
  type LabelFieldData,
} from "@/lib/productLabelPresets";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelInnerHtml(data: LabelFieldData) {
  const code = data.code
    ? `<div class="sku">${escapeHtml(data.code)}</div>`
    : "";
  return `
    <div class="preco">${escapeHtml(data.price)}</div>
    <div class="unidade">${escapeHtml(data.unit)}</div>
    <div class="nome">${escapeHtml(data.name)}</div>
    ${code}
  `;
}

export function generateProductLabelsHtml(
  products: Product[],
  sizeId: ProductLabelSizeId,
  options?: {
    shape40?: LabelShape40;
    dualVariant?: DualVariant | null;
    copies?: number;
    gapXmm?: number;
  }
): string {
  const preset = getPresetBySizeId(sizeId);
  const copies = Math.max(1, Math.min(50, Number(options?.copies) || 1));
  const items: LabelFieldData[] = [];
  for (const product of products) {
    const fields = productToLabelFields(product);
    for (let i = 0; i < copies; i += 1) items.push(fields);
  }
  if (!items.length) throw new Error("Selecione ao menos um produto");

  const shape40 = options?.shape40 || "square";
  const circleCss =
    preset.sizeId === "40mm" && shape40 === "circle"
      ? "border-radius:50%;"
      : "";

  if (preset.dual) {
    const dual = options?.dualVariant;
    if (!dual) throw new Error("Escolha o modo da etiqueta 100×150 dupla (A, B ou C)");

    if (dual === "C") {
      const gap = Math.max(0, Number(options?.gapXmm) || 2);
      const pageW = preset.widthMm * 2 + gap;
      const pageH = preset.heightMm;
      const cells: string[] = [];
      for (let i = 0; i < items.length; i += 2) {
        cells.push(`
          <section class="folha" aria-label="Folha dupla coluna">
            <div class="etiqueta">${labelInnerHtml(items[i])}</div>
            ${items[i + 1] ? `<div class="etiqueta">${labelInnerHtml(items[i + 1])}</div>` : `<div class="etiqueta vazia"></div>`}
          </section>
        `);
      }
      return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Etiquetas ${preset.widthMm}×${preset.heightMm} dupla C</title>
  <style>
    @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    .folha {
      width: ${pageW}mm; height: ${pageH}mm; margin: 0; padding: 0;
      display: flex; gap: ${gap}mm;
      break-after: page; page-break-after: always;
    }
    .etiqueta {
      width: ${preset.widthMm}mm; height: ${preset.heightMm}mm;
      padding: ${preset.safeMarginMm}mm; overflow: hidden;
      font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
      text-align: center;
    }
    .vazia { visibility: hidden; }
    .preco { font-size: 14pt; font-weight: bold; }
    .unidade { font-size: 8pt; margin-top: 1mm; }
    .nome { font-size: 11pt; font-weight: bold; margin-top: 2mm; line-height: 1.15; }
    .sku { font-size: 8pt; margin-top: 2mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
${cells.join("\n")}
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
    }

    if (dual === "B") {
      const sections = [];
      for (let i = 0; i < items.length; i += 2) {
        sections.push(`
          <section class="etiqueta dual-b" aria-label="Etiqueta dupla via">
            <div class="via">${labelInnerHtml(items[i])}</div>
            <hr class="corte">
            <div class="via">${items[i + 1] ? labelInnerHtml(items[i + 1]) : ""}</div>
          </section>
        `);
      }
      return buildSinglePageDoc(preset, sections.join("\n"), circleCss);
    }
  }

  const sections = items
    .map(
      (data) => `
    <section class="etiqueta" aria-label="Etiqueta do produto" style="${circleCss}">
      ${labelInnerHtml(data)}
    </section>`
    )
    .join("\n");

  return buildSinglePageDoc(preset, sections, circleCss);
}

function buildSinglePageDoc(
  preset: { widthMm: number; heightMm: number; safeMarginMm: number; label: string },
  body: string,
  circleCss: string
) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(preset.label)}</title>
  <style>
    @page { size: ${preset.widthMm}mm ${preset.heightMm}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: ${preset.widthMm}mm; margin: 0; padding: 0; }
    .etiqueta {
      width: ${preset.widthMm}mm; height: ${preset.heightMm}mm;
      padding: ${preset.safeMarginMm}mm; overflow: hidden;
      break-after: page; page-break-after: always;
      font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
      text-align: center; ${circleCss}
    }
    .dual-b { display: flex; flex-direction: column; }
    .dual-b .via { flex: 1; overflow: hidden; }
    .dual-b .corte { width: 100%; border: none; border-top: 0.3mm solid #000; margin: 0; }
    .preco { font-size: ${preset.heightMm <= 25 ? 9 : 11}pt; font-weight: bold; }
    .unidade { font-size: 7pt; margin-top: 0.5mm; }
    .nome { font-size: ${preset.heightMm <= 25 ? 7 : 9}pt; font-weight: bold; margin-top: 1mm; line-height: 1.1; }
    .sku { font-size: 6.5pt; margin-top: 1mm; word-break: break-all; }
    @media screen { .etiqueta { outline: 1px dashed #aaa; margin-bottom: 4mm; } }
    @media print { .etiqueta { outline: none; } }
  </style>
</head>
<body>
${body}
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
}

export function openProductLabelsHtml(html: string) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Permita pop-ups para imprimir as etiquetas");
  win.document.open();
  win.document.write(html);
  win.document.close();
}
