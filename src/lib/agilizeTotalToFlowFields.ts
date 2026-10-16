/** Mapeamentos padrão Total → Flow (editáveis no wizard). */

export type MigrationEntity = "clientes" | "produtos" | "servicos" | "contas";

export type FieldMap = Record<string, string>;

export const MIGRATION_ENTITY_LABELS: Record<MigrationEntity, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  servicos: "Serviços",
  contas: "Contas a pagar/receber",
};

export const MIGRATION_ENTITY_ORDER: MigrationEntity[] = [
  "clientes",
  "produtos",
  "servicos",
  "contas",
];

export const FLOW_FIELDS: Record<
  MigrationEntity,
  Array<{ key: string; label: string }>
> = {
  clientes: [
    { key: "name", label: "Nome" },
    { key: "phone", label: "Telefone" },
    { key: "email", label: "E-mail" },
    { key: "company", label: "Empresa" },
    { key: "notes", label: "Observações" },
  ],
  produtos: [
    { key: "name", label: "Nome" },
    { key: "price", label: "Preço" },
    { key: "cost", label: "Custo" },
    { key: "sku", label: "SKU" },
    { key: "barcode", label: "Código de barras" },
    { key: "unit", label: "Unidade" },
    { key: "category", label: "Categoria" },
    { key: "stock_quantity", label: "Estoque" },
    { key: "min_stock", label: "Estoque mínimo" },
    { key: "ideal_stock", label: "Estoque ideal" },
    { key: "ncm", label: "NCM" },
    { key: "brand", label: "Marca" },
    { key: "description", label: "Descrição" },
    { key: "wholesale_price", label: "Preço atacado" },
  ],
  servicos: [
    { key: "name", label: "Nome" },
    { key: "price", label: "Preço" },
    { key: "description", label: "Descrição" },
    { key: "category", label: "Categoria" },
  ],
  contas: [
    { key: "amount", label: "Valor" },
    { key: "due_date", label: "Vencimento" },
    { key: "description", label: "Descrição" },
    { key: "contact_name", label: "Contato" },
    { key: "category", label: "Categoria" },
    { key: "account", label: "Conta" },
    { key: "direction", label: "Direção (pagar/receber)" },
    { key: "status", label: "Status" },
  ],
};

export const DEFAULT_FIELD_MAPS: Record<MigrationEntity, FieldMap> = {
  clientes: {
    name: "nome",
    phone: "telefone",
    email: "Email",
    company: "empresa do contato",
    notes: "observações",
  },
  produtos: {
    name: "nome",
    price: "preço",
    cost: "custo_unit",
    sku: "codigo_produto",
    barcode: "codigo_barras",
    unit: "medida",
    category: "categoria_nome",
    stock_quantity: "qntd",
    min_stock: "qntd_baixa",
    ideal_stock: "qnt_ideal",
    ncm: "codigo_ncm",
    brand: "marca",
    description: "descricao",
    wholesale_price: "preço_atacado",
  },
  servicos: {
    name: "nome",
    price: "preço",
    description: "descricao",
    category: "categoria",
  },
  contas: {
    amount: "valor",
    due_date: "vencimento",
    description: "descrição",
    contact_name: "contato",
    category: "categoria",
    account: "conta",
    direction: "tipo",
    status: "status",
  },
};
