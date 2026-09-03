/** Campos permitidos no import/export de eprodutos (Agilize Total) */
export const AGILIZE_EPRODUTOS_FIELDS = [
  "nome",
  "medida",
  "origem_produto",
  "categoria_nome",
  "preço",
  "preço_atacado",
  "produto_filho",
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
