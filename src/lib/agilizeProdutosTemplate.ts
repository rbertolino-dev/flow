import ExcelJS from "exceljs";
import {
  AGILIZE_EPRODUTOS_FIELDS,
  AGILIZE_FIELD_LABELS,
  AGILIZE_FIELD_META,
  AGILIZE_MEDIDA_OPTIONS,
  AGILIZE_ORIGEM_OPTIONS,
  AGILIZE_STATUS_OPTIONS,
  AGILIZE_BOOLEAN_OPTIONS,
} from "@/lib/agilizeProdutosFields";

const DATA_ROWS = 500; // linhas com dropdown no template

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Gera e baixa template .xlsx com seletores (status, origem, booleanos, medida). */
export async function downloadAgilizeProdutosTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agilize CRM";
  wb.created = new Date();

  const ws = wb.addWorksheet("Produtos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const legenda = wb.addWorksheet("Legenda");
  const opcoes = wb.addWorksheet("Opcoes");

  // --- Opcoes (listas para dataValidation) ---
  opcoes.getColumn(1).values = ["status", ...AGILIZE_STATUS_OPTIONS];
  opcoes.getColumn(2).values = ["origem_produto", ...AGILIZE_ORIGEM_OPTIONS];
  opcoes.getColumn(3).values = ["boolean", ...AGILIZE_BOOLEAN_OPTIONS];
  opcoes.getColumn(4).values = ["medida", ...AGILIZE_MEDIDA_OPTIONS];
  opcoes.getColumn(1).width = 14;
  opcoes.getColumn(2).width = 70;
  opcoes.getColumn(3).width = 12;
  opcoes.getColumn(4).width = 16;

  // --- Legenda ---
  legenda.addRow(["campo", "tipo", "obrigatorio", "opcoes_ou_formato", "descricao"]);
  for (const f of AGILIZE_EPRODUTOS_FIELDS) {
    const m = AGILIZE_FIELD_META[f];
    legenda.addRow([
      f,
      m.kind,
      m.required ? "sim" : "nao",
      m.options?.join(" | ") ||
        (m.kind === "number" ? "numero (10 ou 10,5)" : "texto livre"),
      m.description || AGILIZE_FIELD_LABELS[f],
    ]);
  }
  legenda.getRow(1).font = { bold: true };
  legenda.columns.forEach((c) => {
    c.width = 28;
  });

  // --- Produtos header + exemplo ---
  const header = [...AGILIZE_EPRODUTOS_FIELDS];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  const example: Record<string, string | number | boolean> = {
    nome: "Produto Exemplo",
    medida: "Un",
    origem_produto: AGILIZE_ORIGEM_OPTIONS[0],
    preço: 10,
    status: "Em falta",
    produto_filho: false,
    desativado: false,
    codigo_produto: 1001,
  };
  ws.addRow(header.map((f) => (example[f] !== undefined ? example[f] : "")));

  header.forEach((f, i) => {
    const col = ws.getColumn(i + 1);
    const meta = AGILIZE_FIELD_META[f];
    col.width = Math.min(
      40,
      Math.max(12, f.length + 2, ...(meta.options?.map((o) => Math.min(o.length, 36)) || []))
    );
  });

  // Data validations for rows 2..DATA_ROWS+1
  const lastRow = DATA_ROWS + 1;
  const statusIdx = header.indexOf("status");
  const origemIdx = header.indexOf("origem_produto");
  const filhoIdx = header.indexOf("produto_filho");
  const desIdx = header.indexOf("desativado");
  const medidaIdx = header.indexOf("medida");

  const addList = (colIdx: number, formula: string) => {
    if (colIdx < 0) return;
    const letter = colLetter(colIdx);
    ws.dataValidations.add(`${letter}2:${letter}${lastRow}`, {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: "Valor inválido",
      error: "Escolha uma opção da lista",
      showInputMessage: true,
      promptTitle: "Seletor",
      prompt: "Selecione uma das opções",
    });
  };

  addList(statusIdx, `Opcoes!$A$2:$A$${1 + AGILIZE_STATUS_OPTIONS.length}`);
  addList(origemIdx, `Opcoes!$B$2:$B$${1 + AGILIZE_ORIGEM_OPTIONS.length}`);
  addList(filhoIdx, `Opcoes!$C$2:$C$${1 + AGILIZE_BOOLEAN_OPTIONS.length}`);
  addList(desIdx, `Opcoes!$C$2:$C$${1 + AGILIZE_BOOLEAN_OPTIONS.length}`);
  addList(medidaIdx, `Opcoes!$D$2:$D$${1 + AGILIZE_MEDIDA_OPTIONS.length}`);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template-eprodutos-agilize-total.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
