import {
  AGILIZE_EPRODUTOS_FIELDS,
  AGILIZE_FIELD_LABELS,
  type AgilizeEprodutosField,
} from "@/lib/agilizeProdutosFields";
import { normalizeColumnName } from "@/utils/normalizeExcelColumn";

type ColumnMapping = Record<string, AgilizeEprodutosField | "">;

/** Campos numéricos (mesma regra do backend) */
export const AGILIZE_NUMERIC_FIELDS: AgilizeEprodutosField[] = [
  "preço",
  "preço_atacado",
  "qnt_ideal",
  "qntd",
  "qntd_baixa",
  "total_custo",
  "total_venda",
  "custo_unit",
  "origem_produto",
];

export type FieldConferenceItem = {
  field: AgilizeEprodutosField;
  label: string;
  mapped: boolean;
  excelColumn: string | null;
  sampleValue: string;
  rowsWithValue: number;
  warning: string | null;
};

export type FieldConferenceReport = {
  items: FieldConferenceItem[];
  mappedCount: number;
  totalFields: number;
  withValueCount: number;
  warningCount: number;
  unmappedFields: AgilizeEprodutosField[];
  unmappedExcelColumns: string[];
};

function isEmptyCell(val: unknown): boolean {
  return val === undefined || val === null || String(val).trim() === "";
}

function looksLikeNumber(val: unknown): boolean {
  if (typeof val === "number" && !Number.isNaN(val)) return true;
  const s = String(val).trim();
  if (!s) return false;
  const plain = s.replace(",", ".");
  if (!Number.isNaN(Number(plain))) return true;
  const br = s.replace(/\./g, "").replace(",", ".");
  return !Number.isNaN(Number(br));
}

/** Conta quantos campos Agilize foram mapeados a partir dos headers */
export function countMappedAgilizeFields(
  mapping: ColumnMapping
): number {
  const mapped = new Set(
    Object.values(mapping).filter((v): v is AgilizeEprodutosField => !!v)
  );
  return mapped.size;
}

/**
 * Conferência completa: para cada campo Agilize, se está mapeado,
 * amostra da 1ª linha com valor e avisos (ex.: numérico com texto).
 */
export function buildFieldConference(
  mapping: ColumnMapping,
  excelRows: Record<string, unknown>[]
): FieldConferenceReport {
  const fieldToExcel = new Map<AgilizeEprodutosField, string>();
  for (const [excelCol, field] of Object.entries(mapping)) {
    if (field) fieldToExcel.set(field, excelCol);
  }

  const unmappedExcelColumns = Object.entries(mapping)
    .filter(([, field]) => !field)
    .map(([col]) => col);

  const items: FieldConferenceItem[] = AGILIZE_EPRODUTOS_FIELDS.map((field) => {
    const excelColumn = fieldToExcel.get(field) ?? null;
    const mapped = !!excelColumn;
    let sampleValue = "";
    let rowsWithValue = 0;
    let warning: string | null = null;

    if (mapped && excelColumn) {
      for (const row of excelRows) {
        const val = row[excelColumn];
        if (isEmptyCell(val)) continue;
        rowsWithValue += 1;
        if (!sampleValue) sampleValue = String(val);
      }

      // Só alerta se há valor preenchido inválido para campo numérico
      if (
        rowsWithValue > 0 &&
        AGILIZE_NUMERIC_FIELDS.includes(field) &&
        !looksLikeNumber(sampleValue)
      ) {
        warning = `Valor de exemplo não parece número: "${sampleValue}"`;
      }
    }

    return {
      field,
      label: AGILIZE_FIELD_LABELS[field],
      mapped,
      excelColumn,
      sampleValue,
      rowsWithValue,
      warning,
    };
  });

  const mappedCount = items.filter((i) => i.mapped).length;
  const withValueCount = items.filter((i) => i.rowsWithValue > 0).length;
  const warningCount = items.filter((i) => i.warning).length;
  const unmappedFields = items.filter((i) => !i.mapped).map((i) => i.field);

  return {
    items,
    mappedCount,
    totalFields: AGILIZE_EPRODUTOS_FIELDS.length,
    withValueCount,
    warningCount,
    unmappedFields,
    unmappedExcelColumns,
  };
}

/** Score para escolher melhor interpretação de CSV (encoding) */
export function scoreHeaderMapping(
  headers: string[],
  autoMap: (headers: string[]) => ColumnMapping
): number {
  const mapping = autoMap(headers);
  let score = countMappedAgilizeFields(mapping);
  // Bônus se nome e preço estão mapeados (campos críticos)
  const values = Object.values(mapping);
  if (values.includes("nome")) score += 5;
  if (values.includes("preço")) score += 3;
  // Penaliza headers com mojibake visível
  if (headers.some((h) => /[ÃÂ]/.test(h))) score -= 2;
  return score;
}

/** Normaliza header Excel para bater com campo Agilize (inclui aliases) */
export function resolveAgilizeField(
  excelHeader: string,
  aliases: Record<string, AgilizeEprodutosField>
): AgilizeEprodutosField | "" {
  const norm = normalizeColumnName(excelHeader);
  const direct = AGILIZE_EPRODUTOS_FIELDS.find(
    (f) => normalizeColumnName(f) === norm
  );
  if (direct) return direct;
  return aliases[norm] || "";
}
