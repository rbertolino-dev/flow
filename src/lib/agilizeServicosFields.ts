/** Campos da planilha de serviços (tabela espelho `servicos` do Agilize Total). */
export const AGILIZE_SERVICOS_FIELDS = [
  "nome",
  "descricao",
  "preço",
  "custo unit",
  "codigo",
  "categoria",
] as const;

export type AgilizeServicoField = (typeof AGILIZE_SERVICOS_FIELDS)[number];

export const SERVICO_FIELD_LABELS: Record<AgilizeServicoField, string> = {
  nome: "Nome",
  descricao: "Descrição",
  preço: "Preço",
  "custo unit": "Custo unitário",
  codigo: "Código",
  categoria: "Categoria",
};

export const SERVICO_BATCH_SIZE = 20;
export const SERVICO_BATCH_DELAY_MS = 2000;
