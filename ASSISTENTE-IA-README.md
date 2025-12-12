# Assistente IA DeepSeek - Documentação

## Visão Geral

O Assistente IA é um chatbot integrado ao CRM que permite gerenciar leads, consultar informações e realizar ações no sistema através de conversas em linguagem natural, utilizando a API do DeepSeek.

## Funcionalidades

### Gestão de Leads
- ✅ Criar novos leads
- ✅ Buscar leads por nome, telefone ou email
- ✅ Atualizar informações de leads
- ✅ Listar etapas do funil
- ✅ Adicionar tags a leads

### Agendamentos
- ✅ Agendar ligações para leads
- ✅ Enviar mensagens WhatsApp

### Consultas
- ✅ Listar etapas do funil
- ✅ Listar tags disponíveis
- ✅ Consultar informações de leads

## Configuração

### 1. Configurar API Key do DeepSeek

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Settings** > **Edge Functions** > **Secrets**
3. Adicione a variável de ambiente:
   - **Nome**: `DEEPSEEK_API_KEY`
   - **Valor**: Sua API key do DeepSeek (obtenha em https://platform.deepseek.com)

### 2. Aplicar Migration

Execute a migration no Supabase SQL Editor:

```sql
-- A migration está em:
-- supabase/migrations/20250131000001_create_assistant_tables.sql
```

### 3. Deploy da Edge Function

```bash
# No diretório agilize
supabase functions deploy deepseek-assistant
```

Ou faça o deploy manualmente pelo Supabase Dashboard:
1. Vá em **Edge Functions**
2. Clique em **Create Function**
3. Cole o código de `supabase/functions/deepseek-assistant/index.ts`

## Uso

### Acessar o Assistente

1. Faça login no sistema
2. No menu lateral, clique em **"Assistente IA"** (ícone de Sparkles)
3. Ou acesse diretamente: `/assistant`

### Exemplos de Comandos

- **Criar lead**: "Criar um novo lead chamado João Silva, telefone 11999999999, email joao@email.com"
- **Buscar leads**: "Buscar leads com nome João"
- **Listar etapas**: "Listar todas as etapas do funil"
- **Agendar ligação**: "Agendar uma ligação para o lead João Silva amanhã às 14h"
- **Enviar WhatsApp**: "Enviar mensagem WhatsApp para João Silva dizendo: Olá, como posso ajudar?"

## Arquitetura

### Componentes

1. **Edge Function**: `deepseek-assistant`
   - Processa mensagens do usuário
   - Integra com DeepSeek API
   - Executa ações no banco de dados

2. **Frontend**:
   - `src/pages/Assistant.tsx` - Página principal
   - `src/components/assistant/ChatInterface.tsx` - Interface de chat
   - `src/hooks/useAssistant.ts` - Hook para gerenciar conversas

3. **Banco de Dados**:
   - `assistant_conversations` - Histórico de conversas
   - `assistant_actions` - Auditoria de ações executadas

## Funções Disponíveis

O assistente pode executar as seguintes funções:

1. `create_lead` - Criar novo lead
2. `search_leads` - Buscar leads
3. `update_lead` - Atualizar lead
4. `list_stages` - Listar etapas do funil
5. `list_tags` - Listar tags
6. `add_tag_to_lead` - Adicionar tag a lead
7. `schedule_call` - Agendar ligação
8. `send_whatsapp_message` - Enviar mensagem WhatsApp

## Segurança

- ✅ Autenticação obrigatória (JWT)
- ✅ Isolamento por organização (RLS)
- ✅ Validação de parâmetros
- ✅ Auditoria de todas as ações
- ✅ Rate limiting (via Supabase)

## Custos

### DeepSeek API
- **Modelo**: `deepseek-chat`
- **Custo entrada**: ~R$ 0,14 por 1M tokens
- **Custo saída**: ~R$ 0,28 por 1M tokens
- **Estimativa por conversa**: ~R$ 0,01-0,05

### Otimizações
- Cache de contexto (etapas, tags)
- Limite de histórico (últimas 10 mensagens)
- Streaming para melhor UX

## Troubleshooting

### Erro: "API Key do DeepSeek não configurada"
- Verifique se a variável `DEEPSEEK_API_KEY` está configurada no Supabase
- Certifique-se de que a API key é válida

### Erro: "Organização não encontrada"
- Verifique se o usuário está associado a uma organização
- Certifique-se de que está logado

### Erro ao criar lead
- Verifique se o telefone não está duplicado
- Confirme que a etapa do funil existe

## Próximos Passos

Funcionalidades planejadas:
- [ ] Relatórios e estatísticas
- [ ] Workflows e automações
- [ ] Integração com calendário
- [ ] Gestão de produtos
- [ ] Boletos e pagamentos

## Suporte

Para problemas ou dúvidas, consulte:
- Documentação do DeepSeek: https://platform.deepseek.com/docs
- Logs do Supabase: Dashboard > Edge Functions > Logs



