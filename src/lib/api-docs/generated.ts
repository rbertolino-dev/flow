/** Gerado por scripts/generate-api-docs.mjs — não editar à mão */
export const apiDocsGenerated = {
  "version": "2.0.0",
  "title": "Agilize CRM Public API",
  "description": "API pública org-scoped. Documentação ≠ acesso: toda chamada exige Authorization: Bearer agz_live_... da organização. Ver também /docs/api no site.",
  "changelog": [
    {
      "version": "1.0.0",
      "notes": "Leads CRUD, stages/tags read"
    },
    {
      "version": "1.1.0",
      "notes": "Tags write, activities, products, budgets, OS, members, broadcasts read"
    },
    {
      "version": "1.2.0",
      "notes": "Finance, POS read, Asaas wrap"
    },
    {
      "version": "2.0.0",
      "notes": "Bookings, calendar events, outbound webhooks (HMAC X-Agilize-Signature)"
    }
  ],
  "endpoints": [
    {
      "method": "GET",
      "path": "/",
      "summary": "Metadados da API + organization_id + scopes",
      "scopes": []
    },
    {
      "method": "POST",
      "path": "/asaas/boletos",
      "summary": "Criar boleto Asaas (proxy)",
      "scopes": [
        "asaas:write"
      ]
    },
    {
      "method": "POST",
      "path": "/asaas/charges",
      "summary": "Criar cobrança Asaas (proxy)",
      "scopes": [
        "asaas:write"
      ]
    },
    {
      "method": "GET",
      "path": "/bookings",
      "summary": "Listar agendamentos",
      "scopes": [
        "bookings:read"
      ]
    },
    {
      "method": "POST",
      "path": "/bookings",
      "summary": "Criar agendamento",
      "scopes": [
        "bookings:write"
      ]
    },
    {
      "method": "GET",
      "path": "/bookings/{id}",
      "summary": "Obter agendamento",
      "scopes": [
        "bookings:read"
      ]
    },
    {
      "method": "GET",
      "path": "/broadcasts",
      "summary": "Listar campanhas (status)",
      "scopes": [
        "comms:read"
      ]
    },
    {
      "method": "GET",
      "path": "/broadcasts/{id}",
      "summary": "Status de campanha",
      "scopes": [
        "comms:read"
      ]
    },
    {
      "method": "GET",
      "path": "/budgets",
      "summary": "Listar orçamentos",
      "scopes": [
        "budgets:read"
      ]
    },
    {
      "method": "POST",
      "path": "/budgets",
      "summary": "Criar orçamento",
      "scopes": [
        "budgets:write"
      ]
    },
    {
      "method": "GET",
      "path": "/budgets/{id}",
      "summary": "Obter orçamento",
      "scopes": [
        "budgets:read"
      ]
    },
    {
      "method": "PATCH",
      "path": "/budgets/{id}",
      "summary": "Atualizar orçamento",
      "scopes": [
        "budgets:write"
      ]
    },
    {
      "method": "GET",
      "path": "/calendar/events",
      "summary": "Listar eventos",
      "scopes": [
        "calendar:read"
      ]
    },
    {
      "method": "POST",
      "path": "/calendar/events",
      "summary": "Criar evento",
      "scopes": [
        "calendar:write"
      ]
    },
    {
      "method": "GET",
      "path": "/calendar/events/{id}",
      "summary": "Obter evento",
      "scopes": [
        "calendar:read"
      ]
    },
    {
      "method": "GET",
      "path": "/financial/accounts",
      "summary": "Contas financeiras",
      "scopes": [
        "finance:read"
      ]
    },
    {
      "method": "GET",
      "path": "/financial/categories",
      "summary": "Categorias financeiras",
      "scopes": [
        "finance:read"
      ]
    },
    {
      "method": "GET",
      "path": "/financial/entries",
      "summary": "Listar lançamentos",
      "scopes": [
        "finance:read"
      ]
    },
    {
      "method": "POST",
      "path": "/financial/entries",
      "summary": "Criar lançamento",
      "scopes": [
        "finance:write"
      ]
    },
    {
      "method": "GET",
      "path": "/financial/entries/{id}",
      "summary": "Obter lançamento",
      "scopes": [
        "finance:read"
      ]
    },
    {
      "method": "PATCH",
      "path": "/financial/entries/{id}/settle",
      "summary": "Baixar lançamento",
      "scopes": [
        "finance:write"
      ]
    },
    {
      "method": "GET",
      "path": "/leads",
      "summary": "Listar leads (phone, email, stage_id, q, updated_since, page, limit)",
      "scopes": [
        "leads:read"
      ]
    },
    {
      "method": "POST",
      "path": "/leads",
      "summary": "Criar lead",
      "scopes": [
        "leads:write"
      ]
    },
    {
      "method": "DELETE",
      "path": "/leads/{id}",
      "summary": "Soft-delete lead",
      "scopes": [
        "leads:write"
      ]
    },
    {
      "method": "GET",
      "path": "/leads/{id}",
      "summary": "Obter lead",
      "scopes": [
        "leads:read"
      ]
    },
    {
      "method": "PATCH",
      "path": "/leads/{id}",
      "summary": "Atualizar lead",
      "scopes": [
        "leads:write"
      ]
    },
    {
      "method": "GET",
      "path": "/leads/{id}/activities",
      "summary": "Listar atividades",
      "scopes": [
        "activities:read"
      ]
    },
    {
      "method": "POST",
      "path": "/leads/{id}/activities",
      "summary": "Append atividade",
      "scopes": [
        "activities:write"
      ]
    },
    {
      "method": "GET",
      "path": "/leads/{id}/tags",
      "summary": "Etiquetas do lead",
      "scopes": [
        "tags:read"
      ]
    },
    {
      "method": "POST",
      "path": "/leads/{id}/tags",
      "summary": "Associar etiqueta (tag_id ou name)",
      "scopes": [
        "tags:write"
      ]
    },
    {
      "method": "DELETE",
      "path": "/leads/{id}/tags/{tagId}",
      "summary": "Remover etiqueta do lead",
      "scopes": [
        "tags:write"
      ]
    },
    {
      "method": "GET",
      "path": "/members",
      "summary": "Listar membros da organização",
      "scopes": [
        "members:read"
      ]
    },
    {
      "method": "GET",
      "path": "/pos/sales",
      "summary": "Listar vendas PDV",
      "scopes": [
        "pos:read"
      ]
    },
    {
      "method": "GET",
      "path": "/pos/sales/{id}",
      "summary": "Detalhe venda PDV + itens",
      "scopes": [
        "pos:read"
      ]
    },
    {
      "method": "GET",
      "path": "/products",
      "summary": "Listar produtos",
      "scopes": [
        "products:read"
      ]
    },
    {
      "method": "POST",
      "path": "/products",
      "summary": "Criar produto",
      "scopes": [
        "products:write"
      ]
    },
    {
      "method": "GET",
      "path": "/products/{id}",
      "summary": "Obter produto",
      "scopes": [
        "products:read"
      ]
    },
    {
      "method": "PATCH",
      "path": "/products/{id}",
      "summary": "Atualizar produto",
      "scopes": [
        "products:write"
      ]
    },
    {
      "method": "GET",
      "path": "/service-orders",
      "summary": "Listar OS",
      "scopes": [
        "service_orders:read"
      ]
    },
    {
      "method": "POST",
      "path": "/service-orders",
      "summary": "Criar OS",
      "scopes": [
        "service_orders:write"
      ]
    },
    {
      "method": "GET",
      "path": "/service-orders/{id}",
      "summary": "Obter OS",
      "scopes": [
        "service_orders:read"
      ]
    },
    {
      "method": "PATCH",
      "path": "/service-orders/{id}",
      "summary": "Atualizar OS",
      "scopes": [
        "service_orders:write"
      ]
    },
    {
      "method": "GET",
      "path": "/stages",
      "summary": "Listar etapas do funil",
      "scopes": [
        "stages:read"
      ]
    },
    {
      "method": "GET",
      "path": "/tags",
      "summary": "Listar etiquetas",
      "scopes": [
        "tags:read"
      ]
    },
    {
      "method": "POST",
      "path": "/tags",
      "summary": "Criar etiqueta",
      "scopes": [
        "tags:write"
      ]
    },
    {
      "method": "GET",
      "path": "/webhooks",
      "summary": "Listar webhooks",
      "scopes": [
        "webhooks:write"
      ]
    },
    {
      "method": "POST",
      "path": "/webhooks",
      "summary": "Criar webhook (secret exibido uma vez)",
      "scopes": [
        "webhooks:write"
      ]
    },
    {
      "method": "DELETE",
      "path": "/webhooks/{id}",
      "summary": "Desativar webhook",
      "scopes": [
        "webhooks:write"
      ]
    },
    {
      "method": "PATCH",
      "path": "/webhooks/{id}",
      "summary": "Atualizar webhook",
      "scopes": [
        "webhooks:write"
      ]
    }
  ],
  "scopes": [
    "activities:read",
    "activities:write",
    "asaas:write",
    "bookings:read",
    "bookings:write",
    "budgets:read",
    "budgets:write",
    "calendar:read",
    "calendar:write",
    "comms:read",
    "finance:read",
    "finance:write",
    "leads:read",
    "leads:write",
    "members:read",
    "pos:read",
    "products:read",
    "products:write",
    "service_orders:read",
    "service_orders:write",
    "stages:read",
    "tags:read",
    "tags:write",
    "webhooks:write"
  ],
  "generatedAt": "2026-10-16T17:25:13.190Z"
} as const;
