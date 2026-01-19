# Guia de Implementação - Webhook Bubble para CRM

## Objetivo

Enviar notificações automáticas do sistema Bubble para o CRM sempre que um cliente atingir marcos de uso (7, 15, 30, 31+ dias), para que o CRM atualize automaticamente a etapa do cliente no funil de pós-venda.

---

## URL do Webhook

```
https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/bubble-usage-webhook
```

**Método:** `POST`  
**Content-Type:** `application/json`

---

## O Que Enviar (Payload JSON)

### Campos Obrigatórios

```json
{
  "company_name": "Nome da Empresa",
  "usage_days": 15
}
```

### Campos Opcionais (Recomendados)

```json
{
  "company_name": "Nome da Empresa",
  "usage_days": 15,
  "client_id": "ID-único-do-cliente-no-Bubble",
  "phone": "+5511999999999",
  "email": "contato@empresa.com",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Descrição dos Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `company_name` | string | ✅ Sim | Nome exato da empresa/cliente |
| `usage_days` | number | ✅ Sim | Número de dias que o cliente está usando a plataforma |
| `client_id` | string | ❌ Não | ID único do cliente no Bubble (para rastreamento) |
| `phone` | string | ❌ Não | Telefone do cliente |
| `email` | string | ❌ Não | Email do cliente |
| `organization_id` | UUID | ❌ Não | ID da organização no CRM (recomendado fornecer) |

---

## Como Implementar no Bubble (Passo a Passo)

### Opção 1: Workflow Agendado (Recomendado)

**Quando usar:** Para atualizar automaticamente todos os clientes periodicamente (ex: diariamente).

#### Passo 1: Criar Scheduled Event

1. No Bubble, vá em **Workflow** → **Scheduled Events**
2. Clique em **Create a new scheduled event**
3. Configure:
   - **Name:** "Atualizar Status de Uso dos Clientes"
   - **Schedule:** Diariamente às 9:00 AM (ou horário desejado)
   - **Timezone:** Seu timezone

#### Passo 2: Criar o Workflow

1. No workflow do Scheduled Event, adicione a ação **"Do a search for"**
2. Busque todos os clientes ativos (ou clientes que precisam ser atualizados)
3. Para cada cliente encontrado, adicione a ação **"Make changes to a Thing"**:
   - Calcule os dias de uso: `Current date/time - Client's Start Date`
   - Armazene em um campo temporário ou use diretamente

#### Passo 3: Configurar o Webhook

1. Adicione a ação **"Make an API call"**
2. Configure:

   **General:**
   - **Method:** `POST`
   - **URL:** `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/bubble-usage-webhook`

   **Headers:**
   - Adicione header: `Content-Type` = `application/json`

   **Body (JSON):**
   ```json
   {
     "company_name": "[Client's Company Name]",
     "usage_days": [Client's Usage Days],
     "client_id": "[Client's Unique ID]",
     "phone": "[Client's Phone]",
     "email": "[Client's Email]",
     "organization_id": "550e8400-e29b-41d4-a716-446655440000"
   }
   ```

   **Substitua os placeholders:**
   - `[Client's Company Name]` → Campo do Bubble com o nome da empresa
   - `[Client's Usage Days]` → Cálculo: Data atual - Data de início do cliente
   - `[Client's Unique ID]` → ID único do cliente no Bubble
   - `[Client's Phone]` → Telefone do cliente (se disponível)
   - `[Client's Email]` → Email do cliente (se disponível)
   - `organization_id` → UUID da organização (fornecido pelo cliente)

#### Passo 4: Tratar Resposta (Opcional)

1. Após o "Make an API call", adicione condição:
   - **If:** `API call's response:success` = `true`
   - **Then:** Marque cliente como "sincronizado" ou registre sucesso
   - **Else:** Registre erro ou envie notificação

---

### Opção 2: Workflow por Evento (Quando Cliente Atinge Marco)

**Quando usar:** Para enviar webhook apenas quando cliente atinge marcos específicos (7, 15, 30 dias).

#### Passo 1: Criar Campo de Controle

No Data Type "Client", adicione campos:
- `last_sync_date` (date) - Última data de sincronização
- `days_of_usage` (number) - Dias de uso calculados

#### Passo 2: Criar Workflow de Atualização

1. Crie um workflow que roda quando `days_of_usage` é atualizado
2. Adicione condição:
   ```
   If days_of_usage is one of: 7, 15, 30, 31
   AND last_sync_date is not today
   ```
3. Execute o webhook (mesma configuração da Opção 1)
4. Atualize `last_sync_date` = hoje

---

### Opção 3: Botão Manual (Para Testes)

**Quando usar:** Para testar a integração ou atualizar clientes manualmente.

1. Crie um botão na interface do cliente
2. No workflow do botão, adicione "Make an API call" (mesma configuração)
3. Mostre mensagem de sucesso/erro ao usuário

---

## Exemplo Visual de Configuração no Bubble

### Workflow Completo

```
┌─────────────────────────────────────┐
│ Scheduled Event: Daily at 9:00 AM  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Do a search for: Clients            │
│ Where: Status = "Active"            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ For each Client:                     │
│   Calculate: Usage Days =            │
│     Current Date - Start Date        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Make an API call                     │
│ Method: POST                         │
│ URL: [webhook URL]                   │
│ Body: {                              │
│   "company_name": Client.Name,       │
│   "usage_days": Usage Days,          │
│   "client_id": Client.Unique ID,     │
│   "organization_id": "[UUID]"        │
│ }                                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ If API response.success = true       │
│   Then: Mark as synced               │
│   Else: Log error                    │
└─────────────────────────────────────┘
```

---

## Respostas do Webhook

### Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Webhook processado com sucesso",
  "results": [
    {
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "company_name": "Empresa ABC Ltda",
      "usage_days": 25,
      "lead_id": "uuid-do-lead-criado",
      "stage_id": "uuid-da-etapa",
      "created": false,
      "action": "updated"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Erro (400 Bad Request)

```json
{
  "success": false,
  "error": "Payload inválido",
  "details": [
    {
      "path": ["company_name"],
      "message": "Nome da empresa é obrigatório"
    }
  ]
}
```

---

## Regras de Transição Automática

O CRM automaticamente move o cliente para a etapa correta baseado nos `usage_days`:

| Dias de Uso | Etapa no CRM |
|-------------|-------------|
| ≤ 7 dias | Novo Cliente |
| > 7 dias | Ativação |
| > 15 dias | Suporte |
| > 30 dias | Renovação |
| > 31 dias | Fidelizado |

**Você não precisa se preocupar com isso!** O CRM faz automaticamente.

---

## Dicas Importantes

### 1. Nome da Empresa

- ✅ Use sempre o **mesmo formato** de nome (ex: "Empresa ABC Ltda")
- ✅ O sistema é case-insensitive ("EMPRESA" = "empresa")
- ❌ Evite variações ("Empresa ABC" ≠ "Empresa ABC Ltda")

### 2. Cálculo de Dias de Uso

```javascript
// Exemplo de cálculo no Bubble
Usage Days = Current date/time - Client's Start Date
```

Certifique-se de que o cálculo está correto e retorna um número inteiro.

### 3. Organization ID

- **Recomendado:** Sempre forneça o `organization_id`
- Se não fornecer, o sistema tentará buscar em todas as organizações (pode ser lento)
- O UUID será fornecido pelo cliente

### 4. Quando Enviar

- **Diariamente:** Para manter todos os clientes atualizados
- **Quando atinge marco:** 7, 15, 30, 31 dias
- **Quando dados mudam:** Se o tempo de uso for atualizado manualmente

---

## Testando a Integração

### Teste Manual

1. Crie um botão de teste no Bubble
2. Configure o webhook com dados de um cliente de teste
3. Execute e verifique a resposta
4. Confirme no CRM que o cliente foi atualizado/criado

### Exemplo de Payload de Teste

```json
{
  "company_name": "Empresa Teste",
  "usage_days": 20,
  "client_id": "test-123",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Troubleshooting

### Erro: "Payload inválido"

**Causa:** Campo obrigatório faltando ou tipo incorreto.

**Solução:**
- Verifique que `company_name` é uma string não vazia
- Verifique que `usage_days` é um número (não texto)
- Verifique o formato JSON

### Erro: "Nenhuma organização encontrada"

**Causa:** `organization_id` não fornecido ou inválido.

**Solução:** Sempre forneça um `organization_id` válido.

### Cliente não aparece no CRM

**Causa:** Nome da empresa não corresponde.

**Solução:**
- Verifique o nome exato no CRM
- Use o mesmo formato de nome sempre
- Remova espaços extras (use trim)

---

## Suporte

Para dúvidas ou problemas:
- Verifique os logs do webhook no sistema
- Teste com um cliente de exemplo primeiro
- Confirme que o `organization_id` está correto

---

## Checklist de Implementação

- [ ] Scheduled Event criado (ou workflow por evento)
- [ ] Cálculo de dias de uso implementado
- [ ] Webhook configurado com URL correta
- [ ] Headers configurados (Content-Type: application/json)
- [ ] Body JSON configurado com campos dinâmicos
- [ ] `organization_id` adicionado ao payload
- [ ] Tratamento de resposta implementado
- [ ] Teste manual realizado com sucesso
- [ ] Workflow ativo e funcionando

---

## Exemplo Completo de Código JSON para o Bubble

Copie e cole este JSON no campo "Body" do "Make an API call", substituindo os valores entre colchetes:

```json
{
  "company_name": "[Client's Company Name]",
  "usage_days": [Client's Usage Days],
  "client_id": "[Client's Unique ID]",
  "phone": "[Client's Phone]",
  "email": "[Client's Email]",
  "organization_id": "[Your Organization UUID]"
}
```

**No Bubble, você substituirá:**
- `[Client's Company Name]` → Campo dinâmico: `Client's Company Name`
- `[Client's Usage Days]` → Expressão: `Current date/time - Client's Start Date` (em dias)
- `[Client's Unique ID]` → Campo dinâmico: `Client's Unique ID`
- `[Client's Phone]` → Campo dinâmico: `Client's Phone` (opcional)
- `[Client's Email]` → Campo dinâmico: `Client's Email` (opcional)
- `[Your Organization UUID]` → Valor fixo: UUID fornecido pelo cliente

---

**Versão:** 1.0  
**Data:** Janeiro 2024  
**Contato:** Para suporte, consulte a documentação técnica completa em `BUBBLE-WEBHOOK-INTEGRATION.md`
