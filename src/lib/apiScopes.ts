/** Scopes da API pública Agilize CRM (v1.2 / v2). Manter alinhado com manage-organization-api-key. */
export const API_SCOPE_OPTIONS = [
  { id: "leads:read", label: "Leads — leitura", group: "crm" },
  { id: "leads:write", label: "Leads — escrita", group: "crm" },
  { id: "stages:read", label: "Funil — leitura", group: "crm" },
  { id: "tags:read", label: "Etiquetas — leitura", group: "crm" },
  { id: "tags:write", label: "Etiquetas — escrita", group: "crm" },
  { id: "activities:read", label: "Atividades — leitura", group: "crm" },
  { id: "activities:write", label: "Atividades — escrita", group: "crm" },
  { id: "products:read", label: "Produtos — leitura", group: "sales" },
  { id: "products:write", label: "Produtos — escrita", group: "sales" },
  { id: "budgets:read", label: "Orçamentos — leitura", group: "sales" },
  { id: "budgets:write", label: "Orçamentos — escrita", group: "sales" },
  { id: "service_orders:read", label: "Ordens de serviço — leitura", group: "sales" },
  { id: "service_orders:write", label: "Ordens de serviço — escrita", group: "sales" },
  { id: "members:read", label: "Membros — leitura", group: "crm" },
  { id: "comms:read", label: "Campanhas WhatsApp — status (só leitura)", group: "comms" },
  { id: "finance:read", label: "Financeiro — leitura", group: "finance" },
  { id: "finance:write", label: "Financeiro — escrita", group: "finance" },
  { id: "pos:read", label: "PDV — leitura de vendas", group: "finance" },
  { id: "asaas:write", label: "Asaas — criar cobranças", group: "finance" },
  { id: "bookings:read", label: "Agendamentos — leitura", group: "calendar" },
  { id: "bookings:write", label: "Agendamentos — escrita", group: "calendar" },
  { id: "calendar:read", label: "Calendário — leitura", group: "calendar" },
  { id: "calendar:write", label: "Calendário — escrita", group: "calendar" },
  { id: "webhooks:write", label: "Webhooks de saída", group: "webhooks" },
] as const;

export type ApiScopeId = (typeof API_SCOPE_OPTIONS)[number]["id"];

/** Default ao criar chave nova: CRM core (sem finance/asaas/webhooks). */
export const DEFAULT_API_SCOPES: ApiScopeId[] = [
  "leads:read",
  "leads:write",
  "stages:read",
  "tags:read",
  "tags:write",
  "activities:read",
  "activities:write",
  "products:read",
  "products:write",
  "budgets:read",
  "budgets:write",
  "service_orders:read",
  "service_orders:write",
  "members:read",
  "comms:read",
];

export const ALLOWED_API_SCOPES = new Set(
  API_SCOPE_OPTIONS.map((s) => s.id),
);
