# Integração Bubble Webhook - Gestão Automática de Pós-Venda

## Visão Geral

Este documento descreve como integrar o sistema Bubble com o CRM para gerenciar automaticamente as etapas de pós-venda baseado no tempo de uso dos clientes.

## Endpoint do Webhook

**URL:** `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/bubble-usage-webhook`

**Método:** `POST`

**Content-Type:** `application/json`

## Payload JSON

### Estrutura Básica

```json
{
  "company_name": "Nome da Empresa",
  "usage_days": 15,
  "client_id": "opcional-id-do-cliente-no-bubble",
  "organization_id": "uuid-da-organizacao-opcional"
}
```

### Campos Obrigatórios

- **`company_name`** (string, obrigatório): Nome da empresa/cliente que será identificado no sistema
- **`usage_days`** (number, obrigatório): Número de dias que o cliente está usando a plataforma

### Campos Opcionais

- **`client_id`** (string, opcional): ID único do cliente no sistema Bubble (para rastreamento)
- **`organization_id`** (UUID, opcional): ID da organização no CRM. Se não fornecido, o sistema tentará buscar em todas as organizações (não recomendado)

### Exemplo de Payload

```json
{
  "company_name": "Empresa ABC Ltda",
  "usage_days": 25,
  "client_id": "bubble-client-12345",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Regras de Transição de Etapas

O sistema automaticamente move os clientes entre as etapas de pós-venda baseado nos dias de uso:

| Dias de Uso | Etapa Destino | Descrição |
|------------|---------------|-----------|
| **≤ 7 dias** | Stage 1 (Posição 0) | Novo Cliente |
| **> 7 dias** | Stage 2 (Posição 1) | Ativação |
| **> 15 dias** | Stage 3 (Posição 2) | Suporte |
| **> 30 dias** | Stage 4 (Posição 3) | Renovação/Fidelizado |

### Notas Importantes

- As etapas são identificadas pela **posição** (position) na tabela `post_sale_stages`
- Se uma etapa não existir na posição esperada, o sistema usa a etapa mais próxima disponível
- A transição é automática e registrada como uma atividade no histórico do cliente

## Como Implementar no Bubble

### 1. Criar um Workflow

No Bubble, crie um workflow que será acionado quando você quiser notificar o sistema sobre o tempo de uso de um cliente.

### 2. Configurar o Webhook

Use a ação **"Make an API call"** no Bubble:

- **Method:** `POST`
- **URL:** `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/bubble-usage-webhook`
- **Content-Type:** `application/json`

### 3. Configurar o Body (JSON)

No campo "Body" do webhook, configure o JSON dinâmico:

```json
{
  "company_name": "{{Company's Name}}",
  "usage_days": {{Company's Usage Days}},
  "client_id": "{{Company's Unique ID}}",
  "organization_id": "{{Your Organization ID}}"
}
```

**Substitua:**
- `{{Company's Name}}` pelo campo que contém o nome da empresa no Bubble
- `{{Company's Usage Days}}` pelo campo que contém os dias de uso
- `{{Company's Unique ID}}` pelo ID único do cliente no Bubble (opcional)
- `{{Your Organization ID}}` pelo UUID da organização no CRM (recomendado)

### 4. Exemplo Completo no Bubble

```
Workflow: "Atualizar Status de Uso do Cliente"
Trigger: Quando um cliente atinge um marco de uso (7, 15, 30 dias)

Action: Make an API call
  - Method: POST
  - URL: https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/bubble-usage-webhook
  - Headers:
      Content-Type: application/json
  - Body (JSON):
      {
        "company_name": "[Company's Name]",
        "usage_days": [Company's Days of Usage],
        "client_id": "[Company's Unique ID]",
        "organization_id": "550e8400-e29b-41d4-a716-446655440000"
      }
```

## Resposta do Webhook

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
      "lead_id": "lead-uuid-aqui",
      "stage_id": "stage-uuid-aqui",
      "created": false,
      "action": "updated"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Erro de Validação (400 Bad Request)

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

### Erro Interno (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Mensagem de erro descritiva"
}
```

## Comportamento do Sistema

### Quando um Cliente é Encontrado

1. O sistema busca o cliente pelo **nome da empresa** (case-insensitive)
2. Se encontrado, atualiza:
   - A etapa (stage) baseado nos dias de uso
   - A data do último contato
   - Adiciona uma nota automática sobre a atualização
3. Se a etapa mudou, cria uma atividade de "status_change" no histórico

### Quando um Cliente NÃO é Encontrado

1. O sistema cria um novo lead de pós-venda com:
   - Nome da empresa como nome do lead
   - Etapa inicial baseada nos dias de uso
   - Fonte: "bubble_webhook"
   - Nota automática sobre a criação
2. Cria uma atividade inicial no histórico

## Identificação de Empresas

**IMPORTANTE:** O sistema identifica empresas pelo **nome exato** (case-insensitive). 

- ✅ "Empresa ABC" = "empresa abc" = "EMPRESA ABC"
- ❌ "Empresa ABC" ≠ "Empresa ABC Ltda"

**Recomendação:** Use sempre o mesmo formato de nome da empresa para garantir a correspondência correta.

## Quando Enviar o Webhook

Você pode configurar o Bubble para enviar o webhook em diferentes situações:

1. **Periodicamente** (ex: diariamente) para todos os clientes ativos
2. **Quando um cliente atinge um marco** (7, 15, 30 dias)
3. **Manualmente** através de um botão/ação no Bubble
4. **Quando o tempo de uso é atualizado** no sistema Bubble

## Exemplo de Implementação Completa

### Cenário: Atualizar status quando cliente atinge 15 dias

```
1. No Bubble, crie um Scheduled Event que roda diariamente
2. Para cada cliente ativo:
   - Calcule os dias de uso: [Current Date] - [Client's Start Date]
   - Se dias de uso >= 15 e ainda não foi notificado:
     - Execute o webhook com os dados do cliente
     - Marque como notificado
```

### Código de Exemplo (Bubble Workflow)

```
Workflow: "Daily Client Status Update"
Schedule: Every day at 9:00 AM

For each Client:
  Calculate: Usage Days = Current Date - Client Start Date
  
  If Usage Days > 0:
    Make API call to bubble-usage-webhook:
      company_name: Client's Company Name
      usage_days: Usage Days
      client_id: Client's Unique ID
      organization_id: Your Organization ID
```

## Troubleshooting

### Erro: "Nenhuma organização encontrada"

**Causa:** O `organization_id` não foi fornecido e nenhuma organização foi encontrada.

**Solução:** Sempre forneça o `organization_id` no payload.

### Erro: "Payload inválido"

**Causa:** Campos obrigatórios faltando ou tipos incorretos.

**Solução:** Verifique que:
- `company_name` é uma string não vazia
- `usage_days` é um número inteiro positivo

### Cliente não está sendo encontrado

**Causa:** Nome da empresa não corresponde exatamente.

**Solução:** 
- Verifique o nome exato da empresa no CRM
- Use trim() para remover espaços extras
- Considere normalizar nomes (remover acentos, caracteres especiais)

## Segurança

- O webhook **não requer autenticação** (verify_jwt = false)
- Recomenda-se implementar validação adicional no lado do Bubble
- O `organization_id` ajuda a isolar dados entre organizações

## Suporte

Para dúvidas ou problemas, consulte:
- Logs do webhook: `supabase functions logs bubble-usage-webhook`
- Verificar status: `curl https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/bubble-usage-webhook -X POST`

## Changelog

- **v1.0.0** (2024-01-15): Versão inicial
  - Suporte para identificação por nome da empresa
  - Transição automática de etapas baseada em dias de uso
  - Criação automática de leads quando não encontrados
