# Agentes IA - Documentação

## Visão Geral

Sistema de gerenciamento de agentes IA integrados com OpenAI Assistants API e Evolution API. Permite criar, configurar e sincronizar assistentes inteligentes que podem interagir via WhatsApp através da Evolution API.

## Arquitetura

```
┌─────────────────┐
│  Dashboard UI   │ (/agents)
└────────┬────────┘
         │
    ┌────▼────────────┐
    │  AgentManager   │ (src/services/agents/)
    └────┬────────────┘
         │
    ┌────▼─────────────────┐
    │  Edge Functions      │
    ├──────────────────────┤
    │ • agents-sync-openai │ → OpenAI Assistants API
    │ • agents-sync-evolution│ → Evolution ViewPool
    └──────────────────────┘
```

## Componentes

### 1. Banco de Dados

**Tabela `agents`:**
- `id`: UUID primário
- `organization_id`: Referência à organização
- `name`: Nome do agente
- `description`: Descrição opcional
- `language`: Idioma (pt-BR, en-US, etc.)
- `model`: Modelo OpenAI (gpt-4o-mini, gpt-4, etc.)
- `temperature`: Temperatura (0-1)
- `prompt_instructions`: Instruções base do prompt
- `persona`: JSON com personalidade/contexto
- `policies`: Array JSON com políticas/regras
- `openai_assistant_id`: ID do Assistant na OpenAI
- `evolution_config_id`: Referência à configuração Evolution
- `evolution_instance_id`: ID da instância Evolution
- `status`: draft | active | paused | archived
- `test_mode`: boolean
- `metadata`: JSON com dados extras
- `version`: Número da versão
- `created_at`, `updated_at`

**Tabela `agent_versions`:**
- Histórico de versões anteriores
- Permite rollback de configurações

**Tabela `agent_usage_metrics`:**
- Métricas de uso (tokens, mensagens, custos)
- Agregadas por dia

### 2. Frontend

**Dashboard** (`src/pages/AgentsDashboard.tsx`):
- Lista de agentes
- Formulário de criação/edição
- Botões de sincronização
- Métricas básicas

**Hook** (`src/hooks/useAgents.ts`):
- `listAgents()` - Lista agentes da organização
- `createAgent()` - Cria novo agente
- `updateAgent()` - Atualiza agente existente
- `syncAgent()` - Sincroniza com OpenAI ou Evolution
- `getStats()` - Estatísticas de uso

### 3. Backend

**AgentManager** (`src/services/agents/AgentManager.ts`):
- Camada de serviço centralizada
- Validações e regras de negócio
- Invoca Edge Functions

**Edge Functions:**

**`agents-sync-openai`:**
- Cria ou atualiza Assistant na OpenAI
- Requer `OPENAI_API_KEY` nas variáveis de ambiente
- Retorna `assistant_id` que é salvo no banco

**`agents-sync-evolution`:**
- Sincroniza configurações no endpoint ViewPool da Evolution
- Envia payload com nome, assistantId, prompt, etc.
- Retorna `instance_id`

## Fluxo de Uso

### 1. Criar Agente

```typescript
const agent = await AgentManager.createAgent({
  organization_id: "uuid",
  name: "Assistente de Vendas",
  description: "Responde dúvidas sobre produtos",
  language: "pt-BR",
  model: "gpt-4o-mini",
  temperature: 0.7,
  prompt_instructions: "Você é um assistente de vendas...",
  persona: { style: "friendly", tone: "professional" },
  policies: [
    { text: "Sempre cumprimente o cliente" },
    { text: "Não forneça preços sem aprovação" }
  ],
  evolution_config_id: "uuid-opcional",
  test_mode: false
});
```

### 2. Sincronizar com OpenAI

```typescript
const result = await AgentManager.syncWithOpenAI(agent.id);
// Salva openai_assistant_id automaticamente
```

### 3. Sincronizar com Evolution

```typescript
const result = await AgentManager.syncWithEvolution(agent.id);
// Salva evolution_instance_id automaticamente
```

### 4. Atualizar Agente

```typescript
await AgentManager.updateAgent(agent.id, {
  temperature: 0.8,
  prompt_instructions: "Novo prompt..."
});
// Cria automático uma entrada em agent_versions
```

## Configuração

### Variáveis de Ambiente (Edge Functions)

```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### Aplicar Migração SQL

Antes de usar, aplicar a migração:

```bash
# Via Supabase CLI
supabase migration up

# Ou via SQL Editor (Lovable Cloud)
# Executar: supabase/migrations/20251118020000_create_agents_schema.sql
```

## Testando

### Criar Agente via UI

1. Acesse `/agents` no menu lateral (ícone de robô 🤖)
2. Clique em "Criar Novo Agente"
3. Preencha nome, descrição, prompt
4. (Opcional) Vincule a uma instância Evolution
5. Salve

### Sincronizar

- Botão **"Sync OpenAI"**: Cria/atualiza Assistant na OpenAI
- Botão **"Sync Evolution"**: Registra no ViewPool da Evolution

### Verificar Logs

- Console do navegador: logs de criação
- Supabase Edge Functions Logs: logs de sincronização
- Tabela `agent_usage_metrics`: métricas de uso

## Integração com Evolution

### Endpoint Esperado

Atualmente o conector utiliza o painel de **Integrações** da Evolution. A API precisa aceitar requisições para cadastrar/atualizar o bloco `integrations.openai` da instância:

```
POST /instance/{instanceName}/integrations/openai
Headers:
  apikey: <api_key_da_instancia>
Body:
  {
    "instanceName": "instance-123",
    "openai": {
      "enabled": true,
      "api_key": "sk-xxx",
      "assistant_id": "asst_abc123",
      "assistant_name": "Assistente de Vendas",
      "organization_id": "org-uuid",
      "assistants": [
        {
          "assistant_id": "asst_abc123",
          "name": "Assistente de Vendas",
          "model": "gpt-4o-mini",
          "prompt": "Você é...",
          "language": "pt-BR",
          "temperature": 0.6
        }
      ],
      "last_sync_at": "2025-11-19T12:00:00Z"
    }
  }
```

> Para ambientes legados ainda é possível reutilizar o endpoint `/viewpool/sync-agent`, mas o fluxo preferencial é atualizar diretamente o objeto `integrations.openai`.

### Fluxo de Mensagem

1. Evolution recebe mensagem WhatsApp
2. Evolution identifica instância → agente vinculado
3. Evolution chama OpenAI usando `assistantId`
4. OpenAI responde
5. Evolution envia resposta de volta ao WhatsApp

## Segurança

- RLS (Row Level Security) nas tabelas
- Apenas usuários da mesma organização veem seus agentes
- `OPENAI_API_KEY` nunca exposta no frontend
- Secrets gerenciados via Supabase Secrets

## Monitoramento

### Métricas Coletadas

- Total de mensagens processadas
- Tokens consumidos (prompt + completion)
- Custo estimado
- Tempo médio de resposta
- Taxa de erro

### Dashboard

Acessível em `/agents` → selecionar agente → aba "Métricas"

## Roadmap

- [ ] Suporte a arquivos (file_search tool)
- [ ] Suporte a function calling customizado
- [ ] A/B testing entre versões
- [ ] Analytics avançados
- [ ] Integração com outras plataformas (Telegram, etc.)

## Troubleshooting

### Erro: "OPENAI_API_KEY não configurada"

Adicionar variável nas Edge Functions via Supabase Dashboard.

### Erro: "Agente não encontrado"

Verificar se o agente pertence à organização ativa.

### Erro: "Evolution API error: 404"

Confirmar que a instância Evolution existe e que o endpoint `/instance/{instance}/integrations/openai` (ou fallback `/viewpool/sync-agent`) está implementado.

### Sincronização não atualiza

Verificar logs das Edge Functions no Supabase Dashboard → Edge Functions → Logs.

## Suporte

Para dúvidas ou problemas, consulte:
- Documentação OpenAI Assistants: https://platform.openai.com/docs/assistants
- Documentação Evolution API: (link do projeto)
- Issues no repositório GitHub

