import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

export interface ShoppingExportRow {
  name: string;
  qtyLabel: string;
  buy: number;
  cost: number;
  brand: string;
  category: string;
  status: string;
}

function sheetRows(rows: ShoppingExportRow[]) {
  return rows.map((row) => ({
    Produto: row.name,
    "Qnt atual": row.qtyLabel,
    "Qnt a comprar": row.buy,
    "Custo unitário": row.cost,
    Marca: row.brand || "",
    Categoria: row.category || "",
    Status: row.status,
  }));
}

export function exportShoppingExcel(filename: string, rows: ShoppingExportRow[]) {
  const sheet = XLSX.utils.json_to_sheet(sheetRows(rows));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Compras");
  XLSX.writeFile(book, filename);
}

export function exportShoppingPdf(filename: string, title: string, rows: ShoppingExportRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  const writeHeader = (pageTitle: string) => {
    doc.setFontSize(14);
    doc.text(pageTitle, margin, 14);
    doc.setFontSize(9);
    doc.text("Produto", margin, 22);
    doc.text("Qnt atual", 90, 22);
    doc.text("Comprar", 120, 22);
    doc.text("Custo", 145, 22);
    doc.text("Marca", 170, 22);
    doc.text("Status", 220, 22);
  };
  writeHeader(title);
  let y = 28;
  for (const row of rows) {
    if (y > 195) {
      doc.addPage();
      writeHeader(title);
      y = 28;
    }
    doc.text(row.name.slice(0, 42), margin, y);
    doc.text(row.qtyLabel, 90, y);
    doc.text(String(row.buy), 120, y);
    doc.text(row.cost.toFixed(2).replace(".", ","), 145, y);
    doc.text((row.brand || "—").slice(0, 24), 170, y);
    doc.text(row.status, 220, y);
    y += 6;
  }
  doc.save(filename);
}
