# Agilize CRM — API pública v1

API REST para integrações externas, com **isolamento estrito por organização**. Cada API key pertence a uma única organização e só acessa dados dessa org.

**Documentação no site (somente leitura — não libera dados):** `/docs/api`

A página de documentação **não substitui o token**. Toda chamada à API exige `Authorization: Bearer agz_live_...` da organização.

## Base URL

```
{SUPABASE_URL}/functions/v1/api-v1
```

Exemplo:

```
https://SEU_PROJETO.supabase.co/functions/v1/api-v1
```

## Autenticação

Envie a chave no header:

```http
Authorization: Bearer agz_live_...
```

Alternativa:

```http
x-api-key: agz_live_...
```

Chaves são geradas em **Configurações → API** (apenas owner/admin da organização). O secret completo é mostrado **uma única vez**.

### Escopos

| Escopo | Permite |
|--------|---------|
| `leads:read` | Listar e obter leads |
| `leads:write` | Criar, atualizar e soft-delete de leads |
| `stages:read` | Listar etapas do funil |
| `tags:read` | Listar etiquetas |

## Privacidade

- A organização é resolvida **só pela API key** (nunca pelo body/query).
- Leads excluídos (`deleted_at`) não aparecem nas listagens.
- Rate limit: **60 requisições/minuto** por chave (HTTP 429).

## Formato de resposta

Sucesso:

```json
{ "data": { ... } }
```

Lista paginada:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 35, "total": 100, "has_more": true }
}
```

Erro:

```json
{ "error": { "code": "unauthorized", "message": "..." } }
```

## Endpoints

### `GET /`

Metadados da API + `organization_id` da chave.

### `GET /leads`

Query: `page` (default 1), `limit` (default 35, máx 100), `stage_id` (opcional).

### `GET /leads/:id`

### `POST /leads`

Body:

```json
{
  "name": "João Silva",
  "phone": "11999998888",
  "email": "joao@email.com",
  "company": "Empresa X",
  "value": 1500,
  "stage_id": "uuid-da-etapa",
  "notes": "Lead via integração",
  "source": "erp"
}
```

`name` e `phone` são obrigatórios. Telefone é normalizado (somente dígitos). Respeita a política de telefones duplicados da organização.

### `PATCH /leads/:id`

Campos opcionais: `name`, `phone`, `email`, `company`, `value`, `stage_id`, `notes`, `status`, `source`.

### `DELETE /leads/:id`

Soft delete (`deleted_at`).

### `GET /stages`

Lista etapas do funil da organização.

### `GET /tags`

Lista etiquetas da organização.

## Exemplos curl

```bash
export API_BASE="https://SEU_PROJETO.supabase.co/functions/v1/api-v1"
export API_KEY="agz_live_..."

# Listar leads
curl -sS "$API_BASE/leads?limit=10" \
  -H "Authorization: Bearer $API_KEY"

# Criar lead
curl -sS -X POST "$API_BASE/leads" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","phone":"11988887777","source":"api"}'

# Etapas
curl -sS "$API_BASE/stages" \
  -H "Authorization: Bearer $API_KEY"
```

## Códigos HTTP comuns

| Status | Código | Significado |
|--------|--------|-------------|
| 401 | `unauthorized` | Chave ausente, inválida, revogada ou expirada |
| 403 | `forbidden_scope` | Escopo insuficiente |
| 404 | `not_found` | Recurso ou rota inexistente |
| 409 | `duplicate_phone` | Telefone já existe (quando duplicatas não são permitidas) |
| 429 | `rate_limited` | Limite de taxa excedido |
| 400 | `validation_error` | Payload inválido |

## OpenAPI

Ver [openapi-v1.yaml](./openapi-v1.yaml) para importar no Postman/Insomnia.
