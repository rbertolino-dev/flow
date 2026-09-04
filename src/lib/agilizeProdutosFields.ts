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
