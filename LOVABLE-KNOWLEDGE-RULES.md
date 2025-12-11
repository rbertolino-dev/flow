# 📚 Regras de Conhecimento Lovable - Projeto CRM

Este documento contém regras críticas que DEVEM ser seguidas para evitar erros, conflitos e comportamentos inesperados no sistema.

---

## 🚫 1. Arquivos que NUNCA devem ser editados

```
# `constraints/files-never-edit`
Os seguintes arquivos são gerados automaticamente e NUNCA devem ser editados manualmente:
- `src/integrations/supabase/client.ts` - Cliente Supabase auto-gerado
- `src/integrations/supabase/types.ts` - Tipos do banco auto-gerados
- `supabase/config.toml` - Configuração do Supabase (gerenciada pelo sistema)
- `.env` - Variáveis de ambiente (gerenciadas automaticamente)

Qualquer modificação nesses arquivos será sobrescrita e pode causar erros de build.
```

---

## 🏢 2. Multilocação e Organização

```
# `architecture/multi-tenancy-organization-context`
O sistema é multi-tenant baseado em organizações. Regras críticas:
1. SEMPRE usar `organization_members` (não `user_organizations`) para buscar organização do usuário
2. A organização ativa é armazenada em localStorage com chave `active_organization_id`
3. O hook `useActiveOrganization` é a fonte de verdade para `activeOrgId`
4. Todas as queries de dados (leads, tags, activities, etc.) DEVEM filtrar por `organization_id`
5. Edge functions que criam dados DEVEM receber `organization_id` do frontend ou obtê-lo via `organization_members`
```

```
# `architecture/organization-id-required`
Ao criar ou consultar dados nas tabelas principais, SEMPRE incluir `organization_id`:
- leads
- activities
- tags
- pipeline_stages
- evolution_config
- chatwoot_configs
- whatsapp_workflows
- scheduled_messages
- call_queue
- products
- seller_goals

Tabelas sem `organization_id` são globais ou de configuração do sistema.
```

---

## 🔐 3. Autenticação e Edge Functions

```
# `architecture/edge-function-jwt-configuration`
Edge functions têm configuração de JWT no `supabase/config.toml`:
- `verify_jwt = true`: Requer autenticação (maioria das funções)
- `verify_jwt = false`: Webhooks e callbacks OAuth que recebem chamadas externas

Funções que DEVEM ter `verify_jwt = false`:
- evolution-webhook, chatwoot-webhook, facebook-webhook
- Callbacks OAuth (*-oauth-callback)
- Webhooks de pagamento (mercado-pago-webhook)
- Funções acionadas por cron jobs (process-*, sync-*)

NUNCA mudar `verify_jwt` sem entender o impacto na segurança.
```

```
# `architecture/edge-function-service-role`
Para operações que bypassam RLS em edge functions:
1. SEMPRE usar `SUPABASE_SERVICE_ROLE_KEY` (não a chave anon)
2. Criar cliente separado: `createClient(url, SERVICE_ROLE_KEY)`
3. Usar apenas quando necessário (ex: criar leads via webhook sem user autenticado)
4. NUNCA expor SERVICE_ROLE_KEY no frontend
```

---

## 📊 4. Estrutura de Dados de Leads

```
# `architecture/leads-data-resilience`
O hook `useLeads` implementa resiliência para mudanças de schema:
1. Tenta query com `excluded_from_funnel` filter
2. Se falhar (coluna não existe), faz fallback sem o filtro
3. Isso previne que leads desapareçam por erro de schema

NUNCA remover esta lógica de fallback sem garantir que a coluna existe.
```

```
# `architecture/leads-soft-delete`
Leads usam soft delete:
- Campo `deleted_at` marca exclusão (não DELETE real)
- Queries DEVEM filtrar `.is('deleted_at', null)` para mostrar apenas leads ativos
- Para restaurar lead, setar `deleted_at = null`
```

---

## 📱 5. API Evolution / WhatsApp

```
# `architecture/evolution-api-webhook-authentication`
O webhook da Evolution API aceita autenticação via múltiplos métodos:
1. Header `x-webhook-secret` ou `x-api-key` ou `apikey`
2. Query parameter `?secret=` ou `?apikey=` ou `?token=`
3. Payload JSON com `apikey`, `secret`, ou `token`

O webhook busca a config por:
1. Primeiro: `webhook_secret` na tabela `evolution_config`
2. Segundo: `api_key` na tabela `evolution_config`
3. Terceiro: `instance_name` como fallback

NUNCA alterar esta lógica de autenticação sem testar todos os cenários.
```

```
# `architecture/evolution-api-phone-normalization`
Números brasileiros são normalizados para 11 dígitos com DDI:
- Formato esperado: `55DDDNNNNNNNNN` (13 dígitos total)
- Se vem sem DDI, prefixar com `55`
- Números internacionais (não brasileiros) são ignorados pelo webhook

A validação via Evolution API endpoint `/chat/whatsappNumbers` retorna:
- `result.messages.records` (array aninhado, não array direto)
- Campo `exists` é o indicador primário de WhatsApp válido
```

---

## 🔄 6. Votação eletrônica em tempo real

```
# `architecture/polling-background-silent-mechanism`
Polling e atualizações realtime DEVEM ser silenciosos:
1. Usar refs para estabilidade de dependências
2. Só atualizar state quando dados REALMENTE mudaram (comparar snapshots)
3. Evitar re-renders constantes que causam flickering na UI
4. useLeads já implementa updates otimistas para melhor UX
```

---

## 💰 7. Otimização de Custos Cloud

```
# `constraints/cloud-cost-optimization`
Otimizações implementadas para reduzir custos:
1. **Lazy loading de mensagens**: Carregar apenas 50 mensagens por vez
2. **Paginação de conversas**: 35 conversas por página
3. **Debounce em buscas**: 300ms para evitar chamadas excessivas
4. **Armazenamento de mensagens desativado**: `whatsapp_messages` não é populado
5. **Envio de mensagens no chat desabilitado**: ChatWindow.tsx tem envio disabled

NUNCA remover estas otimizações sem avaliar impacto nos custos.
```

---

## 🔗 8. Integrações Externas

```
# `architecture/integrations/chatwoot-token-types`
Chatwoot usa dois tipos de tokens:
1. **Platform App Token**: Apenas para `/platform/api/v1/*` (criar contas/usuários)
2. **User Access Token**: Para `/api/v1/*` e `/public/api/v1/*` (inboxes, mensagens)

Usar o token errado resulta em erro 401. O Access Token deve ser de um usuário Administrator (não SuperAdmin).
```

```
# `architecture/integrations/hubspot-token-format`
HubSpot requer Access Token de Private App (formato: `pat-na1-xxxxx`).
- Personal Access Key não funciona
- Escopos necessários: `crm.objects.contacts.read`, `crm.lists.read`
- Tokens de Private App não expiram
```

```
# `architecture/facebook-oauth-redirect-uri`
Facebook OAuth DEVE usar o redirect URI do edge function:
`https://[PROJECT_ID].supabase.co/functions/v1/facebook-oauth-callback`

Usar domínio da aplicação como redirect causa falha no callback.
```

---

## 🎨 9. UI/UX Consistência

```
# `ui/branding-menu-names`
Nomes de menu padronizados:
- "Agilizechat" (não "Chatwoot") - rota `/agilizechat`
- "Automações" (não "Automation Flows")
- "Funil" para pipeline de vendas
- "Pós-Venda" para CRM pós-venda

Manter consistência em toda a aplicação.
```

```
# `ui/login-page-no-signup`
A página de login NÃO tem opção de cadastro.
- Apenas formulário de sign-in
- Contas são criadas por administradores
- NUNCA adicionar link ou tab de sign-up sem autorização explícita
```

---

## ⚠️ 10. Padrões de Erro e Fallbacks

```
# `constraints/data-resilience-schema-changes`
Sistema implementa fallbacks para mudanças de schema:
1. Se query falha por coluna inexistente, retry sem o filtro
2. Manter leads existentes em caso de erro (não limpar array)
3. Logs detalhados para debug

Prioridade: NUNCA perder dados visíveis por erro de schema.
```

---

## 📋 Formato para Custom Knowledge do Lovable

Copie cada bloco de código (entre ```) e adicione como regra individual no Custom Knowledge do Lovable. Cada regra deve ter um identificador único no formato `categoria/nome-da-regra`.
