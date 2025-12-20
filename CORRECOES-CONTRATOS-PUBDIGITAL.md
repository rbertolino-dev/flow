# 🔧 Correções para Módulo de Contratos - Pubdigital

## ❌ Problema Identificado

Os contratos e templates não aparecem na organização "pubdigital" porque as políticas RLS (Row Level Security) não incluem suporte para a função `is_pubdigital_user()`.

## ✅ Solução

### 1. Aplicar Correções SQL

Execute o arquivo `APLICAR-CORRECOES-CONTRATOS.sql` no **Supabase SQL Editor**:

1. Acesse: Supabase Dashboard → SQL Editor
2. Cole o conteúdo do arquivo `APLICAR-CORRECOES-CONTRATOS.sql`
3. Execute o script

Este script irá:
- ✅ Corrigir políticas RLS de `contracts` para incluir `is_pubdigital_user()`
- ✅ Corrigir políticas RLS de `contract_templates` para incluir `is_pubdigital_user()`
- ✅ Corrigir políticas RLS de `contract_signatures` para incluir `is_pubdigital_user()`
- ✅ Corrigir políticas RLS de `contract_categories` para incluir `is_pubdigital_user()`
- ✅ Corrigir tipos de `reminder_type` e `sent_via` na tabela `contract_reminders`
- ✅ Criar tabela `contract_categories` se não existir
- ✅ Adicionar coluna `category_id` em `contracts` se não existir
- ✅ Verificar e criar funções `is_pubdigital_user()` e `has_role()` se necessário

### 2. Verificar Migrations

As seguintes migrations foram corrigidas:

- ✅ `20251216200001_add_contract_reminders.sql` - Tipos de reminder corrigidos
- ✅ `20251216210000_fix_contracts_rls_pubdigital.sql` - Políticas RLS corrigidas
- ✅ `src/types/contract.ts` - Tipos TypeScript atualizados

### 3. Tipos Corrigidos

**ReminderType:**
- ✅ `signature_due` - Assinatura pendente
- ✅ `expiration_approaching` - Vencimento próximo
- ✅ `follow_up` - Follow-up
- ✅ `custom` - Personalizado
- ✅ `expiration_warning` - Aviso de vencimento (legado)
- ✅ `unsigned_reminder` - Não assinado (legado)

**ReminderSentVia:**
- ✅ `whatsapp` - WhatsApp
- ✅ `email` - E-mail
- ✅ `sms` - SMS
- ✅ `system` - Sistema (notificações internas)
- ✅ `both` - Ambos (legado)

## 🔍 Verificação Pós-Correção

Após aplicar as correções, verifique:

1. **Contratos aparecem?**
   - Acesse a página de Contratos
   - Verifique se os contratos da organização "pubdigital" aparecem

2. **Templates aparecem?**
   - Acesse "Templates" na página de Contratos
   - Verifique se os templates aparecem

3. **Categorias funcionam?**
   - Acesse "Categorias" na página de Contratos
   - Tente criar uma categoria

4. **Lembretes funcionam?**
   - Abra um contrato
   - Verifique se a seção "Lembretes Automáticos" aparece

5. **Auditoria funciona?**
   - Abra um contrato
   - Verifique se a seção "Histórico de Auditoria" aparece

## 🐛 Troubleshooting

### Se ainda não aparecer nada:

1. **Verificar se o usuário está na organização correta:**
   ```sql
   SELECT om.*, o.name as org_name
   FROM organization_members om
   INNER JOIN organizations o ON o.id = om.organization_id
   WHERE om.user_id = auth.uid();
   ```

2. **Verificar se as políticas RLS foram aplicadas:**
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE tablename IN ('contracts', 'contract_templates', 'contract_signatures', 'contract_categories')
   ORDER BY tablename, policyname;
   ```

3. **Verificar se a função is_pubdigital_user existe:**
   ```sql
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'is_pubdigital_user';
   ```

4. **Testar a função is_pubdigital_user:**
   ```sql
   SELECT public.is_pubdigital_user(auth.uid());
   ```

## 📝 Notas Importantes

- ⚠️ As correções são **idempotentes** (podem ser executadas múltiplas vezes sem problemas)
- ⚠️ As políticas antigas são **removidas** antes de criar as novas
- ⚠️ Se houver dados existentes, eles **não serão afetados**
- ⚠️ A função `is_pubdigital_user()` verifica se o usuário pertence à organização com nome "pubdigital" (case-insensitive)

## ✅ Checklist Final

- [ ] Arquivo `APLICAR-CORRECOES-CONTRATOS.sql` executado no Supabase
- [ ] Contratos aparecem na organização pubdigital
- [ ] Templates aparecem na organização pubdigital
- [ ] Categorias funcionam
- [ ] Lembretes funcionam
- [ ] Auditoria funciona
- [ ] Sem erros no console do navegador



## ❌ Problema Identificado

Os contratos e templates não aparecem na organização "pubdigital" porque as políticas RLS (Row Level Security) não incluem suporte para a função `is_pubdigital_user()`.

## ✅ Solução

### 1. Aplicar Correções SQL

Execute o arquivo `APLICAR-CORRECOES-CONTRATOS.sql` no **Supabase SQL Editor**:

1. Acesse: Supabase Dashboard → SQL Editor
2. Cole o conteúdo do arquivo `APLICAR-CORRECOES-CONTRATOS.sql`
3. Execute o script

Este script irá:
- ✅ Corrigir políticas RLS de `contracts` para incluir `is_pubdigital_user()`
- ✅ Corrigir políticas RLS de `contract_templates` para incluir `is_pubdigital_user()`
- ✅ Corrigir políticas RLS de `contract_signatures` para incluir `is_pubdigital_user()`
- ✅ Corrigir políticas RLS de `contract_categories` para incluir `is_pubdigital_user()`
- ✅ Corrigir tipos de `reminder_type` e `sent_via` na tabela `contract_reminders`
- ✅ Criar tabela `contract_categories` se não existir
- ✅ Adicionar coluna `category_id` em `contracts` se não existir
- ✅ Verificar e criar funções `is_pubdigital_user()` e `has_role()` se necessário

### 2. Verificar Migrations

As seguintes migrations foram corrigidas:

- ✅ `20251216200001_add_contract_reminders.sql` - Tipos de reminder corrigidos
- ✅ `20251216210000_fix_contracts_rls_pubdigital.sql` - Políticas RLS corrigidas
- ✅ `src/types/contract.ts` - Tipos TypeScript atualizados

### 3. Tipos Corrigidos

**ReminderType:**
- ✅ `signature_due` - Assinatura pendente
- ✅ `expiration_approaching` - Vencimento próximo
- ✅ `follow_up` - Follow-up
- ✅ `custom` - Personalizado
- ✅ `expiration_warning` - Aviso de vencimento (legado)
- ✅ `unsigned_reminder` - Não assinado (legado)

**ReminderSentVia:**
- ✅ `whatsapp` - WhatsApp
- ✅ `email` - E-mail
- ✅ `sms` - SMS
- ✅ `system` - Sistema (notificações internas)
- ✅ `both` - Ambos (legado)

## 🔍 Verificação Pós-Correção

Após aplicar as correções, verifique:

1. **Contratos aparecem?**
   - Acesse a página de Contratos
   - Verifique se os contratos da organização "pubdigital" aparecem

2. **Templates aparecem?**
   - Acesse "Templates" na página de Contratos
   - Verifique se os templates aparecem

3. **Categorias funcionam?**
   - Acesse "Categorias" na página de Contratos
   - Tente criar uma categoria

4. **Lembretes funcionam?**
   - Abra um contrato
   - Verifique se a seção "Lembretes Automáticos" aparece

5. **Auditoria funciona?**
   - Abra um contrato
   - Verifique se a seção "Histórico de Auditoria" aparece

## 🐛 Troubleshooting

### Se ainda não aparecer nada:

1. **Verificar se o usuário está na organização correta:**
   ```sql
   SELECT om.*, o.name as org_name
   FROM organization_members om
   INNER JOIN organizations o ON o.id = om.organization_id
   WHERE om.user_id = auth.uid();
   ```

2. **Verificar se as políticas RLS foram aplicadas:**
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE tablename IN ('contracts', 'contract_templates', 'contract_signatures', 'contract_categories')
   ORDER BY tablename, policyname;
   ```

3. **Verificar se a função is_pubdigital_user existe:**
   ```sql
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'is_pubdigital_user';
   ```

4. **Testar a função is_pubdigital_user:**
   ```sql
   SELECT public.is_pubdigital_user(auth.uid());
   ```

## 📝 Notas Importantes

- ⚠️ As correções são **idempotentes** (podem ser executadas múltiplas vezes sem problemas)
- ⚠️ As políticas antigas são **removidas** antes de criar as novas
- ⚠️ Se houver dados existentes, eles **não serão afetados**
- ⚠️ A função `is_pubdigital_user()` verifica se o usuário pertence à organização com nome "pubdigital" (case-insensitive)

## ✅ Checklist Final

- [ ] Arquivo `APLICAR-CORRECOES-CONTRATOS.sql` executado no Supabase
- [ ] Contratos aparecem na organização pubdigital
- [ ] Templates aparecem na organização pubdigital
- [ ] Categorias funcionam
- [ ] Lembretes funcionam
- [ ] Auditoria funciona
- [ ] Sem erros no console do navegador













