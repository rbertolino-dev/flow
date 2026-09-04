/** Campos permitidos no import/export de eprodutos (Agilize Total) */
export const AGILIZE_EPRODUTOS_FIELDS = [
  "nome",
  "medida",
  "origem_produto",
  "categoria_nome",
  "preço",
  "preço_atacado",
  "produto_filho",
  "desativado",
  "qnt_ideal",
  "qntd",
  "qntd_baixa",
  "status",
  "total_custo",
  "total_venda",
  "codigo_produto",
  "custo_unit",
  "codigo_ncm",
  "descricao_anp",
  "descricao",
  "marca",
  "cod_interno",
  "codigo_barras",
] as const;

export type AgilizeEprodutosField = (typeof AGILIZE_EPRODUTOS_FIELDS)[number];

export const AGILIZE_FIELD_LABELS: Record<AgilizeEprodutosField, string> = {
  nome: "Nome",
  medida: "Medida",
  origem_produto: "Origem produto",
  categoria_nome: "Categoria",
  preço: "Preço",
  preço_atacado: "Preço atacado",
  produto_filho: "Produto filho",
  desativado: "Desativado",
  qnt_ideal: "Qtd ideal",
  qntd: "Quantidade",
  qntd_baixa: "Qtd baixa",
  status: "Status",
  total_custo: "Total custo",
  total_venda: "Total venda",
  codigo_produto: "Código produto",
  custo_unit: "Custo unitário",
  codigo_ncm: "NCM",
  descricao_anp: "Descrição ANP",
  descricao: "Descrição",
  marca: "Marca",
  cod_interno: "Cód. interno",
  codigo_barras: "Código de barras",
};

/**
 * Tipo de cada campo (template + validação):
 * - text: texto livre
 * - number: número
 * - select: só opções da lista (vazio permitido, salvo required)
 * - boolean: true/false (ou sim/não)
 */
export type AgilizeFieldKind = "text" | "number" | "select" | "boolean";

export type AgilizeFieldMeta = {
  kind: AgilizeFieldKind;
  required?: boolean;
  /** Opções canônicas (select/boolean). Boolean usa "true"/"false" no Excel. */
  options?: readonly string[];
  /** Aceita código curto (ex.: "0") além do texto completo */
  acceptShortCodes?: boolean;
  description?: string;
};

/** Status observados no Agilize Total (únicos em uso) */
export const AGILIZE_STATUS_OPTIONS = ["Ideal", "Em falta", "Baixa"] as const;

/**
 * Origem fiscal (texto no banco — NÃO é número).
 * Formulário Bubble / NFe: código 0–8 com descrição.
 */
export const AGILIZE_ORIGEM_OPTIONS = [
  "0 – Nacional;",
  "1 – Estrangeira (importação direta);",
  "2 – Estrangeira (adquirida no mercado interno);",
  "3 – Nacional com mais de 40% de conteúdo estrangeiro;",
  "4 – Nacional produzida através de processos produtivos básicos;",
  "5 – Nacional com menos de 40% de conteúdo estrangeiro;",
  "6 – Estrangeira (importação direta) sem produto nacional similar;",
  "7 – Estrangeira (adquirida no mercado interno) sem produto nacional similar;",
  "8 – Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%;",
] as const;

export const AGILIZE_BOOLEAN_OPTIONS = ["false", "true"] as const;

/**
 * Medidas fixas do seletor Bubble / eprodutos (somente estas).
 * Ordem igual ao dropdown da aplicação.
 */
export const AGILIZE_MEDIDA_OPTIONS = [
  "Un",
  "Kg",
  "Gramas",
  "Litros",
  "ml",
  "Metros",
  "Latas",
  "Pacotes",
  "Caixas",
  "Scs",
  "M2",
  "M3",
  "Fardo",
] as const;

/** @deprecated Use AGILIZE_MEDIDA_OPTIONS */
export const AGILIZE_MEDIDA_SUGGESTIONS = AGILIZE_MEDIDA_OPTIONS;

export const AGILIZE_FIELD_META: Record<AgilizeEprodutosField, AgilizeFieldMeta> = {
  nome: { kind: "text", required: true, description: "Texto obrigatório" },
  medida: {
    kind: "select",
    options: AGILIZE_MEDIDA_OPTIONS,
    description: "Seletor — só as medidas existentes no eprodutos",
  },
  origem_produto: {
    kind: "select",
    options: AGILIZE_ORIGEM_OPTIONS,
    acceptShortCodes: true,
    description: "Seletor — origem fiscal 0 a 8",
  },
  categoria_nome: { kind: "text", description: "Texto livre" },
  preço: { kind: "number", description: "Número (ex.: 10 ou 10,5)" },
  preço_atacado: { kind: "number", description: "Número" },
  produto_filho: {
    kind: "boolean",
    options: AGILIZE_BOOLEAN_OPTIONS,
    description: "Seletor true/false",
  },
  desativado: {
    kind: "boolean",
    options: AGILIZE_BOOLEAN_OPTIONS,
    description: "Seletor true/false",
  },
  qnt_ideal: { kind: "number", description: "Número" },
  qntd: { kind: "number", description: "Número" },
  qntd_baixa: { kind: "number", description: "Número" },
  status: {
    kind: "select",
    options: AGILIZE_STATUS_OPTIONS,
    description: "Seletor — Ideal | Em falta | Baixa",
  },
  total_custo: { kind: "number", description: "Número" },
  total_venda: { kind: "number", description: "Número" },
  codigo_produto: { kind: "text", description: "Texto / código" },
  custo_unit: { kind: "number", description: "Número" },
  codigo_ncm: { kind: "text", description: "Texto (NCM)" },
  descricao_anp: { kind: "text", description: "Texto livre" },
  descricao: { kind: "text", description: "Texto livre" },
  marca: { kind: "text", description: "Texto livre" },
  cod_interno: { kind: "text", description: "Texto / código" },
  codigo_barras: { kind: "text", description: "Texto / EAN" },
};

export const AGILIZE_NUMERIC_FIELDS: AgilizeEprodutosField[] = (
  Object.entries(AGILIZE_FIELD_META) as [AgilizeEprodutosField, AgilizeFieldMeta][]
)
  .filter(([, m]) => m.kind === "number")
  .map(([f]) => f);

export const AGILIZE_SELECT_FIELDS: AgilizeEprodutosField[] = (
  Object.entries(AGILIZE_FIELD_META) as [AgilizeEprodutosField, AgilizeFieldMeta][]
)
  .filter(([, m]) => m.kind === "select" || m.kind === "boolean")
  .map(([f]) => f);

export const AGILIZE_TEXT_FIELDS: AgilizeEprodutosField[] = (
  Object.entries(AGILIZE_FIELD_META) as [AgilizeEprodutosField, AgilizeFieldMeta][]
)
  .filter(([, m]) => m.kind === "text")
  .map(([f]) => f);

/** Normaliza e resolve valor de select (status/origem); null = vazio; false = inválido */
export function resolveSelectOption(
  field: AgilizeEprodutosField,
  value: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const meta = AGILIZE_FIELD_META[field];
  if (meta.kind !== "select" || !meta.options) {
    return { ok: true, value: value == null ? null : String(value) };
  }
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  const raw = String(value).trim();
  const options = meta.options;

  const exact = options.find((o) => o === raw);
  if (exact) return { ok: true, value: exact };

  const lower = raw.toLowerCase();
  const ci = options.find((o) => o.toLowerCase() === lower);
  if (ci) return { ok: true, value: ci };

  if (meta.acceptShortCodes) {
    const digit = raw.match(/^([0-8])\b/);
    if (digit) {
      const code = digit[1];
      const byCode = options.find(
        (o) =>
          o.startsWith(`${code} `) ||
          o.startsWith(`${code} –`) ||
          o.startsWith(`${code} -`)
      );
      if (byCode) return { ok: true, value: byCode };
    }
  }

  return {
    ok: false,
    error: `Campo '${field}' inválido: "${raw}". Use uma das opções: ${options
      .slice(0, 3)
      .join(" | ")}${options.length > 3 ? " | ..." : ""}`,
  };
}

export function resolveBooleanOption(
  value: unknown
): { ok: true; value: boolean | null } | { ok: false; error: string } {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  if (typeof value === "boolean") return { ok: true, value };
  if (value === 1 || value === 0) return { ok: true, value: value === 1 };
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "s", "verdadeiro"].includes(s)) {
    return { ok: true, value: true };
  }
  if (["false", "0", "nao", "não", "no", "n", "falso"].includes(s)) {
    return { ok: true, value: false };
  }
  return {
    ok: false,
    error: `Valor booleano inválido: "${value}". Use true ou false`,
  };
}

export const BATCH_SIZE = 25;
export const BATCH_DELAY_MS = 400;

/**
 * Lógica Bubble (o que o usuário vê na lista de produtos):
 * - NÃO mostra se desativado = true
 * - NÃO mostra se produto_filho = true
 * - null/false em ambos = visível
 */
export function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "sim" || s === "yes";
  }
  return false;
}

/** Produto visível para o usuário no Bubble */
export function isBubbleVisibleProduct(row: {
  desativado?: unknown;
  produto_filho?: unknown;
}): boolean {
  return !isTruthyFlag(row.desativado) && !isTruthyFlag(row.produto_filho);
}

export type BubbleVisibilityBreakdown = {
  total: number;
  visibleToUser: number;
  hiddenDesativado: number;
  hiddenProdutoFilho: number;
  /** Desativado e filho ao mesmo tempo (conta só em desativado na soma) */
  hiddenBoth: number;
};

export function countBubbleVisibility(
  rows: Array<{ desativado?: unknown; produto_filho?: unknown }>
): BubbleVisibilityBreakdown {
  let visibleToUser = 0;
  let hiddenDesativado = 0;
  let hiddenProdutoFilho = 0;
  let hiddenBoth = 0;
  for (const r of rows) {
    const des = isTruthyFlag(r.desativado);
    const filho = isTruthyFlag(r.produto_filho);
    if (des && filho) {
      hiddenBoth += 1;
      hiddenDesativado += 1;
    } else if (des) {
      hiddenDesativado += 1;
    } else if (filho) {
      hiddenProdutoFilho += 1;
    } else {
      visibleToUser += 1;
    }
  }
  return {
    total: rows.length,
    visibleToUser,
    hiddenDesativado,
    hiddenProdutoFilho,
    hiddenBoth,
  };
}
