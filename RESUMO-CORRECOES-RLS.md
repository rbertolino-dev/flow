# 📋 Resumo das Correções de RLS

## ✅ Correções Implementadas

### 1. **evolution_logs** - Erro 404
**Problema:** Políticas RLS só permitiam ver logs do próprio `user_id`, mas o frontend busca por organização.

**Solução:**
- Adicionada coluna `organization_id` se não existir
- Políticas RLS atualizadas para permitir acesso por organização
- Componentes frontend atualizados para filtrar por `organization_id`

**Arquivos modificados:**
- `supabase/migrations/20260106000001_fix_evolution_logs_rls.sql`
- `src/components/crm/WebhookLogsPanel.tsx`
- `src/components/crm/EvolutionLogsPanel.tsx`

### 2. **facebook_configs** - Erro 406
**Problema:** Políticas RLS usavam `is_pubdigital_user()` que pode estar falhando.

**Solução:**
- Removidas políticas antigas conflitantes
- Criadas políticas simplificadas baseadas apenas em `organization_members`
- Removida dependência de `is_pubdigital_user()`

**Arquivos modificados:**
- `supabase/migrations/20260106000002_fix_facebook_configs_rls.sql`

### 3. **evolution-webhook** - Erro 500
**Problema:** Erro interno no servidor (precisa verificar logs).

**Ação necessária:**
- Verificar logs do webhook: `supabase functions logs evolution-webhook`
- Pode estar relacionado às correções anteriores (criação de leads)

## 📋 Como Aplicar

### Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Migration 1 - evolution_logs:**
   - Copie conteúdo de: `supabase/migrations/20260106000001_fix_evolution_logs_rls.sql`
   - Cole no SQL Editor
   - Execute (Ctrl+Enter)

3. **Migration 2 - facebook_configs:**
   - Copie conteúdo de: `supabase/migrations/20260106000002_fix_facebook_configs_rls.sql`
   - Cole no SQL Editor
   - Execute (Ctrl+Enter)

## ✅ Verificação

Após aplicar as migrations, os erros devem desaparecer:

- ✅ `evolution_logs` deve retornar 200 (mesmo que vazio) ao invés de 404
- ✅ `facebook_configs` deve retornar 200 (mesmo que vazio) ao invés de 406
- ⚠️ `evolution-webhook` 500: Verificar logs para identificar causa específica

## 🔍 Próximos Passos

1. Aplicar migrations no Supabase Dashboard
2. Verificar logs do webhook para erro 500
3. Testar criação de leads via webhook
4. Verificar se erros desapareceram no console do navegador

