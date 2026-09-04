import {
  AGILIZE_NUMERIC_FIELDS,
  AGILIZE_FIELD_META,
  AGILIZE_FIELD_LABELS,
  AGILIZE_EPRODUTOS_FIELDS,
  type AgilizeEprodutosField,
} from "@/lib/agilizeProdutosFields";
import { normalizeColumnName } from "@/utils/normalizeExcelColumn";

type ColumnMapping = Record<string, AgilizeEprodutosField | "">;

export type FieldConferenceItem = {
  field: AgilizeEprodutosField;
  label: string;
  kind: string;
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

function looksLikeSelect(
  field: AgilizeEprodutosField,
  sample: string
): string | null {
  const meta = AGILIZE_FIELD_META[field];
  if (meta.kind === "boolean") {
    const s = sample.trim().toLowerCase();
    if (
      ["true", "false", "1", "0", "sim", "nao", "não", "yes", "no"].includes(s)
    ) {
      return null;
    }
    return `Booleano inválido: "${sample}" (use true/false)`;
  }
  if (meta.kind !== "select" || !meta.options) return null;
  const raw = sample.trim();
  if (meta.options.some((o) => o === raw || o.toLowerCase() === raw.toLowerCase())) {
    return null;
  }
  if (meta.acceptShortCodes && /^[0-8]\b/.test(raw)) return null;
  return `Fora das opções do seletor: "${raw}"`;
}

/** Conta quantos campos Agilize foram mapeados a partir dos headers */
export function countMappedAgilizeFields(mapping: ColumnMapping): number {
  const mapped = new Set(
    Object.values(mapping).filter((v): v is AgilizeEprodutosField => !!v)
  );
  return mapped.size;
}

/**
 * Conferência completa: para cada campo Agilize, se está mapeado,
 * amostra da 1ª linha com valor e avisos (tipo número/select).
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
    const meta = AGILIZE_FIELD_META[field];
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

      if (rowsWithValue > 0) {
        if (AGILIZE_NUMERIC_FIELDS.includes(field) && !looksLikeNumber(sampleValue)) {
          warning = `Valor de exemplo não parece número: "${sampleValue}"`;
        } else {
          warning = looksLikeSelect(field, sampleValue);
        }
      }
    }

    return {
      field,
      label: AGILIZE_FIELD_LABELS[field],
      kind: meta.kind,
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
    totalFields: items.length,
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
  const values = Object.values(mapping);
  if (values.includes("nome")) score += 5;
  if (values.includes("preço")) score += 3;
  if (values.includes("status")) score += 2;
  if (values.includes("origem_produto")) score += 2;
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
