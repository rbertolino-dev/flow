<!-- 2e73ad58-94a5-43df-93e5-63f61b151972 6c2f8ae4-323d-4520-a39f-69887e979a04 -->
# Plano B Seguro - Instabilidade Supabase

## Objetivo

Implementar sistema de fallback temporário para instabilidades do Supabase mantendo nível de segurança equivalente ao sistema atual, com criptografia de dados sensíveis e validação rigorosa de organização.

## Análise de Segurança Atual

### Pontos Fortes

- RLS (Row Level Security) em todas as tabelas
- Multi-tenancy baseado em `organization_id`
- Service Role Key apenas em Edge Functions (nunca no frontend)
- Validação de organização em todas as queries
- Tokens de autenticação já no localStorage

### Dados Sensíveis Identificados

- Telefones (PII - Personal Identifiable Information)
- Emails (PII)
- Valores financeiros (leads, contratos)
- PDFs de contratos com assinaturas
- Tokens de autenticação
- Dados de mensagens WhatsApp

## Arquitetura Segura do Plano B

### 1. Health Check Service

**Arquivo:** `src/services/supabaseHealthCheck.ts`

- Monitora saúde do Supabase a cada 30s
- Teste leve: query simples em `organizations` (já protegida por RLS)
- Notifica listeners sobre mudanças de status
- Não armazena dados sensíveis

### 2. Local Cache com Criptografia

**Arquivo:** `src/services/localCache.ts`

- Usa IndexedDB para armazenamento
- **Criptografia AES-256-GCM** para dados sensíveis
- Chave de criptografia derivada do session token (não armazenada)
- Validação de `organization_id` antes de cachear
- TTL (Time To Live) curto: 5-15 minutos
- Limpeza automática de dados expirados
- **NUNCA cacheia:**
- Service Role Keys
- Tokens de autenticação completos
- PDFs completos (apenas URLs)
- Dados de outras organizações

### 3. Queue de Operações Protegida

**Arquivo:** `src/services/pendingOperationsQueue.ts`

- Armazena apenas metadados (não dados completos)
- Valida `organization_id` antes de enfileirar
- Limite de 100 operações por organização
- Expiração automática após 24h
- Criptografia de dados sensíveis na queue
- Validação de permissões antes de executar

### 4. Supabase Wrapper Seguro

**Arquivo:** `src/services/supabaseWrapper.ts`

- Mantém todas as validações RLS
- Retry automático apenas para erros de rede (não de permissão)
- Cache apenas após validação de organização
- Logs sanitizados (sem dados sensíveis)
- Fallback para cache apenas se Supabase offline

### 5. Hook de Saúde

**Arquivo:** `src/hooks/useSupabaseHealth.ts`

- Monitora status do Supabase
- Notifica usuário sobre modo offline
- Não expõe dados sensíveis

### 6. Componente de Status

**Arquivo:** `src/components/SupabaseStatusIndicator.tsx`

- Indicador visual de status
- Não expõe informações sensíveis

## Implementação Segura

### Fase 1: Serviços Base (Seguros)

1. Criar `supabaseHealthCheck.ts` - apenas monitoramento
2. Criar `localCache.ts` - com criptografia AES-256-GCM
3. Criar utilitário de criptografia `src/utils/encryption.ts`

### Fase 2: Queue Protegida

4. Criar `pendingOperationsQueue.ts` - com validação de organização
5. Implementar limpeza automática de operações antigas

### Fase 3: Wrapper Seguro

6. Criar `supabaseWrapper.ts` - mantendo RLS
7. Implementar retry apenas para erros de rede
8. Adicionar validação de organização em todas as operações

### Fase 4: Integração

9. Criar hooks React (`useSupabaseHealth.ts`)
10. Criar componente de status visual
11. Integrar no `App.tsx`
12. Adaptar hooks críticos (`useLeads`, `useContracts`)

### Fase 5: Testes de Segurança

13. Testar isolamento de organizações no cache
14. Testar expiração de dados
15. Testar limpeza automática
16. Validar que dados sensíveis estão criptografados

## Medidas de Segurança Críticas

### Criptografia

- Usar Web Crypto API (nativo do navegador)
- Chave derivada do session token via PBKDF2
- AES-256-GCM para autenticação e confidencialidade
- IV (Initialization Vector) único para cada item

### Validação

- Sempre validar `organization_id` antes de cachear
- Sempre validar `organization_id` antes de retornar do cache
- Nunca retornar dados de outra organização
- Validar permissões antes de executar operações pendentes

### Limites

- Cache máximo: 50MB por organização
- TTL máximo: 15 minutos para dados sensíveis
- Queue máxima: 100 operações por organização
- Expiração automática: 24h para operações pendentes

### Logs

- Sanitizar logs (remover telefones, emails, valores)
- Não logar dados sensíveis
- Apenas logar metadados (IDs, timestamps)

## Nível de Segurança

### Antes (Sem Plano B)

- Segurança: ⭐⭐⭐⭐⭐ (5/5)
- Disponibilidade: ⭐⭐ (2/5) - depende 100% do Supabase

### Depois (Com Plano B Seguro)

- Segurança: ⭐⭐⭐⭐⭐ (5/5) - mantida com criptografia adicional
- Disponibilidade: ⭐⭐⭐⭐ (4/5) - funciona offline temporariamente

### Riscos Mitigados

- ✅ Dados sensíveis criptografados no cache
- ✅ Isolamento de organizações mantido
- ✅ RLS validado antes de cachear
- ✅ Expiração automática de dados
- ✅ Limpeza automática de operações antigas
- ✅ Logs sanitizados

### Riscos Residuais (Aceitáveis)

- ⚠️ Cache acessível via DevTools (mas criptografado)
- ⚠️ Dados temporários no IndexedDB (mas com TTL curto)
- ⚠️ Operações pendentes podem falhar se Supabase ficar offline > 24h

## Arquivos a Criar/Modificar

### Novos Arquivos

1. `src/services/supabaseHealthCheck.ts`
2. `src/services/localCache.ts`
3. `src/services/pendingOperationsQueue.ts`
4. `src/services/supabaseWrapper.ts`
5. `src/utils/encryption.ts`
6. `src/hooks/useSupabaseHealth.ts`
7. `src/components/SupabaseStatusIndicator.tsx`

### Arquivos a Modificar

1. `src/App.tsx` - inicializar serviços
2. `src/hooks/useLeads.ts` - usar wrapper
3. `src/hooks/useContracts.ts` - usar wrapper
4. `src/components/crm/CRMLayout.tsx` - adicionar indicador de status

## Ordem de Implementação

1. **Criptografia** (`encryption.ts`) - base de segurança
2. **Health Check** (`supabaseHealthCheck.ts`) - monitoramento
3. **Cache Seguro** (`localCache.ts`) - armazenamento criptografado
4. **Queue Protegida** (`pendingOperationsQueue.ts`) - operações pendentes
5. **Wrapper** (`supabaseWrapper.ts`) - abstração segura
6. **Hooks/Components** - integração React
7. **Adaptação de Hooks Existentes** - migração gradual

## Validação Final

Antes de considerar completo:

- [ ] Todos os dados sensíveis criptografados
- [ ] Validação de organização em todas as operações
- [ ] RLS mantido mesmo com cache
- [ ] Expiração automática funcionando
- [ ] Limpeza automática de dados antigos
- [ ] Logs sanitizados (sem dados sensíveis)
- [ ] Testes de isolamento de organizações passando
- [ ] Testes de segurança de criptografia passando