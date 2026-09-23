/** Destino: banco Agilize Total (não o CRM). */
export type ClienteImportTipo = "contato" | "empresa";

export const CLIENTE_CATEGORIAS = [
  "Cliente",
  "Lead",
  "Fornecedor",
  "Colaborador",
] as const;

export const EMPRESA_CONTATO_FIELDS = [
  "nome",
  "cnpj",
  "telefone",
  "email",
  "categoria",
  "origem",
  "endereço",
  "n do endereço",
  "bairro",
  "cidade",
  "estado",
  "cep",
  "inscrição estadual",
  "site",
  "setor",
  "tamanho",
  "observações",
  "desativado",
  "produto/serviço",
  "responsável",
  "logradouro",
  "cod municp ibge",
] as const;

export const CONTATO_FIELDS = [
  "nome",
  "telefone",
  "Email",
  "cnpj ou cpf",
  "categoria",
  "origem",
  "cargo",
  "departamento",
  "empresa do contato",
  "endereço",
  "n do endereço",
  "bairro",
  "cidade",
  "estado",
  "CEP",
  "complemento",
  "rua",
  "observações",
  "desativado",
] as const;

export type EmpresaContatoField = (typeof EMPRESA_CONTATO_FIELDS)[number];
export type ContatoField = (typeof CONTATO_FIELDS)[number];
export type ClienteField = EmpresaContatoField | ContatoField;

export const CLIENTE_FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  cnpj: "CNPJ",
  telefone: "Telefone",
  email: "E-mail",
  Email: "E-mail",
  categoria: "Categoria",
  origem: "Origem",
  endereço: "Endereço",
  "n do endereço": "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado",
  cep: "CEP",
  CEP: "CEP",
  "inscrição estadual": "Inscrição estadual",
  site: "Site",
  setor: "Setor",
  tamanho: "Tamanho",
  observações: "Observações",
  desativado: "Desativado",
  "produto/serviço": "Produto/serviço",
  responsável: "Responsável",
  logradouro: "Logradouro",
  "cod municp ibge": "Código IBGE",
  "cnpj ou cpf": "CNPJ ou CPF",
  cargo: "Cargo",
  departamento: "Departamento",
  "empresa do contato": "Empresa do contato (nome)",
  complemento: "Complemento",
  rua: "Rua",
};

/** Campos existentes no banco e deixados de fora do template (RH / sistema). */
export const CONTATO_CAMPOS_FORA_DO_TEMPLATE = [
  "atvidade",
  "classificação etapa",
  "codigo",
  "colab_adm",
  "colab_user",
  "customer_id",
  "Data de Retorno",
  "data entrada cliente",
  "etiqueta",
  "exemplo",
  "foto",
  "id_uazap",
  "import",
  "mes de referencia",
  "personalizado 01",
  "prev de fechamento",
  "preço (fornecedor)",
  "responsavel",
  "RG DOC",
  "Emissor DOC",
  "serviço interessado",
  "serviço/produto fornec",
  "ULTIMA VENDA",
  "data da ultima venda",
  "campos RH - * (admissão, salário, documentos, etc.)",
  "ID",
  "uniqueid",
  "Creation Date",
  "empresa (injetado pelo unique ID validado)",
];

export const EMPRESA_CAMPOS_FORA_DO_TEMPLATE = [
  "customer_id",
  "data de entrada",
  "Data de Retorno",
  "lista crm",
  "etiquetas",
  "id_uazap",
  "import",
  "lead gerado em",
  "logo",
  "previsão de fechamento",
  "preço (fornecedor)",
  "atividade",
  "data da ultima venda",
  "ID",
  "uniqueid",
  "Creation Date",
  "empresa (injetado pelo unique ID validado)",
];

export function fieldsForTipo(tipo: ClienteImportTipo): readonly string[] {
  return tipo === "empresa" ? EMPRESA_CONTATO_FIELDS : CONTATO_FIELDS;
}

export const CLIENTE_BATCH_SIZE = 20;
export const CLIENTE_BATCH_DELAY_MS = 2000;
