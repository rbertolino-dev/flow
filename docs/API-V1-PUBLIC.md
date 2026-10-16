# Agilize CRM Public API

Versão **2.0.0** (gerado em 2026-10-16T17:25:13.190Z)

API pública org-scoped. Documentação ≠ acesso: toda chamada exige Authorization: Bearer agz_live_... da organização. Ver também /docs/api no site.

**Documentação no site:** `/docs/api`

## Autenticação

```http
Authorization: Bearer agz_live_...
```

A documentação **não libera dados**. Cada organização precisa do próprio token.

## Changelog

- **1.0.0**: Leads CRUD, stages/tags read
- **1.1.0**: Tags write, activities, products, budgets, OS, members, broadcasts read
- **1.2.0**: Finance, POS read, Asaas wrap
- **2.0.0**: Bookings, calendar events, outbound webhooks (HMAC X-Agilize-Signature)

## Endpoints

- `GET /` — Metadados da API + organization_id + scopes
- `POST /asaas/boletos` — Criar boleto Asaas (proxy) (scopes: `asaas:write`)
- `POST /asaas/charges` — Criar cobrança Asaas (proxy) (scopes: `asaas:write`)
- `GET /bookings` — Listar agendamentos (scopes: `bookings:read`)
- `POST /bookings` — Criar agendamento (scopes: `bookings:write`)
- `GET /bookings/{id}` — Obter agendamento (scopes: `bookings:read`)
- `GET /broadcasts` — Listar campanhas (status) (scopes: `comms:read`)
- `GET /broadcasts/{id}` — Status de campanha (scopes: `comms:read`)
- `GET /budgets` — Listar orçamentos (scopes: `budgets:read`)
- `POST /budgets` — Criar orçamento (scopes: `budgets:write`)
- `GET /budgets/{id}` — Obter orçamento (scopes: `budgets:read`)
- `PATCH /budgets/{id}` — Atualizar orçamento (scopes: `budgets:write`)
- `GET /calendar/events` — Listar eventos (scopes: `calendar:read`)
- `POST /calendar/events` — Criar evento (scopes: `calendar:write`)
- `GET /calendar/events/{id}` — Obter evento (scopes: `calendar:read`)
- `GET /financial/accounts` — Contas financeiras (scopes: `finance:read`)
- `GET /financial/categories` — Categorias financeiras (scopes: `finance:read`)
- `GET /financial/entries` — Listar lançamentos (scopes: `finance:read`)
- `POST /financial/entries` — Criar lançamento (scopes: `finance:write`)
- `GET /financial/entries/{id}` — Obter lançamento (scopes: `finance:read`)
- `PATCH /financial/entries/{id}/settle` — Baixar lançamento (scopes: `finance:write`)
- `GET /leads` — Listar leads (phone, email, stage_id, q, updated_since, page, limit) (scopes: `leads:read`)
- `POST /leads` — Criar lead (scopes: `leads:write`)
- `DELETE /leads/{id}` — Soft-delete lead (scopes: `leads:write`)
- `GET /leads/{id}` — Obter lead (scopes: `leads:read`)
- `PATCH /leads/{id}` — Atualizar lead (scopes: `leads:write`)
- `GET /leads/{id}/activities` — Listar atividades (scopes: `activities:read`)
- `POST /leads/{id}/activities` — Append atividade (scopes: `activities:write`)
- `GET /leads/{id}/tags` — Etiquetas do lead (scopes: `tags:read`)
- `POST /leads/{id}/tags` — Associar etiqueta (tag_id ou name) (scopes: `tags:write`)
- `DELETE /leads/{id}/tags/{tagId}` — Remover etiqueta do lead (scopes: `tags:write`)
- `GET /members` — Listar membros da organização (scopes: `members:read`)
- `GET /pos/sales` — Listar vendas PDV (scopes: `pos:read`)
- `GET /pos/sales/{id}` — Detalhe venda PDV + itens (scopes: `pos:read`)
- `GET /products` — Listar produtos (scopes: `products:read`)
- `POST /products` — Criar produto (scopes: `products:write`)
- `GET /products/{id}` — Obter produto (scopes: `products:read`)
- `PATCH /products/{id}` — Atualizar produto (scopes: `products:write`)
- `GET /service-orders` — Listar OS (scopes: `service_orders:read`)
- `POST /service-orders` — Criar OS (scopes: `service_orders:write`)
- `GET /service-orders/{id}` — Obter OS (scopes: `service_orders:read`)
- `PATCH /service-orders/{id}` — Atualizar OS (scopes: `service_orders:write`)
- `GET /stages` — Listar etapas do funil (scopes: `stages:read`)
- `GET /tags` — Listar etiquetas (scopes: `tags:read`)
- `POST /tags` — Criar etiqueta (scopes: `tags:write`)
- `GET /webhooks` — Listar webhooks (scopes: `webhooks:write`)
- `POST /webhooks` — Criar webhook (secret exibido uma vez) (scopes: `webhooks:write`)
- `DELETE /webhooks/{id}` — Desativar webhook (scopes: `webhooks:write`)
- `PATCH /webhooks/{id}` — Atualizar webhook (scopes: `webhooks:write`)

## OpenAPI

Ver [openapi-v1.yaml](./openapi-v1.yaml).
